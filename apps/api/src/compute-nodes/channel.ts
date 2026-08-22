import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { NODE_CHANNEL_MAX_FRAME_BYTES, NODE_CHANNEL_MAX_SOCKET_MESSAGE_BYTES, NODE_CHANNEL_MAX_WINDOW_BYTES, parseNodeChannelFrame, type NodeChannelFrame } from '@kortix/api-contract/node-channel'

interface SocketLike { send(value: string): void; close(code?: number, reason?: string): void }
interface AuthResult { nodeId: string; externalId?: string }
type Authenticate = (nodeId: string, token: string, version?: string) => Promise<AuthResult | null>
type ResolveNodeId = (externalId: string) => Promise<string | null>

interface Connection {
  nodeId: string
  externalId?: string
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
  sendCredit: number
  creditWaiter?: () => void
  responseCreditPending: number
  responsePullPending: boolean
}

interface SocketState {
  nodeId: string
  sendSeq: number
  receiveSeq: number
  opened: boolean
  onOpen(): void
  onData(data: Uint8Array, binary: boolean): void
  onClose(code: number, reason: string): void
  receiveChunks: Buffer[]
  receiveBytes: number
  receiveBinary?: boolean
}

export interface ComputeNodeSocket {
  send(data: string | Buffer | ArrayBuffer | Uint8Array): void
  close(code?: number, reason?: string): void
}

export interface ComputeNodeSocketHandlers {
  open(): void
  message(data: Uint8Array, binary: boolean): void
  close(code: number, reason: string): void
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
  private readonly sockets = new Map<string, SocketState>()

  constructor(
    private readonly authenticate: Authenticate,
    private readonly resolveNodeId?: ResolveNodeId,
  ) {}

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
    if (connection.externalId) this.externalToNode.delete(connection.externalId)
    for (const [id, stream] of this.streams) if (stream.nodeId === connection.nodeId) this.fail(id, stream, new Error(`Compute node ${connection.nodeId} disconnected`))
    for (const [id, state] of this.sockets) {
      if (state.nodeId !== connection.nodeId) continue
      this.sockets.delete(id)
      state.onClose(1012, 'compute node disconnected')
    }
  }

  isConnected(nodeId: string): boolean { return this.byNode.has(nodeId) }

  async fetchByExternalId(externalId: string, port: number, request: Request): Promise<Response> {
    let nodeId = this.externalToNode.get(externalId)
    if (!nodeId && this.resolveNodeId) {
      nodeId = (await this.resolveNodeId(externalId)) ?? undefined
      if (nodeId && this.byNode.has(nodeId)) this.externalToNode.set(externalId, nodeId)
    }
    if (!nodeId) throw new Error(`Compute node for ${externalId} is not connected`)
    return this.fetch(nodeId, port, request)
  }

  fetch(nodeId: string, port: number, request: Request): Promise<Response> {
    const connection = this.byNode.get(nodeId)
    if (!connection) return Promise.reject(new Error(`Compute node ${nodeId} is not connected`))
    const id = crypto.randomUUID()
    let resolve!: (response: Response) => void
    let reject!: (error: Error) => void
    const result = new Promise<Response>((ok, fail) => { resolve = ok; reject = fail })
    const state: StreamState = {
      nodeId,
      sendSeq: 0,
      receiveSeq: 0,
      settled: false,
      resolve,
      reject,
      sendCredit: NODE_CHANNEL_MAX_WINDOW_BYTES,
      responseCreditPending: 0,
      responsePullPending: false,
    }
    this.streams.set(id, state)
    const url = new URL(request.url)
    this.sendFrame(connection, state, { v: 1, type: 'stream.open', stream_id: id, seq: 0, port, method: request.method, path: url.pathname + url.search, headers: [...request.headers.entries()], window: NODE_CHANNEL_MAX_WINDOW_BYTES })
    void this.sendBody(connection, state, id, request.body).catch((error) => this.fail(id, state, error))
    return result
  }

  async connectWebSocketByExternalId(
    externalId: string,
    port: number,
    path: string,
    headers: Record<string, string>,
    handlers: ComputeNodeSocketHandlers,
  ): Promise<ComputeNodeSocket> {
    let nodeId = this.externalToNode.get(externalId)
    if (!nodeId && this.resolveNodeId) {
      nodeId = (await this.resolveNodeId(externalId)) ?? undefined
      if (nodeId && this.byNode.has(nodeId)) this.externalToNode.set(externalId, nodeId)
    }
    if (!nodeId) throw new Error(`Compute node for ${externalId} is not connected`)
    const connection = this.byNode.get(nodeId)
    if (!connection) throw new Error(`Compute node ${nodeId} is not connected`)
    const id = crypto.randomUUID()
    const state: SocketState = {
      nodeId,
      sendSeq: 0,
      receiveSeq: 0,
      opened: false,
      onOpen: handlers.open,
      onData: handlers.message,
      onClose: handlers.close,
      receiveChunks: [],
      receiveBytes: 0,
    }
    this.sockets.set(id, state)
    this.sendFrame(connection, state, { v: 1, type: 'socket.open', stream_id: id, seq: 0, port, path, headers: Object.entries(headers) })
    return {
      send: (data) => {
        if (!this.sockets.has(id)) throw new Error('Compute node socket is closed')
        const bytes = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data as ArrayBuffer)
        if (bytes.byteLength === 0) {
          this.sendFrame(connection, state, { v: 1, type: 'socket.data', stream_id: id, seq: 0, data: '', binary: typeof data !== 'string', fin: true })
          return
        }
        for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_BYTES) {
          const chunk = bytes.subarray(offset, offset + CHUNK_BYTES)
          this.sendFrame(connection, state, { v: 1, type: 'socket.data', stream_id: id, seq: 0, data: chunk.toString('base64'), binary: typeof data !== 'string', fin: offset + chunk.byteLength === bytes.byteLength })
        }
      },
      close: (code = 1000, reason = '') => {
        if (!this.sockets.has(id)) return
        this.sendFrame(connection, state, { v: 1, type: 'socket.close', stream_id: id, seq: 0, code: sanitizeSocketCode(code), reason: reason.replace(/[\r\n]/g, ' ').slice(0, 123) })
        this.sockets.delete(id)
      },
    }
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
      if (result.externalId) this.externalToNode.set(result.externalId, result.nodeId)
      socket.send(JSON.stringify({ type: 'node.auth.ok', signing_key: key }))
    } catch {
      socket.close(4001, 'invalid node authentication')
    }
  }

  private handleFrame(connection: Connection, frame: NodeChannelFrame): void {
    if (frame.type.startsWith('socket.')) {
      this.handleSocketFrame(connection, frame)
      return
    }
    const state = this.streams.get(frame.stream_id)
    if (!state || state.nodeId !== connection.nodeId) throw new Error('unknown node stream')
    if (frame.seq !== state.receiveSeq) throw new Error(`invalid node stream sequence: expected ${state.receiveSeq}, received ${frame.seq}`)
    state.receiveSeq++
    if (frame.type === 'stream.response') {
      if (state.settled) throw new Error('duplicate node stream response')
      state.settled = true
      const body = new ReadableStream<Uint8Array>({
        start: (controller) => { state.controller = controller },
        pull: () => {
          if (!this.streams.has(frame.stream_id)) return
          if (state.responseCreditPending <= 0) {
            state.responsePullPending = true
            return
          }
          const credit = state.responseCreditPending
          state.responseCreditPending = 0
          state.responsePullPending = false
          this.sendFrame(connection, state, { v: 1, type: 'stream.window', stream_id: frame.stream_id, seq: 0, credit })
        },
        cancel: (reason) => {
          if (!this.streams.has(frame.stream_id)) return
          this.sendFrame(connection, state, {
            v: 1,
            type: 'stream.cancel',
            stream_id: frame.stream_id,
            seq: 0,
            reason: String(reason ?? 'response consumer cancelled').replace(/[\r\n]/g, ' ').slice(0, 256),
          })
          this.streams.delete(frame.stream_id)
        },
      }, new ByteLengthQueuingStrategy({ highWaterMark: 0 }))
      state.resolve(new Response(body, { status: frame.status, headers: frame.headers }))
    } else if (frame.type === 'stream.response.data') {
      if (!state.controller) throw new Error('node data before response')
      const bytes = Buffer.from(frame.data, 'base64')
      state.controller.enqueue(bytes)
      if (state.responsePullPending) {
        state.responsePullPending = false
        this.sendFrame(connection, state, { v: 1, type: 'stream.window', stream_id: frame.stream_id, seq: 0, credit: bytes.byteLength })
      } else {
        state.responseCreditPending += bytes.byteLength
      }
    } else if (frame.type === 'stream.response.end') {
      state.controller?.close()
      this.streams.delete(frame.stream_id)
    } else if (frame.type === 'stream.cancel') {
      this.fail(frame.stream_id, state, new Error(`Node stream cancelled: ${frame.reason}`))
    } else if (frame.type === 'stream.window') {
      state.sendCredit = Math.min(NODE_CHANNEL_MAX_WINDOW_BYTES, state.sendCredit + frame.credit)
      state.creditWaiter?.()
      state.creditWaiter = undefined
    } else {
      throw new Error(`unexpected node frame ${frame.type}`)
    }
  }

  private handleSocketFrame(connection: Connection, frame: NodeChannelFrame): void {
    const state = this.sockets.get(frame.stream_id)
    if (!state || state.nodeId !== connection.nodeId) throw new Error('unknown node socket')
    if (frame.seq !== state.receiveSeq) throw new Error(`invalid node socket sequence: expected ${state.receiveSeq}, received ${frame.seq}`)
    state.receiveSeq++
    if (frame.type === 'socket.opened') {
      if (state.opened) throw new Error('duplicate node socket open')
      state.opened = true
      state.onOpen()
    } else if (frame.type === 'socket.data') {
      if (!state.opened) throw new Error('node socket data before open')
      if (state.receiveBinary !== undefined && state.receiveBinary !== frame.binary) throw new Error('node socket message type changed between fragments')
      const bytes = Buffer.from(frame.data, 'base64')
      state.receiveBinary = frame.binary
      state.receiveChunks.push(bytes)
      state.receiveBytes += bytes.byteLength
      if (state.receiveBytes > NODE_CHANNEL_MAX_SOCKET_MESSAGE_BYTES) throw new Error('node socket message exceeds limit')
      if (frame.fin) {
        state.onData(Buffer.concat(state.receiveChunks, state.receiveBytes), Boolean(state.receiveBinary))
        state.receiveChunks = []
        state.receiveBytes = 0
        state.receiveBinary = undefined
      }
    } else if (frame.type === 'socket.close') {
      this.sockets.delete(frame.stream_id)
      state.onClose(frame.code, frame.reason)
    } else {
      throw new Error(`unexpected node socket frame ${frame.type}`)
    }
  }

  private async sendBody(connection: Connection, state: StreamState, id: string, body: ReadableStream<Uint8Array> | null): Promise<void> {
    if (body) {
      const reader = body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        let offset = 0
        while (offset < value.byteLength) {
          await this.waitForCredit(state)
          if (!this.streams.has(id)) throw new Error('Compute node stream closed while sending request')
          const length = Math.min(CHUNK_BYTES, state.sendCredit, value.byteLength - offset)
          state.sendCredit -= length
          this.sendFrame(connection, state, { v: 1, type: 'stream.request', stream_id: id, seq: 0, data: Buffer.from(value.subarray(offset, offset + length)).toString('base64') })
          offset += length
        }
      }
    }
    this.sendFrame(connection, state, { v: 1, type: 'stream.request.end', stream_id: id, seq: 0 })
  }

  private async waitForCredit(state: StreamState): Promise<void> {
    while (state.sendCredit <= 0) {
      await new Promise<void>((resolve) => { state.creditWaiter = resolve })
    }
  }

  private sendFrame(connection: Connection, state: { sendSeq: number }, frame: NodeChannelFrame): void {
    frame.seq = state.sendSeq++
    const nonce = ++connection.sendNonce
    const payload = JSON.stringify(frame)
    connection.socket.send(JSON.stringify({ ...frame, _nonce: nonce, _sig: signature(connection.key, nonce, payload) }))
  }

  private fail(id: string, state: StreamState, error: Error): void {
    this.streams.delete(id)
    state.creditWaiter?.()
    state.creditWaiter = undefined
    state.controller?.error(error)
    if (!state.settled) state.reject(error)
  }
}

function sanitizeSocketCode(code: number): number {
  return code >= 1000 && code <= 4999 && ![1004, 1005, 1006, 1015].includes(code) ? code : 4500
}
