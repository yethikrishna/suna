import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { NODE_CHANNEL_MAX_FRAME_BYTES, NODE_CHANNEL_MAX_WINDOW_BYTES, parseNodeChannelFrame, type NodeChannelFrame } from '@kortix/api-contract/node-channel'

interface SocketLike { send(value: string): void; close(code?: number, reason?: string): void }
interface AuthResult { nodeId: string; externalId: string }
type Authenticate = (nodeId: string, token: string, version?: string) => Promise<AuthResult | null>

interface Connection extends AuthResult {
  socket: SocketLike
  key: string
  sendNonce: number
  receiveNonce: number
}

interface StreamState {
  nodeId: string
  sendSeq: number
  receiveSeq: number
  settled: boolean
  resolve(response: Response): void
  reject(error: Error): void
  controller?: ReadableStreamDefaultController<Uint8Array>
}

const CHUNK_BYTES = Math.floor((NODE_CHANNEL_MAX_FRAME_BYTES - 2048) * 3 / 4)

function signature(key: string, nonce: number, payload: string): string {
  return createHmac('sha256', key).update(`${nonce}:${payload}`).digest('hex')
}

export class ComputeNodeChannelHub {
  private readonly pending = new Set<SocketLike>()
  private readonly byNode = new Map<string, Connection>()
  private readonly externalToNode = new Map<string, string>()
  private readonly streams = new Map<string, StreamState>()

  constructor(private readonly authenticate: Authenticate) {}

  open(socket: SocketLike): void { this.pending.add(socket) }

  async message(socket: SocketLike, rawValue: string | Buffer): Promise<void> {
    const raw = typeof rawValue === 'string' ? rawValue : rawValue.toString('utf8')
    if (Buffer.byteLength(raw) > NODE_CHANNEL_MAX_FRAME_BYTES + 512) {
      socket.close(4002, 'node channel frame too large')
      return
    }
    if (this.pending.has(socket)) {
      await this.authenticateSocket(socket, raw)
      return
    }
    const connection = [...this.byNode.values()].find((item) => item.socket === socket)
    if (!connection) return
    try {
      const value = JSON.parse(raw) as Record<string, unknown>
      const nonce = value._nonce
      const sig = value._sig
      if (!Number.isSafeInteger(nonce) || (nonce as number) <= connection.receiveNonce) throw new Error('invalid or replayed node channel nonce')
      if (typeof sig !== 'string') throw new Error('missing node channel signature')
      const { _nonce, _sig, ...unsigned } = value
      const expected = Buffer.from(signature(connection.key, nonce as number, JSON.stringify(unsigned)), 'hex')
      const actual = Buffer.from(sig, 'hex')
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('invalid node channel signature')
      connection.receiveNonce = nonce as number
      this.handleFrame(connection, parseNodeChannelFrame(JSON.stringify(unsigned)))
    } catch (error) {
      socket.close(4002, error instanceof Error ? error.message.slice(0, 120) : 'invalid node channel frame')
      this.close(socket)
    }
  }

  close(socket: SocketLike): void {
    this.pending.delete(socket)
    const connection = [...this.byNode.values()].find((item) => item.socket === socket)
    if (!connection) return
    this.byNode.delete(connection.nodeId)
    this.externalToNode.delete(connection.externalId)
    for (const [id, stream] of this.streams) if (stream.nodeId === connection.nodeId) this.fail(id, stream, new Error(`Compute node ${connection.nodeId} disconnected`))
  }

  isConnected(nodeId: string): boolean { return this.byNode.has(nodeId) }

  fetchByExternalId(externalId: string, port: number, request: Request): Promise<Response> {
    const nodeId = this.externalToNode.get(externalId)
    if (!nodeId) return Promise.reject(new Error(`Compute node for ${externalId} is not connected`))
    return this.fetch(nodeId, port, request)
  }

  fetch(nodeId: string, port: number, request: Request): Promise<Response> {
    const connection = this.byNode.get(nodeId)
    if (!connection) return Promise.reject(new Error(`Compute node ${nodeId} is not connected`))
    const id = crypto.randomUUID()
    let resolve!: (response: Response) => void
    let reject!: (error: Error) => void
    const result = new Promise<Response>((ok, fail) => { resolve = ok; reject = fail })
    const state: StreamState = { nodeId, sendSeq: 0, receiveSeq: 0, settled: false, resolve, reject }
    this.streams.set(id, state)
    const url = new URL(request.url)
    this.sendFrame(connection, state, { v: 1, type: 'stream.open', stream_id: id, seq: 0, port, method: request.method, path: url.pathname + url.search, headers: [...request.headers.entries()], window: NODE_CHANNEL_MAX_WINDOW_BYTES })
    void this.sendBody(connection, state, id, request.body).catch((error) => this.fail(id, state, error))
    return result
  }

  private async authenticateSocket(socket: SocketLike, raw: string): Promise<void> {
    this.pending.delete(socket)
    try {
      const value = JSON.parse(raw) as Record<string, unknown>
      if (value.type !== 'node.auth' || typeof value.node_id !== 'string' || typeof value.token !== 'string') throw new Error('invalid node authentication')
      const result = await this.authenticate(value.node_id, value.token, typeof value.version === 'string' ? value.version : undefined)
      if (!result || result.nodeId !== value.node_id) {
        socket.close(4001, 'node authentication failed')
        return
      }
      const previous = this.byNode.get(result.nodeId)
      if (previous) { previous.socket.close(4004, 'replaced by newer kortixd connection'); this.close(previous.socket) }
      const key = randomBytes(32).toString('hex')
      const connection: Connection = { ...result, socket, key, sendNonce: 0, receiveNonce: 0 }
      this.byNode.set(result.nodeId, connection)
      this.externalToNode.set(result.externalId, result.nodeId)
      socket.send(JSON.stringify({ type: 'node.auth.ok', signing_key: key }))
    } catch {
      socket.close(4001, 'invalid node authentication')
    }
  }

  private handleFrame(connection: Connection, frame: NodeChannelFrame): void {
    const state = this.streams.get(frame.stream_id)
    if (!state || state.nodeId !== connection.nodeId) throw new Error('unknown node stream')
    if (frame.seq !== state.receiveSeq) throw new Error(`invalid node stream sequence: expected ${state.receiveSeq}, received ${frame.seq}`)
    state.receiveSeq++
    if (frame.type === 'stream.response') {
      if (state.settled) throw new Error('duplicate node stream response')
      state.settled = true
      const body = new ReadableStream<Uint8Array>({ start: (controller) => { state.controller = controller }, cancel: () => { this.streams.delete(frame.stream_id) } })
      state.resolve(new Response(body, { status: frame.status, headers: frame.headers }))
    } else if (frame.type === 'stream.response.data') {
      if (!state.controller) throw new Error('node data before response')
      const bytes = Buffer.from(frame.data, 'base64')
      state.controller.enqueue(bytes)
      this.sendFrame(connection, state, { v: 1, type: 'stream.window', stream_id: frame.stream_id, seq: 0, credit: bytes.byteLength })
    } else if (frame.type === 'stream.response.end') {
      state.controller?.close()
      this.streams.delete(frame.stream_id)
    } else if (frame.type === 'stream.cancel') {
      this.fail(frame.stream_id, state, new Error(`Node stream cancelled: ${frame.reason}`))
    } else if (frame.type !== 'stream.window') {
      throw new Error(`unexpected node frame ${frame.type}`)
    }
  }

  private async sendBody(connection: Connection, state: StreamState, id: string, body: ReadableStream<Uint8Array> | null): Promise<void> {
    if (body) {
      const reader = body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        for (let offset = 0; offset < value.byteLength; offset += CHUNK_BYTES) this.sendFrame(connection, state, { v: 1, type: 'stream.request', stream_id: id, seq: 0, data: Buffer.from(value.subarray(offset, offset + CHUNK_BYTES)).toString('base64') })
      }
    }
    this.sendFrame(connection, state, { v: 1, type: 'stream.request.end', stream_id: id, seq: 0 })
  }

  private sendFrame(connection: Connection, state: StreamState, frame: NodeChannelFrame): void {
    frame.seq = state.sendSeq++
    const nonce = ++connection.sendNonce
    const payload = JSON.stringify(frame)
    connection.socket.send(JSON.stringify({ ...frame, _nonce: nonce, _sig: signature(connection.key, nonce, payload) }))
  }

  private fail(id: string, state: StreamState, error: Error): void {
    this.streams.delete(id)
    state.controller?.error(error)
    if (!state.settled) state.reject(error)
  }
}
