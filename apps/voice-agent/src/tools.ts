/**
 * The two agent-facing tools: `send_prompt` (fire-and-forget hand-off to the
 * Kortix session) and `run_command` (short, waited-on sandbox check). See
 * instructions.ts for how the model is told to use them, and
 * kortix-client.ts for the HTTP calls they wrap.
 */
import { type FunctionTool, tool } from '@livekit/agents';
import { z } from 'zod';
import type { CallContext } from './call-context';
import { runCommandInSandbox, sendPromptToKortix } from './kortix-client';

const sendPromptParams = z.object({
  request: z
    .string()
    .min(1)
    .describe("What was asked, in the speaker's own words, plus who asked it."),
});

const runCommandParams = z.object({
  command: z
    .string()
    .min(1)
    .describe('The shell command to run, e.g. "cat package.json" or "ls -la".'),
  cwd: z
    .string()
    .optional()
    .describe('Working directory, relative to the project root. Defaults to the project root.'),
});

export interface VoiceTools {
  send_prompt: FunctionTool<{ request: string }, CallContext, string>;
  run_command: FunctionTool<{ command: string; cwd?: string }, CallContext, string>;
}

export function buildTools(): VoiceTools {
  // `tool()`'s type params (`UserData, Schema, Result`) must ALL be given
  // explicitly together: TypeScript disables contextual inference for the
  // rest of a generic call the moment any one type argument is written
  // explicitly, so `parameters`/`execute` would otherwise fall back to the
  // `Schema = undefined` default and fail to type-check against a real zod
  // schema.
  const send_prompt = tool<CallContext, typeof sendPromptParams, string>({
    name: 'send_prompt',
    description:
      'Hand a request to the Kortix agent for this project. Use for anything needing real ' +
      'information, project files, connectors, memory, or actions. Asynchronous: returns the ' +
      'instant the request is queued, not when Kortix has an answer — say one short sentence ' +
      'that you are checking, then stop talking. The answer arrives later as something to speak.',
    parameters: sendPromptParams,
    execute: async ({ request }, { ctx }) => {
      const call = ctx.userData;
      const result = await sendPromptToKortix(call, request);
      if (!result.ok) {
        return `Could not reach Kortix (${result.error}). Tell the room you could not send that request right now.`;
      }
      return (
        'Queued. Say one short sentence that you are checking, then stop talking — do not answer ' +
        'yet. The result will arrive later as a message for you to speak.'
      );
    },
  });

  const run_command = tool<CallContext, typeof runCommandParams, string>({
    name: 'run_command',
    description:
      "Run a shell command in this project's sandbox and get its output back directly — for " +
      'quick checks only (reading a short file, listing a directory, checking something exists). ' +
      'Waits a few seconds and returns the result. Not a hand-off: never use this for anything ' +
      'that changes real state or needs judgement — use send_prompt for that instead.',
    parameters: runCommandParams,
    execute: async ({ command, cwd }, { ctx }) => {
      const call = ctx.userData;
      const result = await runCommandInSandbox(call, command, cwd);

      if (!result.ok) {
        return `The command could not be run (${result.error}). Say briefly that the quick check failed and offer to hand it to send_prompt instead.`;
      }
      if (result.timedOut) {
        return "The command was still running after a few seconds so it was stopped. Say you're not sure and offer to hand it to send_prompt instead.";
      }

      const stdout = (result.stdout ?? '').trim();
      const stderr = (result.stderr ?? '').trim();
      const exitCode = result.exitCode;

      if (exitCode !== null && exitCode !== undefined && exitCode !== 0) {
        return `Command exited with code ${exitCode}. stderr: ${stderr.slice(0, 800) || '(empty)'}`;
      }
      if (stdout) return stdout.slice(0, 4000);
      if (stderr) return `(no stdout) stderr: ${stderr.slice(0, 800)}`;
      return '(no output)';
    },
  });

  return { send_prompt, run_command };
}
