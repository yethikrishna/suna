import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  RUNTIME_HARNESS_IDS,
  isolateRuntimeAuthEnv,
  materializeRuntimeAdapterConfig,
  resolveRuntimeAdapter,
  resolveRuntimeHarness,
} from './runtime-adapter'

const tempDirs: string[] = []

afterEach(() => {
  for (const path of tempDirs.splice(0)) {
    rmSync(path, { recursive: true, force: true })
  }
})

describe('ACP runtime adapters', () => {
  test('defaults to OpenCode when KORTIX_RUNTIME_HARNESS is absent', () => {
    expect(resolveRuntimeHarness({})).toBe('opencode')
  })

  test.each([...RUNTIME_HARNESS_IDS])('resolves the %s harness', (harness) => {
    expect(resolveRuntimeHarness({ KORTIX_RUNTIME_HARNESS: harness })).toBe(harness)
  })

  test('rejects an empty explicit harness', () => {
    expect(() =>
      resolveRuntimeHarness({ KORTIX_RUNTIME_HARNESS: '   ' }),
    ).toThrow('KORTIX_RUNTIME_HARNESS')
  })

  test('rejects an unknown harness', () => {
    expect(() =>
      resolveRuntimeHarness({ KORTIX_RUNTIME_HARNESS: 'unknown' }),
    ).toThrow('KORTIX_RUNTIME_HARNESS')
  })

  test('defines one ACP launch descriptor for every runtime', () => {
    const launches = Object.fromEntries(
      RUNTIME_HARNESS_IDS.map((harness) => [
        harness,
        resolveRuntimeAdapter(harness, {
          cwd: '/workspace',
          port: 4096,
          env: {},
        }).launch,
      ]),
    )

    expect(launches).toEqual({
      opencode: {
        command: 'opencode',
        args: [
          'acp',
          '--port',
          '4096',
          '--hostname',
          '127.0.0.1',
          '--cwd',
          '/workspace',
        ],
        env: { OPENCODE_ENABLE_QUESTION_TOOL: '1' },
      },
      claude: {
        command: 'claude-agent-acp',
        args: [],
        env: { IS_SANDBOX: '1' },
      },
      codex: {
        command: 'codex-acp',
        args: [],
        env: {},
      },
      pi: {
        command: 'pi-acp',
        args: [],
        env: { PI_TELEMETRY: '0' },
      },
    })
  })

  test('uses the initialized ACP connection as readiness for every runtime', () => {
    for (const harness of RUNTIME_HARNESS_IDS) {
      const adapter = resolveRuntimeAdapter(harness, {
        cwd: '/workspace',
        port: 4096,
        env: {},
      })
      expect(adapter.isReady({ ready: false })).toBe(false)
      expect(adapter.isReady({ ready: true })).toBe(true)
    }
  })

  test('uses direct provider keys before managed gateway configuration', () => {
    const apiEnv = {
      KORTIX_API_URL: 'https://api.kortix.test/v1',
      KORTIX_TOKEN: 'sandbox-token',
    }
    expect(
      resolveRuntimeAdapter('claude', {
        cwd: '/workspace',
        port: 4096,
        env: { ...apiEnv, ANTHROPIC_API_KEY: 'anthropic-key' },
      }).launch.env,
    ).not.toHaveProperty('ANTHROPIC_BASE_URL')
    expect(
      resolveRuntimeAdapter('codex', {
        cwd: '/workspace',
        port: 4096,
        env: { ...apiEnv, OPENAI_API_KEY: 'openai-key' },
      }).launch.env,
    ).not.toHaveProperty('DEFAULT_AUTH_REQUEST')
    expect(
      resolveRuntimeAdapter('pi', {
        cwd: '/workspace',
        port: 4096,
        env: { ...apiEnv, OPENAI_API_KEY: 'openai-key' },
      }).launch.env,
    ).not.toHaveProperty('KORTIX_PI_MODELS_JSON')
  })

  test('maps the managed gateway for Claude, Codex, and Pi', () => {
    const options = {
      cwd: '/workspace',
      port: 4096,
      env: {
        KORTIX_API_URL: 'https://api.kortix.test/v1',
        KORTIX_TOKEN: 'sandbox-token',
        KORTIX_LLM_BASE_URL: 'https://gateway.kortix.test/v1/llm',
        KORTIX_LLM_API_KEY: 'gateway-token',
      },
    }
    const claude = resolveRuntimeAdapter('claude', options).launch.env
    const codex = resolveRuntimeAdapter('codex', options).launch.env
    const pi = resolveRuntimeAdapter('pi', options).launch.env

    expect(claude.ANTHROPIC_BASE_URL).toBe(
      'https://gateway.kortix.test/v1/llm',
    )
    expect(claude.ANTHROPIC_AUTH_TOKEN).toBe('gateway-token')
    expect(codex.DEFAULT_AUTH_REQUEST).toContain(
      'https://gateway.kortix.test/v1/llm',
    )
    expect(pi.KORTIX_PI_MODELS_JSON).toContain(
      'https://gateway.kortix.test/v1/llm',
    )
    expect(pi.KORTIX_PI_MODELS_JSON).toContain(
      '$KORTIX_LLM_API_KEY',
    )
    expect(pi.KORTIX_PI_SETTINGS_JSON).toBe(
      JSON.stringify({
        defaultProvider: 'kortix',
        defaultModel: 'gpt-5.4',
      }),
    )
  })

  test('normalizes provider-qualified models for native harnesses', () => {
    const base = { cwd: '/workspace', port: 4096 }
    const claude = resolveRuntimeAdapter('claude', {
      ...base,
      env: {
        ANTHROPIC_API_KEY: 'anthropic-key',
        KORTIX_RUNTIME_MODEL: 'anthropic/claude-sonnet-4-20250514',
      },
    }).launch.env
    const codex = resolveRuntimeAdapter('codex', {
      ...base,
      env: {
        OPENAI_API_KEY: 'openai-key',
        KORTIX_RUNTIME_MODEL: 'openai/gpt-4.1-mini',
      },
    }).launch.env
    const pi = resolveRuntimeAdapter('pi', {
      ...base,
      env: {
        OPENAI_API_KEY: 'openai-key',
        KORTIX_RUNTIME_MODEL: 'openai/gpt-4.1-mini',
      },
    }).launch.env

    expect(claude.ANTHROPIC_MODEL).toBe('claude-sonnet-4-20250514')
    expect(JSON.parse(codex.CODEX_CONFIG!)).toEqual({
      model: 'gpt-4.1-mini',
    })
    expect(JSON.parse(pi.KORTIX_PI_SETTINGS_JSON!)).toEqual({
      defaultProvider: 'openai',
      defaultModel: 'gpt-4.1-mini',
    })
  })

  test('uses an Anthropic model when the project default is not Claude-compatible', () => {
    const base = {
      cwd: '/workspace',
      port: 4096,
      KORTIX_RUNTIME_MODEL: 'openai/gpt-5.5',
    }
    const direct = resolveRuntimeAdapter('claude', {
      cwd: base.cwd,
      port: base.port,
      env: {
        KORTIX_RUNTIME_MODEL: base.KORTIX_RUNTIME_MODEL,
        ANTHROPIC_API_KEY: 'anthropic-key',
      },
    }).launch.env
    const managed = resolveRuntimeAdapter('claude', {
      cwd: base.cwd,
      port: base.port,
      env: {
        KORTIX_RUNTIME_MODEL: base.KORTIX_RUNTIME_MODEL,
        KORTIX_LLM_BASE_URL: 'https://gateway.kortix.test/v1/llm',
        KORTIX_LLM_API_KEY: 'gateway-token',
      },
    }).launch.env

    expect(direct.ANTHROPIC_MODEL).toBe('claude-sonnet-4-6')
    expect(managed.ANTHROPIC_MODEL).toBe('openai/gpt-5.5')
  })

  test('materializes and merges Pi models and settings files', () => {
    const agentDir = mkdtempSync(join(tmpdir(), 'kortix-pi-config-'))
    tempDirs.push(agentDir)
    writeFileSync(
      join(agentDir, 'models.json'),
      JSON.stringify({ providers: { existing: { models: [] } } }),
    )
    writeFileSync(
      join(agentDir, 'settings.json'),
      JSON.stringify({ quietStartup: true }),
    )
    const env: NodeJS.ProcessEnv = {
      PI_CODING_AGENT_DIR: agentDir,
      KORTIX_PI_MODELS_JSON: JSON.stringify({
        providers: { kortix: { models: [{ id: 'gpt-5.4' }] } },
      }),
      KORTIX_PI_SETTINGS_JSON: JSON.stringify({
        defaultProvider: 'kortix',
        defaultModel: 'gpt-5.4',
      }),
    }

    materializeRuntimeAdapterConfig('pi', env)

    expect(
      JSON.parse(readFileSync(join(agentDir, 'models.json'), 'utf8')),
    ).toEqual({
      providers: {
        existing: { models: [] },
        kortix: { models: [{ id: 'gpt-5.4' }] },
      },
    })
    expect(
      JSON.parse(readFileSync(join(agentDir, 'settings.json'), 'utf8')),
    ).toEqual({
      quietStartup: true,
      defaultProvider: 'kortix',
      defaultModel: 'gpt-5.4',
    })
    expect(env.KORTIX_PI_MODELS_JSON).toBeUndefined()
    expect(env.KORTIX_PI_SETTINGS_JSON).toBeUndefined()
  })

  test('does not expose unrelated or unsupported subscription credentials', () => {
    const raw = {
      ANTHROPIC_API_KEY: 'anthropic-key',
      OPENAI_API_KEY: 'openai-key',
      CODEX_AUTH_JSON: 'subscription-secret',
      OPENCODE_AUTH_JSON: 'opencode-secret',
    }
    const claude = isolateRuntimeAuthEnv('claude', raw)
    const codex = isolateRuntimeAuthEnv('codex', raw)

    expect(claude.ANTHROPIC_API_KEY).toBe('anthropic-key')
    expect(claude.OPENAI_API_KEY).toBeUndefined()
    expect(claude.CODEX_AUTH_JSON).toBeUndefined()
    expect(codex.OPENAI_API_KEY).toBe('openai-key')
    expect(codex.ANTHROPIC_API_KEY).toBeUndefined()
    expect(codex.CODEX_AUTH_JSON).toBeUndefined()
    expect(codex.OPENCODE_AUTH_JSON).toBeUndefined()
  })
})
