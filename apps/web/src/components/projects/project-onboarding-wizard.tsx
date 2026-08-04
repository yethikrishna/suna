'use client';

/**
 * Project onboarding — a guided setup flow for a brand-new project.
 *
 * This file is a FRAME, not a screen. It owns the canvas, the inset panel, the
 * progress bar, the step index, and nothing else. Every step body lives in
 * ./onboarding/steps/, and every one of them renders through `StepShell` inside
 * a single 560px column.
 *
 * That column is the whole design. The previous version declared a max width on
 * the body but let individual steps break out of it — a 3-column tile grid in
 * one, a viewport-tall scroller in another, full-bleed cards in two more — so
 * five screens read as five unrelated screens. One column, one row primitive,
 * and an eighth step would cost no new chrome.
 *
 * The steps:
 *
 *   1. Welcome            — a warm start (founder concierge when eligible).
 *   2. Use case           — what the team will actually use Kortix for.
 *   3. Your company       — domain (prefilled from a work email) + size.
 *   4. Connect your tools — real Pipedream OAuth, inline. Skipped entirely when
 *                           Pipedream isn't configured (self-host without
 *                           PIPEDREAM_*, see isConnectorsEnabled()).
 *   5. Add to Slack       — one-click install, POLLED. Gated, with a quiet skip.
 *   6. Choose your plan   — start free, or upgrade. Never a gate.
 *   7. You're all set     — starting points picked from the step-2 answer.
 *
 * Steps 2 and 3 are the survey and are skippable together in one click.
 *
 * Self-gates: only renders while the project's onboarding status is 'pending'
 * (no `metadata.onboarding_completed_at`).
 *
 * NOTE: copy here is plain English. The repo's hardcoded-UI i18n keys still need
 * to be generated for these strings before this ships beyond local testing.
 */

import { ArrowLeftIcon as ArrowLeft } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { KortixAsterisk } from '@/components/ui/kortix-asterisk';
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
  surveyPosition,
} from './onboarding/onboarding-profile';
import { StepProgress } from './onboarding/step-shell';
import { useOnboardingAnswers } from './onboarding/use-onboarding-answers';
import { CompanyStep } from './onboarding/steps/company-step';
import { DoneStep } from './onboarding/steps/done-step';
import { PlanStep } from './onboarding/steps/plan-step';
import { SlackStep } from './onboarding/steps/slack-step';
import { ToolsStep } from './onboarding/steps/tools-step';
import { UseCaseStep } from './onboarding/steps/use-case-step';
import { WelcomeStep } from './onboarding/steps/welcome-step';

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

  const [calOpen, setCalOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const { answers, save } = useOnboardingAnswers(projectId);
  // Prefilled once from the signup email, then owned by the user. A lazy
  // initializer, not an effect — an effect would re-run and clobber typing.
  const [domain, setDomain] = useState(() => deriveCompanyDomain(user?.email));

  const connectorsEnabled = isConnectorsEnabled();
  const steps = useMemo(() => buildSteps(connectorsEnabled), [connectorsEnabled]);
  const stepId = steps[index] ?? 'welcome';
  const survey = surveyPosition(stepId);
  const eyebrow = survey ? `Question ${survey.index} of ${survey.total}` : undefined;

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

  // Picking a starting point on the finish step seeds the project-home composer
  // and closes the wizard in one action. `composer-prefill-store` is the
  // existing one-shot handoff (project-home consumes and clears it on mount) —
  // the same channel the command palette and "try this" deep links use.
  const startWithPrompt = useCallback(
    (prompt: string) => {
      useComposerPrefillStore.getState().setPrefill(projectId, prompt);
      void complete();
    },
    [projectId, complete],
  );

  // Skipping the survey jumps past BOTH questions to whatever comes next —
  // `tools` normally, `slack` when connectors are disabled.
  const skipSurvey = useCallback(() => setIndex(firstStepAfterSurvey(steps)), [steps]);

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
          <div className="flex items-center px-5 py-4 md:px-8">
            <div className="flex items-center gap-2.5">
              <KortixAsterisk index={0} />
              <span className="text-foreground text-sm font-semibold tracking-tight">
                Set up your project
              </span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-5 pb-10 md:items-center md:px-8">
            <div className="w-full max-w-[560px] py-6">
              <div className="mb-8 flex items-center gap-3">
                {index > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground -ml-2 h-8 shrink-0 gap-1.5 px-2"
                    onClick={back}
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Button>
                )}
                <StepProgress total={steps.length} current={index} />
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={stepId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {stepId === 'welcome' && (
                    <WelcomeStep
                      showFounderStep={showFounderStep}
                      onBookCall={() => setCalOpen(true)}
                      onContinue={next}
                    />
                  )}
                  {stepId === 'use-case' && (
                    <UseCaseStep
                      eyebrow={eyebrow}
                      value={answers.use_case ?? null}
                      onSelect={(v) => save({ use_case: v })}
                      onContinue={next}
                      onSkip={skipSurvey}
                    />
                  )}
                  {stepId === 'company' && (
                    <CompanyStep
                      eyebrow={eyebrow}
                      domain={domain}
                      size={answers.company_size ?? null}
                      onDomainChange={setDomain}
                      onSizeChange={(v) => save({ company_size: v })}
                      onContinue={() => {
                        // The domain is free text, so it saves on Continue
                        // rather than per keystroke.
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
                      projectId={projectId}
                      existingSlugs={connectorSlugs}
                      onConnected={refreshConnectors}
                      onContinue={next}
                      onSkip={next}
                    />
                  )}
                  {stepId === 'slack' && (
                    <SlackStep projectId={projectId} onContinue={next} onSkip={next} />
                  )}
                  {stepId === 'plan' && <PlanStep onContinue={next} />}
                  {stepId === 'done' && (
                    <DoneStep
                      useCase={answers.use_case ?? null}
                      profileCount={connectorSlugs.length}
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
