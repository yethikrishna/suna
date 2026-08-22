/** Versioned wire contract for the outbound kortixd compute-node channel. */
export const NODE_CHANNEL_VERSION = 1 as const;
export const NODE_CHANNEL_MAX_FRAME_BYTES = 256 * 1024;
export const NODE_CHANNEL_MAX_WINDOW_BYTES = 4 * 1024 * 1024;

type HeaderList = Array<[string, string]>;

interface FrameBase {
  v: typeof NODE_CHANNEL_VERSION;
  stream_id: string;
  seq: number;
}

export type NodeChannelFrame =
  | (FrameBase & {
      type: 'stream.open';
      port: number;
      method: string;
      path: string;
      headers: HeaderList;
      window: number;
    })
  | (FrameBase & { type: 'stream.request'; data: string })
  | (FrameBase & { type: 'stream.request.end' })
  | (FrameBase & {
      type: 'stream.response';
      status: number;
      headers: HeaderList;
      window: number;
    })
  | (FrameBase & { type: 'stream.response.data'; data: string })
  | (FrameBase & { type: 'stream.response.end' })
  | (FrameBase & { type: 'stream.cancel'; reason: string })
  | (FrameBase & { type: 'stream.window'; credit: number });

const STREAM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const TYPES = new Set([
  'stream.open',
  'stream.request',
  'stream.request.end',
  'stream.response',
  'stream.response.data',
  'stream.response.end',
  'stream.cancel',
  'stream.window',
]);

function invalid(message: string): never {
  throw new Error(`Invalid node channel frame: ${message}`);
}

function integer(value: unknown, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    invalid(name);
  }
  return value as number;
}

function headers(value: unknown): HeaderList {
  if (!Array.isArray(value) || value.length > 128) invalid('headers');
  return value.map((entry) => {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'string' ||
      !TOKEN.test(entry[0]) ||
      typeof entry[1] !== 'string' ||
      /[\r\n]/.test(entry[1])
    ) {
      invalid('header');
    }
    return [entry[0].toLowerCase(), entry[1]];
  });
}

function data(value: unknown): string {
  if (typeof value !== 'string' || !BASE64.test(value)) invalid('data');
  return value;
}

export function parseNodeChannelFrame(raw: string): NodeChannelFrame {
  if (Buffer.byteLength(raw, 'utf8') > NODE_CHANNEL_MAX_FRAME_BYTES) invalid('too large');
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    invalid('JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('object');
  if (value.v !== NODE_CHANNEL_VERSION) invalid('version');
  if (typeof value.type !== 'string' || !TYPES.has(value.type)) invalid('type');
  if (typeof value.stream_id !== 'string' || !STREAM_ID.test(value.stream_id)) invalid('stream_id');
  integer(value.seq, 'seq', 0, Number.MAX_SAFE_INTEGER);

  switch (value.type) {
    case 'stream.open':
      integer(value.port, 'port', 1, 65_535);
      if (typeof value.method !== 'string' || !TOKEN.test(value.method)) invalid('method');
      if (typeof value.path !== 'string' || !value.path.startsWith('/') || value.path.length > 16_384) invalid('path');
      value.headers = headers(value.headers);
      integer(value.window, 'window', 1, NODE_CHANNEL_MAX_WINDOW_BYTES);
      break;
    case 'stream.response':
      integer(value.status, 'status', 100, 599);
      value.headers = headers(value.headers);
      integer(value.window, 'window', 1, NODE_CHANNEL_MAX_WINDOW_BYTES);
      break;
    case 'stream.request':
    case 'stream.response.data':
      data(value.data);
      break;
    case 'stream.cancel':
      if (typeof value.reason !== 'string' || value.reason.length > 256 || /[\r\n]/.test(value.reason)) invalid('reason');
      break;
    case 'stream.window':
      integer(value.credit, 'credit', 1, NODE_CHANNEL_MAX_WINDOW_BYTES);
      break;
  }
  return value as unknown as NodeChannelFrame;
}
