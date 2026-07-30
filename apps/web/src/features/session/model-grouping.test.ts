import { describe, expect, test } from 'bun:test';
import { DEFAULT_MANAGED_MODEL_IDS, getManagedModel } from '@kortix/llm-catalog';

import { pickerGroupId, pickerGroupLabel, pickerRowSubtitle } from './model-grouping';
import type { FlatModel } from './session-chat-input';

// Regression coverage for the "every provider shows as Kortix" picker bug.
//
// Root cause: the gateway exposes its ENTIRE catalog under one synthetic
// `kortix` opencode provider. `pickerGroupId` always correctly split the
// grouping KEY out of the wire model id, but the group's DISPLAY LABEL was
// built from `model.providerName` — which is opencode's raw provider name,
// ALWAYS "Kortix" for every model, since there is only one registered
// provider. So the icon rendered under the right provider but every group's
// text label still read "Kortix". The fix is two-fold: prefer the explicit
// `provider` field the gateway now serves (never string-split when it's
// present) for the grouping key, AND resolve the display label from
// PROVIDER_LABELS keyed by that REAL id — never from the raw providerName.
//
// That `provider` preference applies to BYOK models ONLY. For a platform-managed
// model `provider` is a BRAND mark, not a group key — see the invariant block
// below, which is the rule that keeps all managed models in one Kortix group.
function model(partial: Partial<FlatModel> & Pick<FlatModel, 'providerID' | 'modelID'>): FlatModel {
  return {
    providerName: 'Kortix',
    modelName: partial.modelID,
    ...partial,
  };
}

describe('pickerGroupId', () => {
  test('prefers the explicit `provider` field over string-splitting the wire id', () => {
    const m = model({
      providerID: 'kortix',
      modelID: 'anthropic/claude-opus-4-8',
      provider: 'anthropic',
    });
    expect(pickerGroupId(m)).toBe('anthropic');
  });

  test('falls back to splitting modelID on "/" when `provider` is absent (stale catalog)', () => {
    const m = model({ providerID: 'kortix', modelID: 'openai/gpt-5.6-sol' });
    expect(pickerGroupId(m)).toBe('openai');
  });

  test('a managed bare-id model (no slash, no explicit provider) groups under kortix', () => {
    const m = model({ providerID: 'kortix', modelID: 'claude-opus-4.8' });
    expect(pickerGroupId(m)).toBe('kortix');
  });

  // "Kortix" means MANAGED ON KORTIX CREDENTIALS, not "served by Kortix's own
  // inference" — glm-5.2 runs on AsterLab and deepseek-v4-flash on OpenRouter,
  // and both are credits-billed platform defaults. So a managed model's
  // `provider` field (the picker BRAND mark, stamped from the catalog's
  // `providerBrand` at apps/api/src/llm-gateway/models/catalog-models.ts:203)
  // must never become its GROUP key — that split deepseek-v4-flash out into a
  // one-row "DeepSeek" section while its three siblings sat under "Kortix".
  test('a branded managed model still groups under kortix, brand mark notwithstanding', () => {
    const m = model({
      providerID: 'kortix',
      modelID: 'deepseek-v4-flash',
      provider: 'deepseek',
    });
    expect(pickerGroupId(m)).toBe('kortix');
    expect(pickerGroupLabel(pickerGroupId(m), m)).toBe('Kortix');
  });

  test('a codex/<id> model groups under its own `codex` provider, distinct from `openai`', () => {
    const m = model({ providerID: 'kortix', modelID: 'codex/gpt-5.6-sol', provider: 'codex' });
    expect(pickerGroupId(m)).toBe('codex');
  });

  test('a non-gateway (native) provider model groups under its own providerID unchanged', () => {
    const m = model({
      providerID: 'anthropic',
      modelID: 'claude-opus-4-8',
      providerName: 'Anthropic',
    });
    expect(pickerGroupId(m)).toBe('anthropic');
  });
});

// THE INVARIANT. Every platform-managed default is billed to Kortix credits, so
// every one of them belongs to the single "Kortix" group — no exceptions, and
// no matter what brand its catalog entry carries. This loops the REAL catalog
// (not a fixture) and serves `provider` exactly the way the API does
// (`providerBrand ?? 'kortix'`), so the day someone adds `providerBrand` to
// another managed entry — `glm-5.2` is one line away, and
// apps/api/src/llm-gateway/models/managed-models.test.ts:49,55 already uses
// `providerBrand: 'zhipuai'` as its worked example — this test fails instead of
// the picker quietly growing a one-row section.
describe('managed models are ONE Kortix group — invariant over the whole catalog', () => {
  test('the catalog has managed models to check', () => {
    expect(DEFAULT_MANAGED_MODEL_IDS.length).toBeGreaterThan(0);
  });

  for (const modelID of DEFAULT_MANAGED_MODEL_IDS) {
    const brand = getManagedModel(modelID)?.providerBrand;
    test(`${modelID} (brand: ${brand ?? 'none'}) groups under kortix`, () => {
      const m = model({ providerID: 'kortix', modelID, provider: brand ?? 'kortix' });
      const groupID = pickerGroupId(m);
      expect(groupID).toBe('kortix');
      expect(pickerGroupLabel(groupID, m)).toBe('Kortix');
    });
  }

  test('all managed models collapse to exactly one group id', () => {
    const groupIDs = new Set(
      DEFAULT_MANAGED_MODEL_IDS.map((modelID) =>
        pickerGroupId(
          model({
            providerID: 'kortix',
            modelID,
            provider: getManagedModel(modelID)?.providerBrand ?? 'kortix',
          }),
        ),
      ),
    );
    expect([...groupIDs]).toEqual(['kortix']);
  });
});

// The same `providerBrand` field caused a SECOND, nastier symptom: with a
// DeepSeek BYOK key connected, the "DeepSeek" group rendered two rows that were
// character-for-character identical — same title ("DeepSeek V4 Flash") and same
// subtitle ("deepseek-v4-flash") — differing only in price, because the group
// prefix-strip at model-selector.tsx collapsed the BYOK row's
// `deepseek/deepseek-v4-flash` down to the managed row's bare id. A user could
// not tell which one spent credits. Grouping managed under `kortix` separates
// them; this locks that no (group, title, subtitle) triple can repeat.
describe('managed vs BYOK same-model collision', () => {
  const managed = model({
    providerID: 'kortix',
    modelID: 'deepseek-v4-flash',
    modelName: 'DeepSeek V4 Flash',
    provider: 'deepseek',
  });
  const byok = model({
    providerID: 'kortix',
    modelID: 'deepseek/deepseek-v4-flash',
    modelName: 'DeepSeek V4 Flash',
    provider: 'deepseek',
  });

  test('the two rows do not land in the same group', () => {
    expect(pickerGroupId(managed)).toBe('kortix');
    expect(pickerGroupId(byok)).toBe('deepseek');
    expect(pickerGroupId(managed)).not.toBe(pickerGroupId(byok));
  });

  test('no two rows share the same group + title + subtitle', () => {
    const rows = [managed, byok].map((m) => {
      const groupID = pickerGroupId(m);
      return `${groupID}|${m.modelName}|${pickerRowSubtitle(groupID, m)}`;
    });
    expect(new Set(rows).size).toBe(rows.length);
  });

  test('the managed row keeps its bare id as the subtitle', () => {
    expect(pickerRowSubtitle(pickerGroupId(managed), managed)).toBe('deepseek-v4-flash');
  });

  test('the BYOK row drops the redundant `deepseek/` prefix inside its own group', () => {
    expect(pickerRowSubtitle(pickerGroupId(byok), byok)).toBe('deepseek-v4-flash');
  });
});

describe('pickerGroupLabel — THE actual display-name bug fix', () => {
  test('labels an Anthropic BYOK group "Anthropic", never the raw (always-"Kortix") providerName', () => {
    const m = model({
      providerID: 'kortix',
      modelID: 'anthropic/claude-opus-4-8',
      provider: 'anthropic',
      providerName: 'Kortix', // what opencode's raw provider object always reports
    });
    const groupID = pickerGroupId(m);
    expect(pickerGroupLabel(groupID, m)).toBe('Anthropic');
    expect(pickerGroupLabel(groupID, m)).not.toBe('Kortix');
  });

  test('labels an OpenAI BYOK group "OpenAI"', () => {
    const m = model({ providerID: 'kortix', modelID: 'openai/gpt-5.6-sol', provider: 'openai' });
    expect(pickerGroupLabel(pickerGroupId(m), m)).toBe('OpenAI');
  });

  test('labels the managed group "Kortix" (correctly, since it really is Kortix)', () => {
    const m = model({ providerID: 'kortix', modelID: 'claude-opus-4.8' });
    expect(pickerGroupLabel(pickerGroupId(m), m)).toBe('Kortix');
  });

  test('falls back to the raw providerName for a truly unrecognized provider id', () => {
    const m = model({
      providerID: 'kortix',
      modelID: 'some-new-provider/some-model',
      providerName: 'Kortix',
    });
    // No PROVIDER_LABELS entry for "some-new-provider" -> falls back to
    // model.providerName rather than showing an ugly raw id.
    expect(pickerGroupLabel(pickerGroupId(m), m)).toBe('Kortix');
  });
});

// Bedrock regression: models.dev's canonical provider id is `amazon-bedrock`
// and Bedrock wire ids are DOT-namespaced (`us.anthropic.claude-opus-4-8`),
// so there is no "/" to split on — the explicit `provider` field is the ONLY
// way to group them. PROVIDER_LABELS was missing the `amazon-bedrock` key, so
// the label lookup fell through to `providerName` ("Kortix") and the whole
// BYOK Bedrock group rendered as "Kortix" while showing the Bedrock icon.
describe('BYOK Bedrock grouping (dot-namespaced ids)', () => {
  const bedrockModelIDs = [
    'us.anthropic.claude-opus-4-8',
    'global.anthropic.claude-sonnet-5',
    'anthropic.claude-fable-5',
    'deepseek.v3.2',
  ];

  for (const modelID of bedrockModelIDs) {
    test(`groups ${modelID} under amazon-bedrock, labelled "Amazon Bedrock"`, () => {
      const m = model({ providerID: 'kortix', modelID, provider: 'amazon-bedrock' });
      const groupID = pickerGroupId(m);
      expect(groupID).toBe('amazon-bedrock');
      expect(pickerGroupLabel(groupID, m)).toBe('Amazon Bedrock');
    });
  }

  test('the short `bedrock` alias resolves to the same label', () => {
    const m = model({
      providerID: 'kortix',
      modelID: 'us.anthropic.claude-opus-4-8',
      provider: 'bedrock',
    });
    expect(pickerGroupLabel(pickerGroupId(m), m)).toBe('Amazon Bedrock');
  });

  test('WITHOUT the explicit provider field a dot-namespaced id degrades to kortix', () => {
    // Documents exactly why `provider` must survive the wire: there is no "/"
    // to recover the real provider from, so the label would read "Kortix".
    const m = model({ providerID: 'kortix', modelID: 'us.anthropic.claude-opus-4-8' });
    expect(pickerGroupId(m)).toBe('kortix');
  });
});
