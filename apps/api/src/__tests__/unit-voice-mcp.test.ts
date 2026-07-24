import { describe, expect, test } from 'bun:test';
import { handleVoiceMcp, type VoiceMcpContext } from '../channels/voice/mcp';

function ctx(overrides: Partial<VoiceMcpContext> = {}): VoiceMcpContext {
  return {
    projectId: 'proj-1',
    sessionId: 'sess-1',
    spawn: async () => ({ callId: 'sess-1', botId: 'bot-1' }),
    ...overrides,
  };
}

async function call(method: string, params?: Record<string, unknown>, c = ctx()) {
  return (await handleVoiceMcp(c, { jsonrpc: '2.0', id: 1, method, params })) as any;
}

describe('voice MCP', () => {
  test('initialize advertises tools', async () => {
    const res = await call('initialize');
    expect(res.result.serverInfo.name).toBe('kortix-voice');
    expect(res.result.capabilities.tools).toBeDefined();
  });

  test('notifications/initialized returns nothing (it is a notification)', async () => {
    expect(await handleVoiceMcp(ctx(), { jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
  });

  test('exposes exactly the non-blocking tool set', async () => {
    const res = await call('tools/list');
    const names = res.result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(['voice_end', 'voice_prompt', 'voice_read', 'voice_spawn', 'voice_status']);
    // A follow/tail/stream tool would wedge the single-threaded agent loop. If
    // one ever appears here, that is the bug this assertion exists to catch.
    expect(names.some((n: string) => /follow|tail|stream|wait/.test(n))).toBe(false);
  });

  test('voice_spawn returns a call id immediately and says the call is backgrounded', async () => {
    const res = await call('tools/call', { name: 'voice_spawn', arguments: { meeting_url: 'https://meet.google.com/x' } });
    expect(res.result.structuredContent.call_id).toBe('sess-1');
    expect(res.result.structuredContent.cursor).toBe(0);
    expect(res.result.content[0].text).toContain('background');
  });

  test('voice_spawn passes the chosen voice through', async () => {
    let seen: string | null | undefined;
    const c = ctx({
      spawn: async ({ voice }) => {
        seen = voice;
        return { callId: 'sess-1', botId: null };
      },
    });
    await call('tools/call', { name: 'voice_spawn', arguments: { meeting_url: 'u', voice: 'rex' } }, c);
    expect(seen).toBe('rex');
  });

  test('voice_spawn requires a meeting url', async () => {
    const res = await call('tools/call', { name: 'voice_spawn', arguments: {} });
    expect(res.result.isError).toBe(true);
  });

  test('a spawn failure comes back as a tool error, not a protocol error', async () => {
    // The agent can read and react to a tool error; a JSON-RPC error usually
    // just aborts its turn.
    const c = ctx({
      spawn: async () => {
        throw new Error('could not join the meeting: connector_not_found');
      },
    });
    const res = await call('tools/call', { name: 'voice_spawn', arguments: { meeting_url: 'u' } }, c);
    expect(res.error).toBeUndefined();
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('connector_not_found');
  });

  test('voice_prompt on a call that is not live reports it instead of pretending', async () => {
    const res = await call('tools/call', { name: 'voice_prompt', arguments: { call_id: 'nope', text: 'hi' } });
    expect(res.result.isError).toBe(true);
  });

  test('unknown tool is an error, not a crash', async () => {
    const res = await call('tools/call', { name: 'voice_follow', arguments: {} });
    expect(res.result.isError).toBe(true);
  });

  test('unknown method is a JSON-RPC method-not-found', async () => {
    const res = await call('resources/list');
    expect(res.error.code).toBe(-32601);
  });
});
