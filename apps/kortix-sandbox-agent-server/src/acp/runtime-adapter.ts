import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const RUNTIME_HARNESS_IDS = [
  'opencode',
  'claude',
  'codex',
  'pi',
] as const

export type RuntimeHarness = (typeof RUNTIME_HARNESS_IDS)[number]

export type RuntimeLaunch = {
  command: string
  args: string[]
  env: Record<string, string>
}

export type RuntimeAdapter = {
  id: RuntimeHarness
  launch: RuntimeLaunch
  resumeMethod: 'session/resume' | 'session/load'
  supportsOpenCodeRest: boolean
  supportsOpenCodeEvents: boolean
  supportsOpenCodeConfig: boolean
  isReady(connection: { ready: boolean } | null): boolean
}

const RUNTIME_HARNESS_SET = new Set<string>(RUNTIME_HARNESS_IDS)
const CLAUDE_GATEWAY_DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6'

export function resolveRuntimeHarness(
  env: NodeJS.ProcessEnv,
): RuntimeHarness {
  if (!Object.prototype.hasOwnProperty.call(env, 'KORTIX_RUNTIME_HARNESS')) {
    return 'opencode'
  }
  const value = env.KORTIX_RUNTIME_HARNESS?.trim().toLowerCase() ?? ''
  if (RUNTIME_HARNESS_SET.has(value)) return value as RuntimeHarness
  throw new Error(
    `KORTIX_RUNTIME_HARNESS must be one of: ${RUNTIME_HARNESS_IDS.join(', ')}`,
  )
}

function managedGatewayEnv(
  harness: RuntimeHarness,
  env: NodeJS.ProcessEnv,
): Record<string, string> {
  const apiUrl = env.KORTIX_API_URL?.trim().replace(/\/+$/, '')
  const token = env.KORTIX_TOKEN?.trim()
  const llmBaseUrl = env.KORTIX_LLM_BASE_URL?.trim().replace(/\/+$/, '')
  const llmToken = env.KORTIX_LLM_API_KEY?.trim()
  const runtimeModel = env.KORTIX_RUNTIME_MODEL?.trim()

  if (harness === 'claude') {
    if (
      env.ANTHROPIC_API_KEY?.trim() ||
      env.ANTHROPIC_AUTH_TOKEN?.trim() ||
      env.CLAUDE_CODE_OAUTH_TOKEN?.trim()
    ) {
      const claudeModel = runtimeModel
        ? runtimeModel.startsWith('anthropic/')
          ? runtimeModel.replace(/^anthropic\//, '')
          : CLAUDE_GATEWAY_DEFAULT_MODEL.replace(/^anthropic\//, '')
        : undefined
      return {
        IS_SANDBOX: '1',
        ...(claudeModel ? { ANTHROPIC_MODEL: claudeModel } : {}),
      }
    }
    if (llmBaseUrl && llmToken) {
      return {
        IS_SANDBOX: '1',
        ANTHROPIC_BASE_URL: llmBaseUrl,
        ANTHROPIC_AUTH_TOKEN: llmToken,
        ...(runtimeModel ? { ANTHROPIC_MODEL: runtimeModel } : {}),
      }
    }
    const claudeModel = runtimeModel
      ? runtimeModel.startsWith('anthropic/')
        ? runtimeModel.replace(/^anthropic\//, '')
        : CLAUDE_GATEWAY_DEFAULT_MODEL.replace(/^anthropic\//, '')
      : undefined
    return {
      IS_SANDBOX: '1',
      ...(apiUrl && token
        ? {
            ANTHROPIC_BASE_URL: `${apiUrl}/router/anthropic`,
            ANTHROPIC_AUTH_TOKEN: token,
          }
        : {}),
      ...(claudeModel ? { ANTHROPIC_MODEL: claudeModel } : {}),
    }
  }

  if (harness === 'codex') {
    if (
      env.OPENAI_API_KEY?.trim() ||
      env.CODEX_API_KEY?.trim()
    ) {
      return runtimeModel
        ? {
            CODEX_CONFIG: JSON.stringify({
              model: runtimeModel.replace(/^openai\//, ''),
            }),
          }
        : {}
    }
    const gatewayBaseUrl = llmBaseUrl || (apiUrl ? `${apiUrl}/router/openai` : '')
    const gatewayToken = llmToken || token
    if (!gatewayBaseUrl || !gatewayToken) return {}
    return {
      NO_BROWSER: '1',
      ...(runtimeModel
        ? { CODEX_CONFIG: JSON.stringify({ model: runtimeModel }) }
        : {}),
      DEFAULT_AUTH_REQUEST: JSON.stringify({
        methodId: 'gateway',
        _meta: {
          gateway: {
            baseUrl: gatewayBaseUrl,
            providerName: 'Kortix Gateway',
            headers: { Authorization: `Bearer ${gatewayToken}` },
          },
        },
      }),
    }
  }

  if (harness === 'pi') {
    if (env.OPENAI_API_KEY?.trim() || env.CODEX_API_KEY?.trim()) {
      return {
        PI_TELEMETRY: '0',
        ...(runtimeModel
          ? {
              KORTIX_PI_SETTINGS_JSON: JSON.stringify({
                defaultProvider: 'openai',
                defaultModel: runtimeModel.replace(/^openai\//, ''),
              }),
            }
          : {}),
      }
    }
    const model = runtimeModel || 'gpt-5.4'
    const gatewayBaseUrl = llmBaseUrl || (apiUrl ? `${apiUrl}/router/openai` : '')
    const gatewayToken = llmToken || token
    return {
      PI_TELEMETRY: '0',
      ...(gatewayBaseUrl && gatewayToken
        ? {
            KORTIX_PI_MODELS_JSON: JSON.stringify({
              providers: {
                kortix: {
                  baseUrl: gatewayBaseUrl,
                  api: 'openai-responses',
                  apiKey: llmToken
                    ? '$KORTIX_LLM_API_KEY'
                    : '$KORTIX_TOKEN',
                  authHeader: true,
                  models: [
                    {
                      id: model,
                      name: model,
                      reasoning: true,
                      input: ['text', 'image'],
                      contextWindow: 400000,
                      maxTokens: 128000,
                    },
                  ],
                },
              },
            }),
            KORTIX_PI_SETTINGS_JSON: JSON.stringify({
              defaultProvider: 'kortix',
              defaultModel: model,
            }),
          }
        : {}),
    }
  }

  return { OPENCODE_ENABLE_QUESTION_TOOL: '1' }
}

function readJsonObject(path: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/**
 * Materialize Pi's native configuration before pi-acp starts.
 *
 * Sandbox env assembly cannot write guest files. Pi reads models.json and
 * settings.json instead of the KORTIX_PI_* transport variables.
 */
export function materializeRuntimeAdapterConfig(
  harness: RuntimeHarness,
  env: NodeJS.ProcessEnv,
): void {
  if (harness !== 'pi') return

  const modelsJson = env.KORTIX_PI_MODELS_JSON?.trim()
  const settingsJson = env.KORTIX_PI_SETTINGS_JSON?.trim()
  delete env.KORTIX_PI_MODELS_JSON
  delete env.KORTIX_PI_SETTINGS_JSON
  if (!modelsJson && !settingsJson) return

  const agentDir =
    env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), '.pi', 'agent')
  mkdirSync(agentDir, { recursive: true })

  if (modelsJson) {
    const next = JSON.parse(modelsJson) as Record<string, unknown>
    const path = join(agentDir, 'models.json')
    const current = readJsonObject(path)
    const currentProviders =
      current.providers &&
      typeof current.providers === 'object' &&
      !Array.isArray(current.providers)
        ? (current.providers as Record<string, unknown>)
        : {}
    const nextProviders =
      next.providers &&
      typeof next.providers === 'object' &&
      !Array.isArray(next.providers)
        ? (next.providers as Record<string, unknown>)
        : {}
    writeFileSync(
      path,
      JSON.stringify({
        ...current,
        ...next,
        providers: { ...currentProviders, ...nextProviders },
      }),
      { mode: 0o600 },
    )
  }

  if (settingsJson) {
    const next = JSON.parse(settingsJson) as Record<string, unknown>
    const path = join(agentDir, 'settings.json')
    writeFileSync(
      path,
      JSON.stringify({ ...readJsonObject(path), ...next }),
      { mode: 0o600 },
    )
  }
}

export function isolateRuntimeAuthEnv(
  harness: RuntimeHarness,
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const isolated = { ...env }
  if (harness === 'claude') {
    for (const name of [
      'OPENAI_API_KEY',
      'CODEX_API_KEY',
      'CODEX_AUTH_JSON',
      'OPENCODE_AUTH_JSON',
    ]) {
      delete isolated[name]
    }
  } else if (harness === 'codex' || harness === 'pi') {
    for (const name of [
      'ANTHROPIC_API_KEY',
      'ANTHROPIC_AUTH_TOKEN',
      'CLAUDE_CODE_OAUTH_TOKEN',
    ]) {
      delete isolated[name]
    }
    delete isolated.CODEX_AUTH_JSON
    delete isolated.OPENCODE_AUTH_JSON
  }
  return isolated
}

export function resolveRuntimeAdapter(
  harness: RuntimeHarness,
  options: {
    cwd: string
    port: number
    env: NodeJS.ProcessEnv
  },
): RuntimeAdapter {
  const launchByHarness: Record<RuntimeHarness, RuntimeLaunch> = {
    opencode: {
      command: 'opencode',
      args: [
        'acp',
        '--port',
        String(options.port),
        '--hostname',
        '127.0.0.1',
        '--cwd',
        options.cwd,
      ],
      env: managedGatewayEnv('opencode', options.env),
    },
    claude: {
      command: 'claude-agent-acp',
      args: [],
      env: managedGatewayEnv('claude', options.env),
    },
    codex: {
      command: 'codex-acp',
      args: [],
      env: managedGatewayEnv('codex', options.env),
    },
    pi: {
      command: 'pi-acp',
      args: [],
      env: managedGatewayEnv('pi', options.env),
    },
  }

  return {
    id: harness,
    launch: launchByHarness[harness],
    // pi-acp 0.0.31 implements session/load but does not register
    // session/resume. The daemon maps ACP resume requests to its load method.
    resumeMethod: harness === 'pi' ? 'session/load' : 'session/resume',
    supportsOpenCodeRest: harness === 'opencode',
    supportsOpenCodeEvents: harness === 'opencode',
    supportsOpenCodeConfig: harness === 'opencode',
    isReady: (connection) => connection?.ready === true,
  }
}
