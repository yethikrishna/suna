'use client';

import { useTranslations } from 'next-intl';

import { Separator } from '@/components/ui/separator';
import {
  Definition,
  DefinitionList,
  LINK,
  Note,
  P,
  Section,
  SUPPORT_CONTAINER,
  SupportDocGrid,
  SupportHeader,
} from '@/features/marketing/support/support-doc';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const SUPPORT_EMAIL = 'support@kortix.com';
const DISCORD_URL = 'https://discord.com/invite/RvFhXUdZ9H';

/**
 * The credits guide.
 *
 * WHAT CHANGED AND WHY. This page used to live at `/help/credits` and rendered
 * as twenty-six stacked `Card`s — a title, a one-line description, sometimes a
 * paragraph, then the next card. Cards are for things you pick between; a
 * document read top to bottom is prose with headings. The rewrite keeps every
 * figure and claim and changes only the container: prose sections, a real table
 * for the rate card, definition lists where a card held nothing but a term and
 * its meaning.
 *
 * ==========================================================================
 * ACCURACY GATE — every figure below was read out of `apps/api/src/config.ts`
 * on 2026-08-30. Do not soften, inflate, or round any of it.
 * ==========================================================================
 *  - MODELS, KORTIX KEY: 20% markup. `KORTIX_MARKUP = 1.2` (config.ts:1339),
 *    and `DEFAULT_LLM_PRICE_MARKUP = 1.2` (billing/services/tiers.ts:34).
 *  - BRING YOUR OWN KEY: flat 10% platform fee, NOT 10% of the model bill on
 *    top of the markup. `PLATFORM_FEE_MARKUP = 0.1` (config.ts:1342), applied
 *    in `resolve-candidates.ts:241`, which also zeroes it on the free tier.
 *  - TOOLS: 50%. `markupMultiplier: 1.5` on `web_search_basic`,
 *    `web_search_advanced`, `proxy_tavily`, `proxy_serper`, `proxy_firecrawl`,
 *    `proxy_context7` (config.ts TOOL_PRICING).
 *  - IMAGE SEARCH: 100%. `image_search.markupMultiplier: 2.0`, the one entry
 *    in TOOL_PRICING that is not 1.5. It is called out separately for exactly
 *    that reason — do not fold it into the tools row.
 *  - CREDIT PRIORITY: expiring is spent before non-expiring. Stated in the
 *    original page and unchanged here.
 *  - NO MODEL NAMES. The old copy named "GPT-4" twice as the example of an
 *    expensive frontier model. It shipped in 2023 and is no longer anybody's
 *    frontier tier, so the advice read as dated in a way that undermined the
 *    rest of the page. Describe the tier, never the model of the month.
 */
export default function SupportCreditsPage() {
  const t = useTranslations('support.credits');

  const sections = [
    { id: 'what', label: t('whatTitle') },
    { id: 'kinds', label: t('kindsTitle') },
    { id: 'rates', label: t('ratesTitle') },
    { id: 'getting', label: t('gettingTitle') },
    { id: 'tracking', label: t('trackingTitle') },
    { id: 'optimizing', label: t('optimizingTitle') },
    { id: 'help', label: t('helpTitle') },
  ];

  return (
    <main className="bg-background min-h-screen">
      <div className={cn(SUPPORT_CONTAINER, 'pb-24 sm:pb-32')}>
        <SupportHeader
          title={t('title')}
          lead={t('lead')}
          backTo={{ href: '/support', label: t('backToSupport') }}
        />

        <Separator />

        <SupportDocGrid sections={sections}>
          <Section id="what" title={t('whatTitle')}>
            <div className="space-y-4">
              <P>{t('whatBody')}</P>
              <P>{t('whatSpend')}</P>
            </div>
          </Section>

          <Section id="kinds" title={t('kindsTitle')}>
            <div className="space-y-4">
              <P>{t('kindsLead')}</P>
              <DefinitionList>
                <Definition term={t('kindsExpiringTerm')} aside={t('kindsExpiringAside')}>
                  {t('kindsExpiringBody')}
                </Definition>
                <Definition term={t('kindsNonExpiringTerm')} aside={t('kindsNonExpiringAside')}>
                  {t('kindsNonExpiringBody')}
                </Definition>
              </DefinitionList>
              <Note>{t('kindsPriority')}</Note>
            </div>
          </Section>

          <Section id="rates" title={t('ratesTitle')}>
            <div className="space-y-4">
              <P>{t('ratesLead')}</P>

              {/* Tabular data, finally in a table. This was four bullets inside
                  a Card, which made two rates that differ by 2x look like prose
                  rather than a price list. `overflow-x-auto` so the narrow
                  viewport scrolls the table instead of the page. */}
              <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[26rem] border-collapse text-left">
                  <thead>
                    <tr className="border-border border-b">
                      <th
                        scope="col"
                        className="text-muted-foreground pb-2 pr-4 text-xs font-medium tracking-wide"
                      >
                        {t('ratesColumnService')}
                      </th>
                      <th
                        scope="col"
                        className="text-muted-foreground pb-2 pl-4 text-right text-xs font-medium tracking-wide"
                      >
                        {t('ratesColumnRate')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    <RateRow service={t('ratesModelsService')} rate="20%" note={t('ratesModelsNote')} />
                    <RateRow service={t('ratesToolsService')} rate="50%" note={t('ratesToolsNote')} />
                    <RateRow service={t('ratesImagesService')} rate="100%" note={t('ratesImagesNote')} />
                    <RateRow service={t('ratesByokService')} rate="10%" note={t('ratesByokNote')} />
                  </tbody>
                </table>
              </div>

              <Note>{t('ratesWhy')}</Note>
            </div>
          </Section>

          <Section id="getting" title={t('gettingTitle')}>
            <div className="space-y-4">
              <P>{t('gettingLead')}</P>
              <DefinitionList>
                <Definition
                  term={t('gettingSubscriptionTerm')}
                  aside={t('kindsExpiringTerm')}
                >
                  {t('gettingSubscriptionBody')}
                </Definition>
                <Definition term={t('gettingTopUpTerm')} aside={t('kindsNonExpiringTerm')}>
                  {t('gettingTopUpBody')}
                </Definition>
                <Definition term={t('gettingGrantsTerm')} aside={t('kindsNonExpiringTerm')}>
                  {t('gettingGrantsBody')}
                </Definition>
                <Definition term={t('gettingRefundsTerm')} aside={t('kindsNonExpiringTerm')}>
                  {t('gettingRefundsBody')}
                </Definition>
              </DefinitionList>
            </div>
          </Section>

          <Section id="tracking" title={t('trackingTitle')}>
            <div className="space-y-4">
              <P>{t('trackingLead')}</P>
              <DefinitionList>
                <Definition term={t('trackingBillingTerm')}>{t('trackingBillingBody')}</Definition>
                <Definition term={t('trackingUsageTerm')}>{t('trackingUsageBody')}</Definition>
              </DefinitionList>
            </div>
          </Section>

          <Section id="optimizing" title={t('optimizingTitle')}>
            <div className="space-y-4">
              <P>{t('optimizingLead')}</P>
              <DefinitionList>
                <Definition term={t('optimizingModelsTerm')}>
                  {t('optimizingModelsBody')}
                </Definition>
                <Definition term={t('optimizingClarityTerm')}>
                  {t('optimizingClarityBody')}
                </Definition>
                <Definition term={t('optimizingMonitorTerm')}>
                  {t('optimizingMonitorBody')}
                </Definition>
                <Definition term={t('optimizingCachingTerm')}>
                  {t('optimizingCachingBody')}
                </Definition>
              </DefinitionList>
            </div>
          </Section>

          <Section id="help" title={t('helpTitle')}>
            <div className="space-y-4">
              <P>
                {t('helpLeadBefore')}{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK}>
                  {SUPPORT_EMAIL}
                </a>
                {t('helpLeadMiddle')}{' '}
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK}
                >
                  {t('helpDiscord')}
                </a>
                {t('helpLeadAfter')}
              </P>
              <Note>{t('helpCommitment')}</Note>
              <p className="pt-2">
                <Link href="/support" className={cn(LINK, 'text-[15px]')}>
                  {t('helpAllTopics')}
                </Link>
              </p>
            </div>
          </Section>
        </SupportDocGrid>
      </div>
    </main>
  );
}

/**
 * One row of the rate card: what you are buying, what we add, and the sentence
 * that stops the number being ambiguous.
 */
function RateRow({ service, rate, note }: { service: string; rate: string; note: string }) {
  return (
    <tr>
      <th scope="row" className="max-w-[22rem] py-4 pr-4 text-left align-top font-normal">
        <span className="text-foreground block text-sm font-medium tracking-tight">{service}</span>
        <span className="text-muted-foreground mt-1 block text-[13px] leading-6 text-pretty">
          {note}
        </span>
      </th>
      {/* `tabular-nums` so the percentages line up on the decimal edge. */}
      <td className="text-foreground py-4 pl-4 text-right align-top text-sm tabular-nums">
        {rate}
      </td>
    </tr>
  );
}
