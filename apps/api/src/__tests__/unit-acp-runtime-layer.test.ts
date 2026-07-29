import { describe, expect, test } from 'bun:test';
import {
  CLAUDE_AGENT_ACP_VERSION,
  CLAUDE_CODE_VERSION,
  CODEX_ACP_VERSION,
  CODEX_CLI_VERSION,
  PI_ACP_VERSION,
  PI_CODING_AGENT_VERSION,
} from '@kortix/shared';

import {
  PLATFORM_DEFAULT_USER_DOCKERFILE,
  buildLayeredDockerfile,
} from '../snapshots/dockerfile-layer';

describe('ACP sandbox runtime layer', () => {
  test('bakes every ACP adapter and native harness at an exact version', () => {
    const dockerfile = buildLayeredDockerfile({
      userDockerfile: PLATFORM_DEFAULT_USER_DOCKERFILE,
      opencodeVersion: '1.17.11',
      agentBinaryPath: 'kortix-agent.gz',
      cliBinaryPath: 'kortix.gz',
      entrypointScriptPath: 'kortix-entrypoint',
      machineDocPath: 'MACHINE.md',
      slackCliPath: 'kortix-slack-cli',
      executorSdkPath: 'kortix-executor-sdk',
    });

    for (const pin of [
      `@agentclientprotocol/claude-agent-acp@${CLAUDE_AGENT_ACP_VERSION}`,
      `@agentclientprotocol/codex-acp@${CODEX_ACP_VERSION}`,
      `pi-acp@${PI_ACP_VERSION}`,
      `@earendil-works/pi-coding-agent@${PI_CODING_AGENT_VERSION}`,
      `@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}`,
      `@openai/codex@${CODEX_CLI_VERSION}`,
    ]) {
      expect(dockerfile).toContain(pin);
    }

    for (const executable of [
      'claude-agent-acp',
      'codex-acp',
      'pi-acp',
      'pi',
      'claude',
      'codex',
    ]) {
      expect(dockerfile).toContain(`command -v ${executable}`);
    }
  });
});
