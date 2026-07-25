import { beforeEach, describe, expect, it, test } from 'bun:test';

import { toggleComposerMode, useComposerPreferencesStore } from './composer-preferences';

describe('toggleComposerMode (pure)', () => {
  test('flips simple -> advanced', () => {
    expect(toggleComposerMode('simple')).toBe('advanced');
  });

  test('flips advanced -> simple', () => {
    expect(toggleComposerMode('advanced')).toBe('simple');
  });

  test('treats a legacy/undefined mode as simple and flips to advanced', () => {
    expect(toggleComposerMode(undefined)).toBe('advanced');
  });
});

describe('useComposerPreferencesStore', () => {
  beforeEach(() => {
    useComposerPreferencesStore.getState().resetMode();
  });

  it('defaults to simple for new users', () => {
    expect(useComposerPreferencesStore.getState().mode).toBe('simple');
  });

  it('setMode switches to advanced', () => {
    useComposerPreferencesStore.getState().setMode('advanced');
    expect(useComposerPreferencesStore.getState().mode).toBe('advanced');
  });

  it('toggleMode flips between the two modes', () => {
    const { toggleMode } = useComposerPreferencesStore.getState();
    toggleMode();
    expect(useComposerPreferencesStore.getState().mode).toBe('advanced');
    toggleMode();
    expect(useComposerPreferencesStore.getState().mode).toBe('simple');
  });

  it('resetMode restores simple', () => {
    useComposerPreferencesStore.getState().setMode('advanced');
    useComposerPreferencesStore.getState().resetMode();
    expect(useComposerPreferencesStore.getState().mode).toBe('simple');
  });
});
