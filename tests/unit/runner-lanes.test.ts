import { describe, expect, it } from 'vitest';
import type { RegisteredFlow } from '../src/core/flow';
import { partitionParallelFlows } from '../src/core/lanes';

function registeredFlow(
  id: string,
  requires: RegisteredFlow['meta']['requires'] = [],
): RegisteredFlow {
  return {
    id,
    meta: { domain: 'test', requires },
    fn: async () => {},
  };
}

describe('ke2e parallel lanes', () => {
  it('separates live sandbox flows from API-only flows', () => {
    const api = registeredFlow('API-1');
    const fundedApi = registeredFlow('API-2', ['funded']);
    const daytona = registeredFlow('SBX-1', ['funded', 'daytona']);

    const lanes = partitionParallelFlows([api, daytona, fundedApi]);

    expect(lanes.apiLane).toEqual([api, fundedApi]);
    expect(lanes.sandboxLane).toEqual([daytona]);
  });
});
