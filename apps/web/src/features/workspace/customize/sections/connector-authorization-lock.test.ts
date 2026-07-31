import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

/**
 * The authorization owner is settled once a connector exists.
 *
 * Switching it afterwards silently changes WHOSE account every future session
 * runs as, and orphans the connection profiles and permission rules already
 * stored under the old owner — a change shaped like a toggle that behaves like a
 * migration.
 *
 * Locked in the UI ONLY: the mutation and its route are deliberately left in
 * place so re-enabling is deleting one prop. These assertions exist so that
 * "leave the backend for later" does not quietly become "the backend rotted".
 */
const SECTIONS = import.meta.dir;
const VIEW = readFileSync(join(SECTIONS, 'connectors-view.tsx'), 'utf8');
const MODAL = readFileSync(join(SECTIONS, 'connector-profile-modal.tsx'), 'utf8');

describe('connector authorization owner is locked after creation', () => {
  test('the detail page passes a lockedReason', () => {
    expect(VIEW).toContain('lockedReason=');
  });

  test('exactly ONE call site is locked — the create flow must stay editable', () => {
    // Two call sites exist: the existing-connector detail page and the
    // custom-connector draft. Locking the draft too would make it impossible to
    // pick an owner at all.
    expect(VIEW.match(/lockedReason=/g)?.length ?? 0).toBe(1);
  });

  test('a lockedReason forces the control off even when disabled is false', () => {
    // Guards the mechanism, not the copy: passing the reason must be sufficient
    // on its own, so a future caller cannot lock the text while leaving the
    // select live.
    expect(MODAL).toContain('disabled={disabled || pending || locked}');
  });

  test('the lock REPLACES the description rather than leaving stale help text', () => {
    // A disabled select under unchanged help reads as a bug — the user tries it,
    // nothing happens, nothing says why.
    expect(MODAL).toContain('{lockedReason ??');
  });

  test('the backend path is still wired, so this stays a one-prop revert', () => {
    expect(VIEW).toContain('updateAuthorizationStrategy');
  });
});
