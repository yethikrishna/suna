import { DEFAULT_MANAGED_MODEL_IDS, PROVIDER_LABELS } from '@kortix/llm-catalog';

import type { FlatModel } from './session-chat-input';

const MANAGED_MODEL_IDS = new Set<string>(DEFAULT_MANAGED_MODEL_IDS);

// The gateway exposes its whole catalog through a single `kortix` provider, with
// model ids namespaced as `<provider>/<model>`. For the picker we recover the
// REAL provider: platform-managed defaults stay under the "Kortix" group, while
// every BYOK model surfaces under its real provider ("Anthropic", "OpenAI", …) —
// so a connected provider reads as its own section, not buried in Kortix.
//
// "Kortix" here means MANAGED ON KORTIX CREDENTIALS — not "runs on Kortix's own
// inference". Which upstream actually serves a managed model is invisible to
// billing and to the user's choice, so it must not shape the grouping.
//
// *** BUG THIS FIXES (every model showing under "Kortix", even BYOK Anthropic) ***
// `pickerGroupId` always correctly computed the grouping KEY (it split
// `modelID` on "/" and returned e.g. "anthropic"). The bug was never in the
// key — it was that the group's DISPLAY NAME, built in `grouped` below, was
// taken verbatim from `model.providerName` (opencode's raw provider name,
// which is ALWAYS "Kortix" — every gateway model is registered under the one
// synthetic `kortix` opencode provider). So the group's icon rendered
// correctly (`ProviderLogo` is keyed off the correct `providerID`), but the
// text label next to it always read "Kortix" regardless of which provider
// actually served the model.
//
// The robust fix (per the live /v1/models trace): the gateway now serves an
// EXPLICIT `provider` field per model (`GatewayModel.provider`, threaded onto
// `FlatModel.provider` by flattenModels) — grouping/labeling should prefer
// that over parsing the wire id at all. String-splitting `modelID` remains
// ONLY as a fallback for a stale/older baked catalog that predates the field.
export function pickerGroupId(model: FlatModel): string {
  if (model.providerID !== 'kortix') {
    return model.providerID;
  }
  // A platform-managed default is ALWAYS the "Kortix" group — structurally, by
  // what it IS (managed, credits-billed), never by what brand it carries. Its
  // `provider` field is a BRAND mark, not a group key: `glm-5.2` runs on
  // AsterLab and `deepseek-v4-flash` on OpenRouter, yet both spend Kortix
  // credits exactly like the two Claude models. Reading `provider` here is what
  // split `deepseek-v4-flash` — the one managed entry with `providerBrand`
  // (packages/llm-catalog/src/index.ts:572) — into a one-row "DeepSeek" section
  // next to a three-row "Kortix", and it made the managed row collide with the
  // BYOK `deepseek/deepseek-v4-flash` row when a DeepSeek key was connected.
  // The brand is preserved where it belongs: a per-ROW logo in the picker,
  // keyed off `provider` (see `model-selector.tsx`). Grouping and branding get
  // one field each; they no longer compete for this one.
  if (MANAGED_MODEL_IDS.has(model.modelID)) return model.providerID;
  if (model.provider) return model.provider;
  const slash = model.modelID.indexOf('/');
  return slash === -1 ? model.providerID : model.modelID.slice(0, slash);
}

// The group's display name/label — NEVER the raw `FlatModel.providerName`
// (always "Kortix" under the gateway, see the bug note above). Prefer the
// canonical label for the resolved real-provider id; only fall back to the
// model's own providerName for a truly unknown id (e.g. `pickerGroupId`
// degrading to the raw `providerID` because neither `provider` nor a `/` was
// present — at that point `groupID === model.providerID` anyway).
export function pickerGroupLabel(groupID: string, model: FlatModel): string {
  return PROVIDER_LABELS[groupID] ?? model.providerName;
}

// The row's secondary line — the model's wire id. Inside a BYOK provider group
// the `<provider>/` prefix just repeats the group heading, so drop it there and
// show the bare id. Extracted from the row body so the "two rows must not read
// identically" rule is testable without rendering the picker.
export function pickerRowSubtitle(groupID: string, model: FlatModel): string {
  const slash = model.modelID.indexOf('/');
  if (groupID === model.providerID || slash === -1) return model.modelID;
  return model.modelID.slice(slash + 1);
}
