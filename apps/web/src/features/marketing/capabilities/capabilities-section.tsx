'use client';

import type { ReactNode } from 'react';
import { AgentsSection } from './agents-section';
import { AutomationsSection } from './automations-section';
import { ChannelsSection } from './channels-section';
import { ControlSection } from './control-section';

/**
 * TRANSITIONAL — delete this file once `page.tsx` mounts the four passages.
 *
 * This used to be the section itself: one heading and four prose entries in a
 * list, 2,626px tall at 1440, sitting in a single slot between the layer stack
 * and the use-case wheel. It is now four independently mountable sections, which
 * is the whole point of the change — see `index.ts` for the recommended order.
 *
 * It survives only so the current `page.tsx` keeps compiling and rendering while
 * the four are placed. Rendering them back to back here is exactly the wall the
 * split exists to remove, so this is not a supported layout: it is a scaffold.
 *
 * TO FINISH THE JOB: import the four from
 * `@/features/marketing/capabilities`, drop them into their slots, remove the
 * `CapabilitiesSection` import, and delete this file.
 */
export function CapabilitiesSection(): ReactNode {
  return (
    <>
      <AgentsSection />
      <ChannelsSection />
      <AutomationsSection />
      <ControlSection />
    </>
  );
}
