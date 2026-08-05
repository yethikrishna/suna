'use client';

/**
 * Project onboarding — a guided setup flow for a brand-new project.
 *
 * This file is a FRAME, not a screen. It owns the canvas, the back control, the
 * step index, and nothing else. Every step body lives in ./onboarding/steps/.
 *
 * ONE RULE governs the whole flow: every element starts at the same left edge.
 * The step counter, the headline, the sub-copy, the option grid, and the
 * actions share one x, and the space to the right is left empty rather than
 * filled. Earlier versions centred the column and then centred content inside
 * it, stretched the buttons edge-to-edge, and centre-aligned two steps — so no
 * two elements agreed on where a line begins, and no amount of spacing or
 * motion work fixed how it read.
 *
 * The steps:
 *
 *   1. Use case           — what the team will actually use Kortix for.
 *   2. Your company       — domain (prefilled from a work email) + size.
 *   3. Connect your tools — search over the real Pipedream catalogue. Skipped
 *                           entirely when Pipedream isn't configured
 *                           (self-host without PIPEDREAM_*).
 *   4. Add to Slack       — one-click install, POLLED. Custom apps get their
 *                           own view on the same rail.
 *   5. Choose your plan   — never a gate; nothing opens until Continue.
 *   6. You're all set     — starting points picked from the step-1 answer.
 *
 * Steps 1 and 2 are the survey and are skippable together in one click.
 *
 * Self-gates: only renders while the project's onboarding status is 'pending'
 * (no `metadata.onboarding_completed_at`).
 *
 * NOTE: copy here is plain English. The repo's hardcoded-UI i18n keys still need
 * to be generated for these strings before this ships beyond local testing.
 */

import { ArrowLeftIcon as ArrowLeft } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { errorToast, successToast } from '@/components/ui/toast';
import { DemoQualifierModal } from '@/features/contact/demo-qualifier-modal';
import { useAuth } from '@/features/providers/auth-provider';
import { useProjectOnboarding } from '@/hooks/projects/use-project-onboarding';
import { usePersonalContactTier } from '@/hooks/use-show-personal-contact';
import { isConnectorsEnabled } from '@/lib/config';
import { useComposerPrefillStore } from '@/stores/composer-prefill-store';
import { listConnectors } from '@kortix/sdk';

import {
  buildSteps,
  deriveCompanyDomain,
  firstStepAfterSurvey,
  stepLabel,
} from './onboarding/onboarding-profile';
import { useOnboardingAnswers } from './onboarding/use-onboarding-answers';
import { CompanyStep } from './onboarding/steps/company-step';
import { DoneStep } from './onboarding/steps/done-step';
import { PlanStep } from './onboarding/steps/plan-step';
import { SlackStep } from './onboarding/steps/slack-step';
import { ToolsStep } from './onboarding/steps/tools-step';
import { UseCaseStep } from './onboarding/steps/use-case-step';

const CAL_LINK = 'team/kortix/demo';
const CAL_NAMESPACE = 'kortix-onboarding-wizard';

const Q = { staleTime: 60_000, refetchOnWindowFocus: false } as const;

export function ProjectOnboardingWizard({ projectId }: { projectId: string }) {
  const contactTier = usePersonalContactTier();
  const showFounderStep = contactTier === 'personal';
  const { user } = useAuth();
  const defaultName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    '';
  const defaultEmail = user?.email ?? '';

  const onboarding = useProjectOnboarding(projectId);
  const queryClient = useQueryClient();
  const reduced = useReducedMotion() ?? false;

  const [calOpen, setCalOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const { answers, save } = useOnboardingAnswers(projectId);
  // Prefilled once from the signup email, then owned by the user. A lazy
  // initializer, not an effect — an effect would re-run and clobber typing.
  const [domain, setDomain] = useState(() => deriveCompanyDomain(user?.email));

  const connectorsEnabled = isConnectorsEnabled();
  const steps = useMemo(() => buildSteps(connectorsEnabled), [connectorsEnabled]);
  const stepId = steps[index] ?? 'use-case';
  const label = stepLabel(index, steps.length);

  // `?onboarding-reset` reopens the wizard from the top (clears completion flag).
  const resetFn = onboarding.reset;
  const resetHydrated = onboarding.hydrated;
  const resetFiredRef = useRef(false);
  useEffect(() => {
    if (!resetHydrated || resetFiredRef.current) return;
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('onboarding-reset')) return;
    resetFiredRef.current = true;
    setIndex(0);
    Promise.resolve()
      .then(() => resetFn())
      .then(() => successToast('Onboarding reset'))
      .catch((err) => errorToast(err instanceof Error ? err.message : String(err)));
    url.searchParams.delete('onboarding-reset');
    window.history.replaceState(null, '', url.toString());
  }, [resetHydrated, resetFn]);

  const isPending = onboarding.hydrated && onboarding.status === 'pending';
  const connectors = useQuery({
    queryKey: ['project-connectors', projectId],
    queryFn: () => listConnectors(projectId),
    enabled: isPending,
    ...Q,
  });
  const connectorSlugs = useMemo(
    () => (connectors.data?.connectors ?? []).map((connector) => connector.slug),
    [connectors.data],
  );
  const refreshConnectors = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['project-connectors', projectId] });
  }, [queryClient, projectId]);

  const next = useCallback(
    () => setIndex((i) => Math.min(i + 1, steps.length - 1)),
    [steps.length],
  );
  const back = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const complete = useCallback(() => onboarding.complete(), [onboarding]);

  // Skipping the survey jumps past BOTH questions to whatever comes next —
  // `tools` normally, `slack` when connectors are disabled.
  const skipSurvey = useCallback(() => setIndex(firstStepAfterSurvey(steps)), [steps]);

  // Picking a starting point on the finish step seeds the project-home composer
  // and closes the wizard in one action. `composer-prefill-store` is the
  // existing one-shot handoff, the same channel the command palette uses.
  const startWithPrompt = useCallback(
    (prompt: string) => {
      useComposerPrefillStore.getState().setPrefill(projectId, prompt);
      void complete();
    },
    [projectId, complete],
  );

  if (!isPending) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-muted/30 fixed inset-0 z-[70] p-2"
        role="dialog"
        aria-modal="true"
        aria-label="Project setup"
      >
        <div className="border-border/60 bg-background flex h-full flex-col overflow-hidden rounded-md border">
          {/* The entire chrome: one back control. No mark, no title, no
              progress widget — the rail's first line carries the count. */}
          <div className="flex h-16 shrink-0 items-center px-6 md:px-10">
            {index > 0 && (
              <Button
                variant="ghost"
                size="icon-md"
                aria-label="Back"
                className="text-muted-foreground hover:text-foreground -ml-2"
                onClick={back}
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
          </div>

          <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-6 pb-16 md:px-10">
            {/* The rail. Centred as a block, left-aligned within — every step
                starts at this element's left edge and nothing is centred
                inside it. */}
            <div className="w-full max-w-[640px] pt-4 md:pt-10">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={stepId}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  // Deliberately plain. Motion here has no job beyond softening
                  // the swap; anything more expressive competes with the reading.
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                >
                  {stepId === 'use-case' && (
                    <UseCaseStep
                      stepLabel={label}
                      value={answers.use_case ?? null}
                      onSelect={(v) => save({ use_case: v })}
                      onContinue={next}
                      onSkip={skipSurvey}
                    />
                  )}
                  {stepId === 'company' && (
                    <CompanyStep
                      stepLabel={label}
                      domain={domain}
                      size={answers.company_size ?? null}
                      onDomainChange={setDomain}
                      onSizeChange={(v) => save({ company_size: v })}
                      onContinue={() => {
                        // Free text, so it saves on Continue rather than per keystroke.
                        const trimmed = domain.trim();
                        if (trimmed && trimmed !== answers.company_domain) {
                          save({ company_domain: trimmed });
                        }
                        next();
                      }}
                      onSkip={skipSurvey}
                    />
                  )}
                  {stepId === 'tools' && (
                    <ToolsStep
                      stepLabel={label}
                      projectId={projectId}
                      existingSlugs={connectorSlugs}
                      onConnected={refreshConnectors}
                      onContinue={next}
                      onSkip={next}
                    />
                  )}
                  {stepId === 'slack' && (
                    <SlackStep
                      stepLabel={label}
                      projectId={projectId}
                      onContinue={next}
                      onSkip={next}
                    />
                  )}
                  {stepId === 'plan' && <PlanStep stepLabel={label} onContinue={next} />}
                  {stepId === 'done' && (
                    <DoneStep
                      useCase={answers.use_case ?? null}
                      profileCount={connectorSlugs.length}
                      showFounderCall={showFounderStep}
                      onBookCall={() => setCalOpen(true)}
                      onStart={complete}
                      onUsePrompt={startWithPrompt}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      {showFounderStep && (
        <DemoQualifierModal
          open={calOpen}
          onOpenChange={setCalOpen}
          calLink={CAL_LINK}
          calNamespace={CAL_NAMESPACE}
          source="onboarding-wizard"
          title="Book a 20-minute setup call"
          description="A couple of focused minutes with the team to get your command center dialed in."
          defaultName={defaultName}
          defaultEmail={defaultEmail}
          onBookingSuccessful={() => setCalOpen(false)}
        />
      )}
    </>
  );
}
