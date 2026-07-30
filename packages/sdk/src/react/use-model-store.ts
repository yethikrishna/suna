'use client';

/**
 * React port of the SolidJS `context/models.tsx` from the OpenCode reference app.
 *
 * Provides:
 * - Model visibility (show/hide per model, persisted in localStorage)
 * - Recent models (up to 5, persisted)
 * - "Latest" logic (models released within 6 months, newest per family shown by default)
 * - Variant persistence per model
 *
 * Uses localStorage instead of Solid's persisted store, with a React-compatible
 * zustand-like pattern via useState + useCallback.
 */

import {
  DEFAULT_MANAGED_MODEL_IDS,
  MANAGED_FLAGSHIP_MODEL_ID,
  defaultEnabledModelIds,
} from '@kortix/llm-catalog';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { safeSetItem } from '../platform/storage/managed-storage';
import type { FlatModel } from './model-flatten';
import { createModelLookup } from './model-lookup';
import { shouldSetSessionAgentName } from './session-agent-name-guard';

// ============================================================================
// Types
// ============================================================================

export type ModelKey = {
  providerID: string;
  modelID: string;
  /**
   * The REAL upstream provider a `kortix`-gateway model resolves against
   * ('anthropic', 'openai', 'codex', 'kortix', ...) — see `FlatModel.provider`
   * (model-flatten.ts). When present, `subProviderOf` uses it directly instead
   * of parsing `modelID`, so connection-gating never depends on the wire id
   * happening to be namespaced `<provider>/<model>`. Optional so every
   * existing caller (which only ever had `providerID`/`modelID`) keeps
   * compiling unchanged.
   */
  provider?: string;
};

// ── Gateway wire-model ⟷ ModelKey conversion ───────────────────────────────
// The LLM gateway identifies a model by its "wire model" — what opencode sends
// as `body.model`. Under the kortix gateway provider that is just the modelID
// (a bare managed id like 'glm-5.2', or a BYOK 'provider/model'). A direct
// provider model uses 'provider/model'.
export function modelKeyToWire(model: ModelKey): string {
  if (model.providerID === 'kortix' || model.providerID === 'opencode') return model.modelID;
  return `${model.providerID}/${model.modelID}`;
}

export function wireToModelKey(wire: string): ModelKey {
  // Managed (bare) and BYOK ('provider/model') both live under the kortix
  // provider in the picker namespace, so the modelID carries the full wire id.
  return { providerID: 'kortix', modelID: wire };
}

type Visibility = 'show' | 'hide';

interface UserEntry extends ModelKey {
  visibility: Visibility;
  favorite?: boolean;
}

interface ModelStore {
  user: UserEntry[];
  recent: ModelKey[];
  variant: Record<string, string | undefined>;
  /** Persisted per-agent model selection so it survives refresh/new tabs */
  selectedModel?: Record<string, ModelKey | undefined>;
  /** Per-session agent name — keyed by sessionId so each session remembers its own agent */
  sessionAgentName?: Record<string, string | undefined>;
  /**
   * Globally last-used agent name. Persisted so the dashboard (no sessionId) and
   * freshly-created sessions inherit the agent the user most recently picked,
   * instead of resetting to the first agent in the list on every reload.
   */
  lastAgentName?: string;
  /** Per-session model selection — keyed by sessionId so each session remembers its own model across reloads */
  sessionModel?: Record<string, ModelKey | undefined>;
  /**
   * User-chosen global default model (set during onboarding setup wizard).
   * Takes priority over agent.model but yields to per-session and per-agent selections.
   * This ensures the user's explicit choice during setup is respected everywhere.
   */
  globalDefault?: ModelKey;
}

// ============================================================================
// LocalStorage persistence
// ============================================================================

const STORE_KEY = 'opencode-model-store-v1';

/**
 * Cap the per-session maps (`sessionModel`, `sessionAgentName`). They're keyed
 * by durable session UUIDs, so without a cap they'd accumulate one entry per
 * session the user ever opens — a slow but real localStorage leak. Keep the
 * most-recently-touched N (map key order is a good-enough recency proxy).
 */
const MAX_SESSION_ENTRIES = 200;

function capSessionMap<V>(map: Record<string, V> | undefined): Record<string, V> | undefined {
  if (!map) return map;
  const keys = Object.keys(map);
  if (keys.length <= MAX_SESSION_ENTRIES) return map;
  const kept = keys.slice(-MAX_SESSION_ENTRIES);
  return Object.fromEntries(kept.map((k) => [k, map[k]])) as Record<string, V>;
}

function loadStore(): ModelStore {
  if (typeof window === 'undefined') {
    return { user: [], recent: [], variant: {} };
  }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { user: [], recent: [], variant: {} };
}

let _store: ModelStore = loadStore();
const _listeners = new Set<() => void>();

function getStore(): ModelStore {
  return _store;
}

function setStore(next: ModelStore) {
  const capped = {
    ...next,
    sessionModel: capSessionMap(next.sessionModel),
    sessionAgentName: capSessionMap(next.sessionAgentName),
  };
  _store = capped;
  // Shared never-throw write — degrades gracefully and reclaims quota from
  // disposable caches instead of throwing if the bucket is full.
  safeSetItem(STORE_KEY, JSON.stringify(capped));
  for (const fn of _listeners) fn();
}

function subscribe(fn: () => void) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/**
 * Non-hook API to SEED the global-default display cache from the server's
 * account default (useModelDefaults). Always reflects the server value (it's the
 * source of truth) but, unlike setGlobalDefaultModel, does NOT clear the user's
 * explicit per-agent / per-session picks — this is passive hydration, not an
 * explicit "make this my default everywhere" action. No-ops when unchanged.
 */
export function seedGlobalDefaultFromServer(model: ModelKey | undefined): void {
  const s = getStore();
  const same =
    (!s.globalDefault && !model) ||
    (!!s.globalDefault &&
      !!model &&
      s.globalDefault.providerID === model.providerID &&
      s.globalDefault.modelID === model.modelID);
  if (same) return;
  setStore({ ...s, globalDefault: model });
}

// ============================================================================
// Catalog reconciliation — a persisted pick must never outlive the catalog
// ============================================================================

/**
 * Whether the served catalog OFFERS a model key.
 *
 * `enabled` is the server's own per-project answer (`GET
 * /projects/:id/model-picker`), so `false` means the project does not offer it
 * and the gateway would refuse it. `undefined` means this catalog carries no
 * enablement answer at all, which must read as "no opinion", never as "off".
 */
function offeredKeys(catalog: FlatModel[]): { served: Set<string>; enabled: Set<string> } {
  const served = new Set<string>();
  const enabled = new Set<string>();
  for (const model of catalog) {
    const key = `${model.providerID}:${model.modelID}`;
    served.add(key);
    if (model.enabled !== false) enabled.add(key);
  }
  return { served, enabled };
}

function sameModelKey(a: ModelKey | undefined, b: ModelKey | undefined): boolean {
  if (!a || !b) return a === b;
  return a.providerID === b.providerID && a.modelID === b.modelID;
}

function pruneModelSlots(
  slots: Record<string, ModelKey | undefined> | undefined,
  keep: (model: ModelKey) => boolean,
): { next: Record<string, ModelKey | undefined> | undefined; changed: boolean } {
  if (!slots) return { next: slots, changed: false };
  const next: Record<string, ModelKey | undefined> = {};
  let changed = false;
  for (const [slot, model] of Object.entries(slots)) {
    if (!model || keep(model)) {
      if (model) next[slot] = model;
      else changed = true;
      continue;
    }
    changed = true;
  }
  return { next, changed };
}

/**
 * The persisted store with every selection the served catalog no longer offers
 * removed, or `null` when nothing had to change.
 *
 * This is the fix for a stale pick outliving every server-side change: the read
 * chain already SKIPS an invalid id (`isModelValid`), but it never removed one,
 * so `recent[0]` stayed the first thing every newly opened session tried and a
 * dead id survived indefinitely in localStorage.
 *
 * Two grades of "not offered", handled differently on purpose:
 *
 *   - **absent from the catalog** — structurally dead (a renamed or withdrawn
 *     id). Dropped from `recent`, `user`, and every selection slot.
 *   - **served with `enabled: false`** — the project stopped offering it. Its
 *     selection slots and `recent` entry are dropped so it cannot become active,
 *     and a stale `show` pin goes (it loses to the server answer anyway), but a
 *     `hide` pin is KEPT: that is user intent, and it must survive the model
 *     being re-enabled.
 *
 * Returns `null` for an EMPTY catalog. A catalog that has not loaded yet says
 * nothing about what is offered, and purging against it would wipe every
 * preference on a cold start.
 */
export function reconcilePersistedModels(
  store: ModelStore,
  catalog: FlatModel[],
): ModelStore | null {
  if (catalog.length === 0) return null;
  const { served, enabled } = offeredKeys(catalog);
  const keyOf = (model: ModelKey) => `${model.providerID}:${model.modelID}`;
  const isOffered = (model: ModelKey) => enabled.has(keyOf(model));
  const isServed = (model: ModelKey) => served.has(keyOf(model));

  const recent = store.recent.filter(isOffered);
  const user = store.user.filter((entry) =>
    entry.visibility === 'hide' ? isServed(entry) : isOffered(entry),
  );
  const selected = pruneModelSlots(store.selectedModel, isOffered);
  const session = pruneModelSlots(store.sessionModel, isOffered);
  const globalDefault =
    store.globalDefault && !isOffered(store.globalDefault) ? undefined : store.globalDefault;

  const changed =
    recent.length !== store.recent.length ||
    user.length !== store.user.length ||
    selected.changed ||
    session.changed ||
    !sameModelKey(globalDefault, store.globalDefault);
  if (!changed) return null;

  return {
    ...store,
    recent,
    user,
    selectedModel: selected.next,
    sessionModel: session.next,
    globalDefault,
  };
}

/**
 * Apply `reconcilePersistedModels` to the live store. Returns whether anything
 * changed; a no-op never writes, so this is safe to call on every catalog
 * resolution without driving a render loop.
 */
export function reconcileModelStoreAgainstCatalog(catalog: FlatModel[]): boolean {
  const next = reconcilePersistedModels(getStore(), catalog);
  if (!next) return false;
  setStore(next);
  return true;
}

/**
 * Non-hook API to explicitly set the global default model.
 * Use when the user explicitly picks a model as their account default.
 * Clears per-agent/per-session selections so the new default takes effect everywhere.
 */
export function setGlobalDefaultModel(model: ModelKey | undefined): void {
  const s = getStore();
  setStore({
    ...s,
    globalDefault: model,
    selectedModel: {},
    sessionModel: {},
  });
}

// ============================================================================
// Latest logic — direct port from SolidJS reference
// ============================================================================

/**
 * Fallback allowlist for the rare non-gateway model that carries no release-date
 * metadata: only the flagship shows out of the box, everything else is opt-in via
 * "Manage models".
 */
const DEFAULT_VISIBLE_MODEL_IDS = new Set<string>([MANAGED_FLAGSHIP_MODEL_ID]);

/**
 * Provider id of the managed Kortix LLM gateway (see the sandbox's
 * `opencode.ts` provider config). It's a small, hand-picked catalog we control,
 * so every model in it is shown by default — `isVisible` short-circuits the
 * date-based "latest" heuristic for this provider. The newest-per-family
 * behaviour is kept for BYO providers, which is what it's for.
 */
const MANAGED_GATEWAY_PROVIDER_ID = 'kortix';

const SUBSCRIPTION_PROVIDER_ID = 'codex';

// The gateway bakes its ENTIRE routable catalog (every BYOK provider's models)
// into opencode so any model is callable the instant its key is connected — no
// session restart. The picker must therefore NOT show all of it by default: a
// `kortix` model is on out-of-the-box only when it's a platform-managed default
// or its underlying provider is connected (live, from project secrets). The
// rest stay one search away. Single source for the managed set lives in
// @kortix/llm-catalog (mirrors the gateway's managed-ids).
const MANAGED_MODEL_IDS = new Set<string>(DEFAULT_MANAGED_MODEL_IDS);

// `explicitProvider` (a model's `FlatModel.provider` / `ModelKey.provider`) is
// the robust path — the gateway now serves it directly, so grouping/gating
// never has to guess the real provider from string-splitting `modelID`.
// String-splitting on "/" remains only a fallback for a stale/older baked
// catalog that predates the field.
function subProviderOf(modelID: string, explicitProvider?: string): string {
  if (explicitProvider) return explicitProvider;
  const slash = modelID.indexOf('/');
  return slash === -1 ? modelID : modelID.slice(0, slash);
}

/**
 * True when at least one model in `allModels` is actually usable right now —
 * i.e. would work if sent, not merely present in the catalog. The gateway
 * bakes its ENTIRE routable catalog into every project regardless of plan or
 * connected keys (`providers.connected` always includes `kortix`), so raw
 * catalog presence (`providerListHasModels`, `models.length`) is never a
 * reliable "nothing is connected" signal — it's true even for a brand-new,
 * unpaid, no-BYOK account. This mirrors the entitlement half of `isVisible`
 * (managed models gated by `!freeTier`, BYOK-under-gateway models gated by
 * their sub-provider being connected) without its display-curation half
 * (the "latest per family" / flagship-only default view) — a model can be
 * fully usable while `isVisible` still hides it by default.
 *
 * THE SERVER IS THE SOURCE OF TRUTH. `FlatModel.enabled` is resolved by
 * `GET /projects/:id/model-picker` over a catalog the API has ALREADY filtered
 * by plan entitlement (`freeManagedOnly` drops every managed model) and by
 * which BYOK providers the project has connected — and the gateway refuses
 * anything it reports as off. When a model carries that flag, it is the whole
 * answer and the client-side derivation below is skipped entirely. Re-deriving
 * entitlement from a locally guessed `freeTier` is what let the composer show
 * "No model connected" and revert a pick the server had already accepted
 * (`PUT /sessions/:id/model` → 200, `applied_live: true`): the client's rule
 * ignores `KORTIX_BILLING_INTERNAL_ENABLED`, so on any deployment with internal
 * billing off (self-host, local dev) it disagreed with the API by construction.
 *
 * `connectedProviderIds`/`freeTier` remain for catalogs that carry NO server
 * answer (`enabled: undefined` — anything but `/model-picker`, e.g. a raw
 * provider list), which must not read as "refuse everything".
 */
export function hasUsableModel(
  allModels: FlatModel[],
  opts: { connectedProviderIds?: Set<string>; freeTier?: boolean },
): boolean {
  const connectedProviderIds = opts.connectedProviderIds;
  const freeTier = opts.freeTier ?? false;
  return allModels.some((m) => {
    if (m.enabled !== undefined) return m.enabled;
    if (m.providerID !== MANAGED_GATEWAY_PROVIDER_ID) {
      // Native/direct provider models: flattenModels only includes models
      // from CONNECTED providers, so presence here already means usable.
      return true;
    }
    if (MANAGED_MODEL_IDS.has(m.modelID)) return !freeTier;
    const sub = subProviderOf(m.modelID, m.provider);
    return sub === SUBSCRIPTION_PROVIDER_ID
      ? (connectedProviderIds?.has(SUBSCRIPTION_PROVIDER_ID) ?? false)
      : (connectedProviderIds?.has(sub) ?? false);
  });
}

export function isDefaultVisible(model: ModelKey): boolean {
  return DEFAULT_VISIBLE_MODEL_IDS.has(model.modelID);
}

/**
 * "Latest" models, keyed `providerID:modelID` for the store's lookup maps.
 *
 * The RULE itself lives in `@kortix/llm-catalog` — the gateway enforces the
 * same default set server-side, and two copies of "newest per family within
 * the window" is exactly how the picker and "Manage models" drifted apart.
 * This is only the key-shape adapter.
 */
export function computeLatestSet(models: FlatModel[]): Set<string> {
  return defaultEnabledModelIds(
    models.map((m) => ({
      // Feed the store's own composite key through as the candidate id so the
      // result needs no lossy id → model lookup on the way back out.
      id: `${m.providerID}:${m.modelID}`,
      released: m.releaseDate,
      family: m.family,
      // `provider` is the real upstream under the gateway (every model is
      // served as `kortix`); for a native provider it IS the providerID.
      provider: m.provider ?? m.providerID,
    })),
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useModelStore(
  allModels: FlatModel[],
  opts?: {
    connectedProviderIds?: Set<string>;
    // Free tier (no active paid sub): hides every Kortix managed model.
    freeTier?: boolean;
    /**
     * Canonical universe used to resolve default/heuristic visibility (the
     * "latest per family" set and each model's `releaseDate` lookup).
     * Defaults to `allModels`.
     *
     * `isVisible` must NOT be a function of which (possibly narrowed) array
     * a given call site happens to pass as `allModels` — different surfaces
     * (session picker vs. Settings > Models vs. command palette) otherwise
     * compute a different `latestSet`/`modelByKey` for the SAME model key,
     * so the same model can silently resolve to a different default
     * visibility (and therefore a different persisted 'show' write) on one
     * surface vs. another. Pass the full gateway catalog here from every
     * call site so default resolution is identical everywhere; `allModels`
     * keeps its existing meaning (what's actually rendered/iterated).
     */
    catalogModels?: FlatModel[];
    /**
     * Drop persisted selections the served catalog no longer offers
     * (`reconcilePersistedModels`).
     *
     * Opt-in, and only for a surface that passes the WHOLE served catalog: a
     * narrowed list (one provider, a search result) would read as "everything
     * else is gone" and purge preferences it knows nothing about.
     */
    reconcileAgainstCatalog?: boolean;
  },
) {
  const store = useSyncExternalStore(subscribe, getStore, getStore);
  const connectedProviderIds = opts?.connectedProviderIds;
  const freeTier = opts?.freeTier ?? false;
  const catalogModels = opts?.catalogModels ?? allModels;
  const reconcileAgainstCatalog = opts?.reconcileAgainstCatalog ?? false;

  useEffect(() => {
    if (!reconcileAgainstCatalog) return;
    reconcileModelStoreAgainstCatalog(catalogModels);
  }, [reconcileAgainstCatalog, catalogModels]);

  // Compute latest set
  const latestSet = useMemo(() => computeLatestSet(catalogModels), [catalogModels]);
  const modelByKey = useMemo(() => createModelLookup(catalogModels), [catalogModels]);

  // Visibility map from user preferences
  const visibilityMap = useMemo(() => {
    const map = new Map<string, Visibility>();
    for (const item of store.user) {
      map.set(`${item.providerID}:${item.modelID}`, item.visibility);
    }
    return map;
  }, [store.user]);

  // Check if a model is visible (port of SolidJS visible() function)
  const isVisible = useCallback(
    (model: ModelKey): boolean => {
      const key = `${model.providerID}:${model.modelID}`;
      const state = visibilityMap.get(key);
      if (state === 'hide') return false;
      // SERVER ANSWER FIRST. `/model-picker` stamps `enabled` on every model it
      // serves, resolved over a catalog the API already narrowed by plan
      // entitlement and connected BYOK providers, using the SAME
      // newest-per-family rule this function's curation half re-implements
      // (`resolveEnablement` → `defaultEnabledFromCatalog` →
      // `defaultEnabledModelIds`). Reading it here is what keeps every surface
      // (session picker, command palette, Manage models) and the gateway on one
      // answer. A server `false` beats a stale `show` pin — the gateway would
      // refuse the request anyway. Everything below stays for catalogs that
      // carry no server answer.
      const served = modelByKey.get(key);
      if (served?.enabled !== undefined) return served.enabled;
      // Gateway (kortix) models. The catalog is namespaced `<provider>/<model>`,
      // and connection is AUTHORITATIVE — it overrides any stale `show` pin, so a
      // disconnected provider's models disappear (even ones you'd used) and a
      // freshly connected provider's models appear, with no per-model pinning.
      // Visible only when: Codex subscription (`codex/<id>`, present once
      // connected), a platform-managed default, or the BYOK provider is
      // connected. Everything else is search-only so the catalog can't flood.
      if (model.providerID === MANAGED_GATEWAY_PROVIDER_ID) {
        const sub = subProviderOf(model.modelID, model.provider);
        // Codex (ChatGPT subscription) is now baked unconditionally like BYOK, so
        // gate its display on the subscription being connected.
        const connected =
          sub === SUBSCRIPTION_PROVIDER_ID
            ? (connectedProviderIds?.has(SUBSCRIPTION_PROVIDER_ID) ?? false)
            : (connectedProviderIds?.has(sub) ?? false);
        if (MANAGED_MODEL_IDS.has(model.modelID)) {
          if (freeTier) return false;
          return true;
        }
        if (!connected) return false;
        if (state === 'show') return true;
        if (latestSet.has(key)) return true;
        const m = modelByKey.get(key);
        if (!m?.releaseDate) return isDefaultVisible(model);
        try {
          const d = new Date(m.releaseDate);
          if (Number.isNaN(d.getTime())) return isDefaultVisible(model);
        } catch {
          return isDefaultVisible(model);
        }
        return false;
      }
      if (state === 'show') return true;
      if (latestSet.has(key)) return true;
      const m = modelByKey.get(key);
      // No (or invalid) release metadata — the managed Kortix gateway case.
      // Default to showing only the flagship; every other model is opt-in via
      // "Manage models". Providers that DO carry release dates keep the
      // newest-per-family "latest" behaviour handled above.
      if (!m?.releaseDate) return isDefaultVisible(model);
      try {
        const d = new Date(m.releaseDate);
        if (Number.isNaN(d.getTime())) return isDefaultVisible(model);
      } catch {
        return isDefaultVisible(model);
      }
      return false;
    },
    [visibilityMap, latestSet, modelByKey, connectedProviderIds, freeTier],
  );

  // Check if a model is in the latest set
  const isLatest = useCallback(
    (model: ModelKey): boolean => {
      return latestSet.has(`${model.providerID}:${model.modelID}`);
    },
    [latestSet],
  );

  // Set visibility for a model
  const setVisibility = useCallback((model: ModelKey, show: boolean) => {
    const s = getStore();
    const index = s.user.findIndex(
      (x) => x.modelID === model.modelID && x.providerID === model.providerID,
    );
    const next = [...s.user];
    if (index >= 0) {
      next[index] = { ...next[index], visibility: show ? 'show' : 'hide' };
    } else {
      next.push({ ...model, visibility: show ? 'show' : 'hide' });
    }
    setStore({ ...s, user: next });
  }, []);

  // Clear every visibility override so all models revert to their default
  // (shown). Leaves recent/variant/selection state untouched.
  const resetVisibility = useCallback(() => {
    const s = getStore();
    if (s.user.length === 0) return;
    setStore({ ...s, user: [] });
  }, []);

  // Recent models
  const recentModels = useMemo(() => store.recent, [store.recent]);

  const pushRecent = useCallback((model: ModelKey) => {
    const s = getStore();
    const key = (m: ModelKey) => m.providerID + m.modelID;
    const existing = s.recent.filter((r) => key(r) !== key(model));
    const next = [model, ...existing].slice(0, 5);
    setStore({ ...s, recent: next });
  }, []);

  // Variant persistence
  const getVariant = useCallback(
    (model: ModelKey): string | undefined => {
      return store.variant[`${model.providerID}/${model.modelID}`];
    },
    [store.variant],
  );

  const setVariant = useCallback((model: ModelKey, value: string | undefined) => {
    const s = getStore();
    const k = `${model.providerID}/${model.modelID}`;
    setStore({ ...s, variant: { ...s.variant, [k]: value } });
  }, []);

  // Per-agent persisted model selection
  const getSelectedModel = useCallback(
    (agentName: string): ModelKey | undefined => {
      return store.selectedModel?.[agentName];
    },
    [store.selectedModel],
  );

  const setSelectedModel = useCallback((agentName: string, model: ModelKey | undefined) => {
    const s = getStore();
    const next = { ...s.selectedModel };
    if (model) {
      next[agentName] = model;
    } else {
      delete next[agentName];
    }
    setStore({ ...s, selectedModel: next });
  }, []);

  // Per-session agent name selection
  const getSessionAgentName = useCallback(
    (sessionId: string): string | undefined => store.sessionAgentName?.[sessionId],
    [store.sessionAgentName],
  );

  const setSessionAgentName = useCallback((sessionId: string, name: string | undefined) => {
    const s = getStore();
    // Read-then-write idempotency guard: `setSessionAgentName` writes to a
    // `useSyncExternalStore`-backed store whose snapshot identity changes on
    // every write. Without this guard, any render/effect path that re-fires the
    // setter with the SAME value drives an infinite render loop (React #185,
    // "Maximum update depth exceeded"). The loop was reported by Better Stack
    // as `Object.setSessionAgentName` on the co-worker session page (pattern
    // 351da943…). See `shouldSetSessionAgentName` for the rationale.
    const current = s.sessionAgentName?.[sessionId];
    if (!shouldSetSessionAgentName(current, name)) return;
    const next = { ...s.sessionAgentName };
    if (name) {
      next[sessionId] = name;
    } else {
      delete next[sessionId];
    }
    setStore({ ...s, sessionAgentName: next });
  }, []);

  // Globally last-used agent — fallback for dashboard (no sessionId) and a seed
  // for brand-new sessions. Written alongside the per-session slot so that
  // picking an agent anywhere sticks as the "last used" default.
  const lastAgentName = useMemo(() => store.lastAgentName, [store.lastAgentName]);

  const setLastAgentName = useCallback((name: string | undefined) => {
    const s = getStore();
    if (s.lastAgentName === name) return;
    setStore({ ...s, lastAgentName: name });
  }, []);

  // Per-session model selection (survives reload — user's explicit choice for this session)
  const getSessionModel = useCallback(
    (sessionId: string): ModelKey | undefined => store.sessionModel?.[sessionId],
    [store.sessionModel],
  );

  const setSessionModel = useCallback((sessionId: string, model: ModelKey | undefined) => {
    const s = getStore();
    const next = { ...s.sessionModel };
    if (model) {
      next[sessionId] = model;
    } else {
      delete next[sessionId];
    }
    setStore({ ...s, sessionModel: next });
  }, []);

  // Global default model (set during onboarding setup wizard)
  const globalDefault = useMemo(() => store.globalDefault, [store.globalDefault]);

  const setGlobalDefault = useCallback((model: ModelKey | undefined) => {
    const s = getStore();
    // When setting a new global default, clear ALL per-agent and per-session
    // selections so the global default takes effect everywhere immediately.
    // Without this, stale per-agent/per-session data from previous interactions
    // would override the user's explicit setup choice.
    setStore({
      ...s,
      globalDefault: model,
      selectedModel: {},
      sessionModel: {},
    });
  }, []);

  return {
    isVisible,
    isLatest,
    setVisibility,
    resetVisibility,
    recent: recentModels,
    pushRecent,
    getVariant,
    setVariant,
    getSelectedModel,
    setSelectedModel,
    getSessionAgentName,
    setSessionAgentName,
    lastAgentName,
    setLastAgentName,
    getSessionModel,
    setSessionModel,
    globalDefault,
    setGlobalDefault,
    /** All user visibility preferences (for manage models dialog) */
    userPrefs: store.user,
  };
}
