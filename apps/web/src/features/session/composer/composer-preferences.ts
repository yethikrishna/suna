'use client';

/**
 * Composer toolbar mode — 'simple' (default) shows attach + one overflow
 * control + the text area + send; 'advanced' shows the full dense toolbar
 * (agent, model, variant, reasoning effort all inline) exactly as it existed
 * before the simplification pass.
 *
 * This deliberately lives in its OWN small persisted store rather than being
 * folded into `useUserPreferencesStore` (`stores/user-preferences-store.ts`),
 * even though it follows that store's `panelMode: 'easy' | 'advanced'`
 * precedent closely (same shape, same `toggle*` treatment of a legacy
 * `undefined` value as the default). This composer work is scoped to files
 * under `features/session/composer/` and `session-chat-input.tsx` only —
 * `user-preferences-store.ts` is owned by other in-flight work, so this
 * preference is intentionally NOT merged into it here. It is a natural
 * follow-up to fold `composerMode` into `UserPreferences` alongside
 * `panelMode` for a single source of truth on "how much chrome does this
 * user want to see" — flagged for whoever picks that up next.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createSafeJSONStorage } from '@/lib/storage/managed-storage';

export type ComposerMode = 'simple' | 'advanced';

/**
 * Pure toggle helper — treats a legacy/undefined mode exactly like 'simple'
 * (mirrors `togglePanelMode`'s handling of legacy users whose persisted blob
 * predates the field). Extracted so the flip logic is testable without
 * mounting zustand.
 */
export function toggleComposerMode(current: ComposerMode | undefined): ComposerMode {
  const effective = current ?? 'simple';
  return effective === 'simple' ? 'advanced' : 'simple';
}

interface ComposerPreferencesState {
  mode: ComposerMode;
  setMode: (mode: ComposerMode) => void;
  toggleMode: () => void;
  resetMode: () => void;
}

export const useComposerPreferencesStore = create<ComposerPreferencesState>()(
  persist(
    (set, get) => ({
      mode: 'simple',

      setMode: (mode) => set({ mode }),

      toggleMode: () => set({ mode: toggleComposerMode(get().mode) }),

      resetMode: () => set({ mode: 'simple' }),
    }),
    {
      name: 'kortix-composer-preferences',
      storage: createSafeJSONStorage(),
    },
  ),
);
