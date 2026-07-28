import { expect, test } from 'bun:test';

import { HARNESS_IDS } from '../../../shared/src/harnesses';
import { V3_HARNESS_VALUES } from '../constants';

test('v3 manifest harnesses match the shared runtime catalog', () => {
  expect(V3_HARNESS_VALUES).toEqual(HARNESS_IDS);
});
