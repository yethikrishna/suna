import { describe, expect, test } from 'bun:test';
import {
  NODE_CHANNEL_MAX_FRAME_BYTES,
  NODE_CHANNEL_VERSION,
  parseNodeChannelFrame,
  type NodeChannelFrame,
} from '../node-channel';

const STREAM_ID = '018f1f36-6ef9-7ca7-8e17-b97f405f1a63';

describe('node channel stream frames', () => {
  test('accepts the complete streaming HTTP lifecycle', () => {
    const frames: NodeChannelFrame[] = [
      {
        v: 1,
        type: 'stream.open',
        stream_id: STREAM_ID,
        seq: 0,
        port: 8000,
        method: 'POST',
        path: '/session/abc/prompt_async',
        headers: [['content-type', 'application/json']],
        window: 65_536,
      },
      { v: 1, type: 'stream.request', stream_id: STREAM_ID, seq: 1, data: 'e30=' },
      { v: 1, type: 'stream.request.end', stream_id: STREAM_ID, seq: 2 },
      {
        v: 1,
        type: 'stream.response',
        stream_id: STREAM_ID,
        seq: 0,
        status: 204,
        headers: [],
        window: 65_536,
      },
      { v: 1, type: 'stream.response.end', stream_id: STREAM_ID, seq: 1 },
    ];

    expect(frames.map((frame) => parseNodeChannelFrame(JSON.stringify(frame)))).toEqual(frames);
  });

  test('accepts response data, cancellation, and flow-control frames', () => {
    for (const frame of [
      { v: 1, type: 'stream.response.data', stream_id: STREAM_ID, seq: 2, data: 'ZGF0YQ==' },
      { v: 1, type: 'stream.cancel', stream_id: STREAM_ID, seq: 3, reason: 'caller_aborted' },
      { v: 1, type: 'stream.window', stream_id: STREAM_ID, seq: 4, credit: 32_768 },
    ] satisfies NodeChannelFrame[]) {
      expect(parseNodeChannelFrame(JSON.stringify(frame))).toEqual(frame);
    }
  });

  test('rejects malformed identity, ordering fields, ports, paths, and base64', () => {
    const base = {
      v: NODE_CHANNEL_VERSION,
      type: 'stream.request',
      stream_id: STREAM_ID,
      seq: 1,
      data: 'e30=',
    };
    for (const patch of [
      { stream_id: '../other' },
      { seq: -1 },
      { data: '***' },
      { type: 'stream.open', port: 0, method: 'GET', path: '/', headers: [], window: 1 },
      { type: 'stream.open', port: 8000, method: 'GET', path: 'relative', headers: [], window: 1 },
    ]) {
      expect(() => parseNodeChannelFrame(JSON.stringify({ ...base, ...patch }))).toThrow();
    }
  });

  test('rejects frames beyond the fixed wire ceiling', () => {
    expect(() => parseNodeChannelFrame('x'.repeat(NODE_CHANNEL_MAX_FRAME_BYTES + 1))).toThrow();
  });
});
