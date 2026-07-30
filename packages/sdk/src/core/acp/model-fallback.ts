/**
 * A model the harness refuses to select is a per-session condition, not a dead
 * runtime.
 *
 * `session/set_config_option` with `optionId: 'model'` answers `-32602`
 * ("Invalid params: model not found: <id>") whenever the id is absent from the
 * harness's own option list — a stale persisted pick, a catalog the sandbox has
 * not rebaked yet, or a provider the harness failed to register. The client used
 * to treat that rejection as a transport failure: it abandoned the connection,
 * reconnected, never sent `session/prompt`, and the host painted a full-page
 * "OpenCode failed to load" card over a session that was in fact healthy.
 *
 * This module is the recovery rule, kept pure so it is testable without a
 * runtime: recognise the rejection, read what the harness DOES advertise, and
 * pick a replacement from that list.
 */

import { AcpRpcError } from './types';

/** JSON-RPC `Invalid params`. The harness answers a bad model id with this. */
const JSONRPC_INVALID_PARAMS = -32602;

/** A `-32602` rejection that is specifically about an unknown model. */
export interface AcpModelNotFound {
  /** The rejected id, when the harness names it in `error.data`. */
  modelId: string | null;
  /** The rejected provider, when the harness names it in `error.data`. */
  providerId: string | null;
  /** The harness's own message, verbatim. */
  message: string;
}

/** One entry of the harness's advertised `model` option list. */
export interface AcpAdvertisedModel {
  value: string;
  name: string | null;
}

export type AcpModelNoticeReason = 'model-not-found';

/**
 * A non-fatal, session-scoped explanation of a model the harness would not
 * select. Hosts render it inline beside the transcript; it never gates the chat.
 */
export interface AcpModelNotice {
  reason: AcpModelNoticeReason;
  /** The id the client asked the harness to select. */
  requestedModel: string;
  /** The model the turn actually runs on, as far as the harness reports one. */
  activeModel: string | null;
  /** True when this controller selected `activeModel`; false when the harness's own selection was left in place. */
  applied: boolean;
  /** Ready-to-render sentence naming the requested model and the replacement. */
  message: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * The rejection, or `null` for every other failure.
 *
 * Matched on the JSON-RPC code AND the "model not found" phrase: `-32602` alone
 * also covers a missing `cwd` or a malformed prompt, and treating those as a
 * recoverable model problem would swallow a real bug.
 */
export function parseAcpModelNotFound(error: unknown): AcpModelNotFound | null {
  if (!(error instanceof AcpRpcError)) return null;
  if (error.code !== JSONRPC_INVALID_PARAMS) return null;
  if (!/model not found/i.test(error.message)) return null;
  const data = isObject(error.data) ? error.data : null;
  return {
    modelId: data ? asNonEmptyString(data.modelId) : null,
    providerId: data ? asNonEmptyString(data.providerId) : null,
    message: error.message,
  };
}

function modelConfigOption(
  configOptions: ReadonlyArray<Record<string, unknown>>,
): Record<string, unknown> | null {
  return configOptions.find((option) => option.id === 'model') ?? null;
}

/** Every model the harness says it can select, in the order it advertises them. */
export function advertisedModelOptions(
  configOptions: ReadonlyArray<Record<string, unknown>>,
): AcpAdvertisedModel[] {
  const option = modelConfigOption(configOptions);
  if (!option || !Array.isArray(option.options)) return [];
  const models: AcpAdvertisedModel[] = [];
  for (const entry of option.options) {
    if (!isObject(entry)) continue;
    const value = asNonEmptyString(entry.value);
    if (!value) continue;
    models.push({ value, name: asNonEmptyString(entry.name) });
  }
  return models;
}

/** The model the harness currently has selected for this session, if it says. */
export function advertisedCurrentModel(
  configOptions: ReadonlyArray<Record<string, unknown>>,
): string | null {
  const option = modelConfigOption(configOptions);
  return option ? asNonEmptyString(option.currentValue) : null;
}

/**
 * The routing namespace of a model id — `kortix/anthropic/claude-sonnet-5` →
 * `kortix`, `anthropic/claude-opus-4-8` → `anthropic`, a bare id → `null`.
 *
 * This is the billing boundary. A `kortix/*` id routes through the Kortix LLM
 * gateway, which meters credits and enforces budgets; the same model reached as
 * `anthropic/*` runs on the user's own key and bypasses all of it. A fallback
 * that crossed this boundary would silently move a user onto a different billing
 * path, so it is not allowed — see `selectAcpFallbackModel`.
 */
function routingNamespace(modelId: string): string | null {
  const slash = modelId.indexOf('/');
  return slash > 0 ? modelId.slice(0, slash) : null;
}

/**
 * The replacement model, or `null` when none is safe.
 *
 * Preference order, all of it read off what the harness itself advertises — no
 * id is hardcoded here:
 *
 *   1. the session's currently-active model, when still advertised;
 *   2. the platform/server default, when the harness advertises it;
 *   3. the first advertised option.
 *
 * Every candidate must clear three gates: advertised by this harness, in the
 * SAME routing namespace as the rejected id (never a managed → BYOK rewrite),
 * and not already rejected. `null` means "leave the harness's own selection
 * alone and tell the user" — deliberately preferred over a silent billing-path
 * switch.
 */
export function selectAcpFallbackModel(input: {
  requestedModel: string;
  advertised: ReadonlyArray<AcpAdvertisedModel>;
  currentModel: string | null;
  serverDefaultModel?: string | null;
  rejected: ReadonlySet<string>;
}): string | null {
  const namespace = routingNamespace(input.requestedModel);
  const advertised = new Set(input.advertised.map((model) => model.value));
  const eligible = (candidate: string | null | undefined): candidate is string =>
    !!candidate &&
    candidate !== input.requestedModel &&
    !input.rejected.has(candidate) &&
    advertised.has(candidate) &&
    routingNamespace(candidate) === namespace;

  if (eligible(input.currentModel)) return input.currentModel;
  if (eligible(input.serverDefaultModel)) return input.serverDefaultModel;
  for (const model of input.advertised) {
    if (eligible(model.value)) return model.value;
  }
  return null;
}

/** The user-facing explanation for a model the harness would not select. */
export function acpModelNotice(input: {
  requestedModel: string;
  fallbackModel: string | null;
  harnessModel: string | null;
}): AcpModelNotice {
  const unavailable = `${input.requestedModel} is not available in this session`;
  if (input.fallbackModel) {
    return {
      reason: 'model-not-found',
      requestedModel: input.requestedModel,
      activeModel: input.fallbackModel,
      applied: true,
      message: `${unavailable}. Using ${input.fallbackModel} instead.`,
    };
  }
  // The harness can report the very id it just rejected as its own current
  // selection (a stale config it will not honour). Naming it as the replacement
  // would read as "X is unavailable, using X" — say nothing about it instead.
  const harnessModel =
    input.harnessModel && input.harnessModel !== input.requestedModel ? input.harnessModel : null;
  return {
    reason: 'model-not-found',
    requestedModel: input.requestedModel,
    activeModel: harnessModel,
    applied: false,
    message: harnessModel
      ? `${unavailable}, and no equivalent model is offered. This session is running on the agent's own model, ${harnessModel}.`
      : `${unavailable}, and no equivalent model is offered. This session is running on the agent's own default model.`,
  };
}
