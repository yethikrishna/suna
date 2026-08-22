import { createHmac, timingSafeEqual } from 'node:crypto'
import { parseNodeChannelFrame, type NodeChannelFrame } from '@kortix/api-contract/node-channel'
import { NodeStreamAgent, type PortPolicy } from './stream-agent'

interface ChannelOptions {
  apiUrl: string
  nodeId: string
  token: string
  ports: PortPolicy
  socketFactory?: (url: string) => WebSocket
}

function wsUrl(apiUrl: string): string {
  const url = new URL(apiUrl.replace(/\/$/, '') + '/nodes/ws')
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

function signature(key: string, nonce: number, payload: string): string {
  return createHmac('sha256', key).update(`${nonce}:${payload}`).digest('hex')
}

export class KortixNodeChannel {
  private socket: WebSocket | null = null
  private key: string | null = null
  private sendNonce = 0
  private receiveNonce = 0
  private lastError: string | null = null
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shuttingDown = false
  private readonly streams: NodeStreamAgent

  constructor(private readonly options: ChannelOptions) {
    this.streams = new NodeStreamAgent((frame) => this.sendSigned(frame), fetch, options.ports)
  }

  connect(): void {
    this.socket = (this.options.socketFactory ?? ((url) => new WebSocket(url)))(wsUrl(this.options.apiUrl))
    this.socket.addEventListener('open', () => {
      this.key = null
      this.sendNonce = 0
      this.receiveNonce = 0
      this.socket?.send(JSON.stringify({ type: 'node.auth', node_id: this.options.nodeId, token: this.options.token, version: process.env.KORTIXD_VERSION ?? 'dev' }))
    })
    this.socket.addEventListener('message', (event) => { void this.receive(event.data) })
    this.socket.addEventListener('close', (event) => {
      this.key = null
      this.streams.disconnect()
      if (!this.shuttingDown && ![4001, 4003, 4004].includes((event as CloseEvent).code)) this.scheduleReconnect()
    })
    this.socket.addEventListener('error', () => { this.lastError = 'WebSocket connection error' })
  }

  disconnect(): void {
    this.shuttingDown = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.socket?.close(1000, 'kortixd shutdown')
    this.streams.disconnect()
  }

  status() { return { connected: this.key !== null, lastError: this.lastError } }

  private async receive(raw: unknown): Promise<void> {
    try {
      if (typeof raw !== 'string') throw new Error('non-text node channel frame')
      const value = JSON.parse(raw) as Record<string, unknown>
      if (value.type === 'node.auth.ok' && typeof value.signing_key === 'string') {
        this.key = value.signing_key
        this.lastError = null
        this.reconnectAttempts = 0
        return
      }
      if (!this.key) throw new Error('frame received before authentication')
      const nonce = value._nonce
      const sig = value._sig
      if (!Number.isSafeInteger(nonce) || (nonce as number) <= this.receiveNonce) throw new Error('invalid or replayed channel nonce')
      if (typeof sig !== 'string') throw new Error('missing channel signature')
      const { _nonce, _sig, ...frame } = value
      const expected = signature(this.key, nonce as number, JSON.stringify(frame))
      const actualBytes = Buffer.from(sig, 'hex')
      const expectedBytes = Buffer.from(expected, 'hex')
      if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) throw new Error('invalid channel signature')
      this.receiveNonce = nonce as number
      await this.streams.handle(parseNodeChannelFrame(JSON.stringify(frame)))
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
    }
  }

  private sendSigned(frame: NodeChannelFrame): void {
    if (!this.key || !this.socket || this.socket.readyState !== WebSocket.OPEN) return
    const nonce = ++this.sendNonce
    const payload = JSON.stringify(frame)
    this.socket.send(JSON.stringify({ ...frame, _nonce: nonce, _sig: signature(this.key, nonce, payload) }))
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1_000 * 2 ** this.reconnectAttempts++, 30_000)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }
}
