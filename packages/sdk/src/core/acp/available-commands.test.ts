import { describe, expect, test } from 'bun:test';

import { acpAvailableCommandsToCommands, resolveSessionCommands } from './available-commands';

describe('acpAvailableCommandsToCommands', () => {
  test('projects a real available_commands_update payload into the published Command shape', () => {
    expect(
      acpAvailableCommandsToCommands([
        {
          name: 'agent-browser',
          description: 'Drive a real browser session',
        },
        { name: 'init', description: 'guided AGENTS.md setup' },
      ]),
    ).toEqual([
      {
        name: 'agent-browser',
        description: 'Drive a real browser session',
        template: '',
        hints: [],
      },
      { name: 'init', description: 'guided AGENTS.md setup', template: '', hints: [] },
    ]);
  });

  test('an unadvertised command list projects to an empty list', () => {
    expect(acpAvailableCommandsToCommands([])).toEqual([]);
    expect(acpAvailableCommandsToCommands(undefined)).toEqual([]);
  });

  test('drops entries without a usable name instead of rendering a nameless command', () => {
    expect(
      acpAvailableCommandsToCommands([
        { description: 'no name' },
        { name: '', description: 'empty name' },
        { name: 42 },
        { name: 'review' },
      ]),
    ).toEqual([{ name: 'review', template: '', hints: [] }]);
  });

  test('keeps a harness-supplied input hint as the command hint list', () => {
    expect(
      acpAvailableCommandsToCommands([{ name: 'review', input: { hint: '[commit|branch|pr]' } }]),
    ).toEqual([{ name: 'review', template: '', hints: ['[commit|branch|pr]'] }]);
  });

  test('never emits a non-string template, so template-based detection degrades instead of throwing', () => {
    const [command] = acpAvailableCommandsToCommands([{ name: 'review', template: { a: 1 } }]);
    expect(typeof command.template).toBe('string');
    expect(command.template).toBe('');
  });

  test('de-duplicates by name, keeping the first advertised entry', () => {
    expect(
      acpAvailableCommandsToCommands([
        { name: 'review', description: 'first' },
        { name: 'review', description: 'second' },
      ]),
    ).toEqual([{ name: 'review', description: 'first', template: '', hints: [] }]);
  });
});

describe('resolveSessionCommands', () => {
  const rest = [{ name: 'from-rest', template: 'from-rest $ARGUMENTS', hints: [] }];

  test('a runtime that serves OpenCode REST uses the REST command list', () => {
    expect(
      resolveSessionCommands({
        servesOpenCodeRest: true,
        rest,
        advertised: [{ name: 'from-acp' }],
      }),
    ).toEqual(rest);
  });

  test('a runtime that serves no OpenCode REST uses what ACP advertises', () => {
    expect(
      resolveSessionCommands({
        servesOpenCodeRest: false,
        rest,
        advertised: [{ name: 'from-acp', description: 'advertised' }],
      }),
    ).toEqual([{ name: 'from-acp', description: 'advertised', template: '', hints: [] }]);
  });

  test('an ACP runtime that has advertised nothing yet resolves to an empty list, never the REST list', () => {
    expect(resolveSessionCommands({ servesOpenCodeRest: false, rest, advertised: [] })).toEqual([]);
    expect(
      resolveSessionCommands({ servesOpenCodeRest: false, rest, advertised: undefined }),
    ).toEqual([]);
  });

  test('an unreachable REST runtime resolves to an empty list rather than undefined', () => {
    expect(
      resolveSessionCommands({ servesOpenCodeRest: true, rest: undefined, advertised: [] }),
    ).toEqual([]);
  });
});
