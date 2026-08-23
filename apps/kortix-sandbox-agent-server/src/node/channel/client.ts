import { createHmac, timingSafeEqual } from 'node:crypto'
import { parseNodeChannelFrame, type NodeChannelFrame } from '@kortix/api-contract/node-channel'
import { WebSocket as StandardWebSocket } from 'ws'
import { NodeStreamAgent, type PortPolicy } from './stream-agent'
import { NodeSocketAgent } from './socket-agent'
import { NodeRpcAgent } from './rpc-agent'
import type { NodeCapabilityRegistry } from '../capabilities'
import type { NodeAssignmentManager } from '../assignment-manager'

interface ChannelOptions {
  apiUrl: string
  nodeId: string
  token: string
  ports: PortPolicy
  capabilities?: NodeCapabilityRegistry
  assignments?: NodeAssignmentManager
  onAuthenticated?: () => void | Promise<void>
  socketFactory?: (url: string) => WebSocketLike
  reconnectDelayMs?: () => number
}

interface WebSocketLike {
  readonly readyState: number
  addEventListener(type: string, listener: (event: any) => void): void
  send(data: string): void
  close(code?: number, reason?: string): void
}

export const NODE_CHANNEL_WEBSOCKET_OPTIONS = {
  headers: { 'User-Agent': 'kortixd' },
  // Cloudflare negotiates permessage-deflate by default. Bun 1.3.14 can fail
  // to inflate those frames with `ZlibError`, which silently drops the only
  // control-plane channel. Node-channel frames are small, so compression adds
  // risk without meaningful bandwidth savings.
  perMessageDeflate: false,
} as const

function defaultSocketFactory(url: string): WebSocketLike {
  // Bun omits User-Agent from its native WebSocket handshake. Cloudflare
  // rejects that upgrade with `Expected 101 status code`. The `ws` constructor
  // accepts an explicit header even when Bun provides its compatible runtime.
  return new StandardWebSocket(url, NODE_CHANNEL_WEBSOCKET_OPTIONS) as unknown as WebSocketLike
}

function textFrame(raw: unknown): string | null {
  if (typeof raw === 'string') return raw
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString('utf8')
  if (ArrayBuffer.isView(raw)) return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString('utf8')
  return null
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
  private socket: WebSocketLike | null = null
  private key: string | null = null
  private sendNonce = 0
  private receiveNonce = 0
  private lastError: string | null = null
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private readonly heartbeatStreamId = crypto.randomUUID()
  private heartbeatSeq = 0
  private shuttingDown = false
  private readonly streams: NodeStreamAgent
  private readonly sockets: NodeSocketAgent
  private readonly rpc: NodeRpcAgent

  constructor(private readonly options: ChannelOptions) {
    this.streams = new NodeStreamAgent((frame) => this.sendSigned(frame), fetch, options.ports)
    this.sockets = new NodeSocketAgent((frame) => this.sendSigned(frame), options.ports)
    this.rpc = new NodeRpcAgent((frame) => this.sendSigned(frame), options.capabilities?.methods ?? new Map())
  }

  connect(): void {
    const socket = (this.options.socketFactory ?? defaultSocketFactory)(wsUrl(this.options.apiUrl))
    this.socket = socket
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return
      this.key = null
      this.sendNonce = 0
      this.receiveNonce = 0
      socket.send(JSON.stringify({
        type: 'node.auth',
        node_id: this.options.nodeId,
        token: this.options.token,
        version: process.env.KORTIXD_VERSION ?? 'dev',
        capabilities: this.options.capabilities?.names ?? [],
        platform: process.platform,
        arch: process.arch,
      }))
    })
    socket.addEventListener('message', (event) => {
      if (this.socket === socket) void this.receive(event.data)
    })
    socket.addEventListener('close', (event) => {
      if (this.socket !== socket) return
      this.key = null
      this.socket = null
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer)
        this.heartbeatTimer = null
      }
      this.streams.disconnect()
      this.sockets.disconnect()
      this.rpc.disconnect()
      const code = (event as CloseEvent).code
      this.lastError = `Node channel closed (${code})`
      // 4001 rejects invalid credentials. 4003 explicitly disables the node.
      // 4004 only means another connection won a replacement race. Reconnect
      // because the winning socket can belong to an API process that is exiting.
      if (!this.shuttingDown && ![4001, 4003].includes(code)) this.scheduleReconnect()
    })
    socket.addEventListener('error', () => {
      if (this.socket === socket) this.lastError = 'WebSocket connection error'
    })
  }

  disconnect(): void {
    this.shuttingDown = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.socket?.close(1000, 'kortixd shutdown')
    this.streams.disconnect()
    this.sockets.disconnect()
    this.rpc.disconnect()
  }

  status() { return { connected: this.key !== null, lastError: this.lastError } }

  private async receive(raw: unknown): Promise<void> {
    try {
      const text = textFrame(raw)
      if (text === null) throw new Error('non-text node channel frame')
      const value = JSON.parse(text) as Record<string, unknown>
      if (value.type === 'node.auth.ok' && typeof value.signing_key === 'string') {
        this.key = value.signing_key
        this.lastError = null
        this.reconnectAttempts = 0
        this.startHeartbeats()
        this.options.assignments?.resetSequences()
        await this.options.onAuthenticated?.()
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
      const parsed = parseNodeChannelFrame(JSON.stringify(frame))
      if (await this.options.assignments?.handle(parsed)) return
      if (!this.sockets.handle(parsed) && !this.rpc.handle(parsed)) await this.streams.handle(parsed)
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
    }
  }

  send(frame: NodeChannelFrame): void { this.sendSigned(frame) }

  private sendSigned(frame: NodeChannelFrame): void {
    if (!this.key || !this.socket || this.socket.readyState !== StandardWebSocket.OPEN) return
    const nonce = ++this.sendNonce
    const payload = JSON.stringify(frame)
    this.socket.send(JSON.stringify({ ...frame, _nonce: nonce, _sig: signature(this.key, nonce, payload) }))
  }

  private scheduleReconnect(): void {
    const delay = this.options.reconnectDelayMs?.() ?? (() => {
      const base = Math.min(1_000 * 2 ** this.reconnectAttempts++, 30_000)
      return Math.floor(base * (0.75 + Math.random() * 0.5))
    })()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  private startHeartbeats(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    const send = () => this.sendSigned({
      v: 1,
      type: 'node.heartbeat',
      stream_id: this.heartbeatStreamId,
      seq: this.heartbeatSeq++,
      version: process.env.KORTIXD_VERSION ?? 'dev',
      capabilities: [...(this.options.capabilities?.names ?? [])],
      platform: process.platform,
      arch: process.arch,
      sent_at: new Date().toISOString(),
    })
    send()
    this.heartbeatTimer = setInterval(send, 15_000)
    this.heartbeatTimer.unref?.()
  }
}
