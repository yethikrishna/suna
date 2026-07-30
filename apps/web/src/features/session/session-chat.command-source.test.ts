import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const sessionChat = readFileSync(new URL('./session-chat.tsx', import.meta.url), 'utf8');
const subSessionModal = readFileSync(new URL('./sub-session-modal.tsx', import.meta.url), 'utf8');

test('the root session reads its slash commands from the SDK transport-resolved list', () => {
  expect(sessionChat).toContain('sessionState.runtimeCommands');
  expect(sessionChat).not.toMatch(/const \{ data: commands \} = useRuntimeCommands\(\)/);
});

test('a read-only child session without SDK session state still falls back to the REST list', () => {
  expect(sessionChat).toContain('sessionState ? sessionState.runtimeCommands : restCommands');
});

test('the session command source never branches on the harness name', () => {
  expect(sessionChat).not.toMatch(/runtimeHarness\s*===\s*['"](claude|codex|opencode|pi)['"]/);
});

test('the sub-session modal gives its inner chat a project-scoped agent roster', () => {
  expect(subSessionModal).toContain('useParams');
  expect(subSessionModal).toContain('projectId={routeParams?.id}');
});
