import { describe, expect, test } from 'bun:test';
import { handleVoiceMcp, type VoiceMcpContext } from '../channels/voice/mcp';

function ctx(overrides: Partial<VoiceMcpContext> = {}): VoiceMcpContext {
  return {
    projectId: 'proj-1',
    sessionId: 'sess-1',
    spawn: async () => ({ callId: 'sess-1', joinUrl: 'https://app.example.com/voice/tok' }),
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

  test('exposes exactly the non-blocking (or short-bounded) tool set', async () => {
    const res = await call('tools/list');
    const names = res.result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(['run_command', 'send_prompt', 'voice_end', 'voice_read', 'voice_spawn']);
    // A follow/tail/stream tool would wedge the single-threaded agent loop. If
    // one ever appears here, that is the bug this assertion exists to catch.
    // run_command is the one deliberate, SHORT-bounded exception (see mcp.ts).
    expect(names.some((n: string) => /follow|tail|stream|wait/.test(n))).toBe(false);
  });

  test('voice_spawn returns a call id + join link immediately and says the call is backgrounded', async () => {
    const res = await call('tools/call', { name: 'voice_spawn', arguments: {} });
    expect(res.result.structuredContent.call_id).toBe('sess-1');
    expect(res.result.structuredContent.join_url).toBe('https://app.example.com/voice/tok');
    expect(res.result.structuredContent.cursor).toBe(0);
    expect(res.result.content[0].text).toContain('background');
    expect(res.result.content[0].text).toContain('https://app.example.com/voice/tok');
  });

  test('voice_spawn passes the chosen voice through', async () => {
    let seen: string | null | undefined;
    const c = ctx({
      spawn: async ({ voice }) => {
        seen = voice;
        return { callId: 'sess-1', joinUrl: 'https://app.example.com/voice/tok' };
      },
    });
    await call('tools/call', { name: 'voice_spawn', arguments: { voice: 'rex' } }, c);
    expect(seen).toBe('rex');
  });

  test('voice_spawn takes no meeting_url — nothing to join externally', async () => {
    const res = await call('tools/call', { name: 'voice_spawn', arguments: {} });
    expect(res.result.isError).toBeUndefined();
  });

  test('voice_spawn declares an action surface: spawn_room (default, implemented) plus join_gmeet/join_zoom', async () => {
    const res = await call('tools/list');
    const spawn = res.result.tools.find((t: { name: string }) => t.name === 'voice_spawn');
    expect(spawn.inputSchema.properties.action.enum).toEqual(['spawn_room', 'join_gmeet', 'join_zoom']);
  });

  test('voice_spawn leaves the action unset by default — the connector decides spawn_room', async () => {
    let seenAction: string | null | undefined = 'unset';
    const c = ctx({
      spawn: async ({ action }) => {
        seenAction = action;
        return { callId: 'sess-1', joinUrl: 'https://app.example.com/voice/tok' };
      },
    });
    await call('tools/call', { name: 'voice_spawn', arguments: {} }, c);
    expect(seenAction).toBeNull();
  });

  test('voice_spawn passes an explicit action + meeting_url through', async () => {
    let seen: { action?: string | null; meetingUrl?: string | null } = {};
    const c = ctx({
      spawn: async ({ action, meetingUrl }) => {
        seen = { action, meetingUrl };
        return { callId: 'sess-1', joinUrl: 'https://app.example.com/voice/tok' };
      },
    });
    await call(
      'tools/call',
      { name: 'voice_spawn', arguments: { action: 'join_gmeet', meeting_url: 'https://meet.google.com/abc-defg-hij' } },
      c,
    );
    expect(seen.action).toBe('join_gmeet');
    expect(seen.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
  });

  test('a not-implemented action (join_gmeet/join_zoom) surfaces as a tool error pointing back at spawn_room', async () => {
    const c = ctx({
      spawn: async ({ action }) => {
        if (action === 'join_gmeet' || action === 'join_zoom') {
          const platform = action === 'join_gmeet' ? 'Google Meet' : 'Zoom';
          throw new Error(
            `joining an existing ${platform} is not supported yet — use spawn_room and share the join link instead`,
          );
        }
        return { callId: 'sess-1', joinUrl: 'https://app.example.com/voice/tok' };
      },
    });
    const res = await call('tools/call', { name: 'voice_spawn', arguments: { action: 'join_zoom' } }, c);
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('not supported yet');
    expect(res.result.content[0].text).toContain('spawn_room');
  });

  test('a spawn failure comes back as a tool error, not a protocol error', async () => {
    // The agent can read and react to a tool error; a JSON-RPC error usually
    // just aborts its turn.
    const c = ctx({
      spawn: async () => {
        throw new Error('voice is not enabled for this project — turn it on in Settings first');
      },
    });
    const res = await call('tools/call', { name: 'voice_spawn', arguments: {} }, c);
    expect(res.error).toBeUndefined();
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('not enabled');
  });

  test('send_prompt on a call that is not live reports it instead of pretending', async () => {
    const res = await call('tools/call', { name: 'send_prompt', arguments: { call_id: 'nope', text: 'hi' } });
    expect(res.result.isError).toBe(true);
  });

  test('run_command on a call that is not live reports it instead of pretending', async () => {
    const res = await call('tools/call', { name: 'run_command', arguments: { call_id: 'nope', command: 'echo hi' } });
    expect(res.result.isError).toBe(true);
  });

  test('run_command requires call_id and command', async () => {
    const res = await call('tools/call', { name: 'run_command', arguments: { call_id: 'sess-1' } });
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
