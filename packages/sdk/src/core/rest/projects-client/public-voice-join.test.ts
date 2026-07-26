import { beforeEach, expect, mock, test } from 'bun:test';
import { configureKortix } from '../../http/config';
import { PublicVoiceJoinError, getPublicVoiceJoin } from './public-voice-join';

let calls: { url: string; method: string; headers: Record<string, string> }[] = [];
let nextResponse: { status: number; body: unknown } = { status: 200, body: {} };

beforeEach(() => {
  calls = [];
  nextResponse = { status: 200, body: {} };
  globalThis.fetch = mock(async (url: unknown, opts: { method?: string; headers?: Record<string, string> } = {}) => {
    calls.push({ url: String(url), method: opts.method ?? 'GET', headers: opts.headers ?? {} });
    return new Response(JSON.stringify(nextResponse.body), {
      status: nextResponse.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
});

configureKortix({ backendUrl: 'http://test.local', getToken: async () => 'tok' });
const last = () => calls[calls.length - 1];

test('getPublicVoiceJoin hits /public/voice-join/:token with no Authorization header', async () => {
  nextResponse = { status: 200, body: { call_id: 'sess-1', url: 'wss://livekit.example.com', token: 'lk-jwt' } };
  const result = await getPublicVoiceJoin('vjl_abc123');
  expect(last().url).toBe('http://test.local/public/voice-join/vjl_abc123');
  expect(last().method).toBe('GET');
  expect(last().headers.Authorization).toBeUndefined();
  expect(result.call_id).toBe('sess-1');
  expect(result.url).toBe('wss://livekit.example.com');
  expect(result.token).toBe('lk-jwt');
});

test('getPublicVoiceJoin URL-encodes the token', async () => {
  nextResponse = { status: 200, body: { call_id: 'sess-1', url: 'wss://x', token: 't' } };
  await getPublicVoiceJoin('vjl_has/slash');
  expect(last().url).toBe('http://test.local/public/voice-join/vjl_has%2Fslash');
});

test('getPublicVoiceJoin throws a PublicVoiceJoinError carrying the status on 404', async () => {
  nextResponse = { status: 404, body: { error: 'Invalid or unknown link' } };
  await expect(getPublicVoiceJoin('unknown')).rejects.toThrow('Invalid or unknown link');
  try {
    await getPublicVoiceJoin('unknown');
    throw new Error('expected a rejection');
  } catch (err) {
    expect(err).toBeInstanceOf(PublicVoiceJoinError);
    expect((err as PublicVoiceJoinError).status).toBe(404);
  }
});

test('getPublicVoiceJoin surfaces 410 (expired or the call ended) with the status preserved', async () => {
  nextResponse = { status: 410, body: { error: 'This call has ended' } };
  try {
    await getPublicVoiceJoin('ended');
    throw new Error('expected a rejection');
  } catch (err) {
    expect(err).toBeInstanceOf(PublicVoiceJoinError);
    expect((err as PublicVoiceJoinError).status).toBe(410);
    expect((err as Error).message).toBe('This call has ended');
  }
});
