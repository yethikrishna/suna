import { chromium } from '/Users/markokraemer/Projects/kortix/suna-comms-revamp/node_modules/.pnpm/@playwright+test@1.61.1/node_modules/@playwright/test/index.mjs';

const OUT = '/private/tmp/claude-501/-Users-markokraemer-Projects-kortix-suna/3bec9333-b597-47c4-be52-f0b692c56665/scratchpad';
const URL = 'http://localhost:15100/';

const probe = () => {
  const section = document.querySelector('#use-cases');
  const sticky = section.querySelector('.sticky');
  const stickyRect = sticky.getBoundingClientRect();
  const header = sticky.querySelector('#use-case-wheel-title').closest('div.mx-auto');
  const headerRect = header.getBoundingClientRect();
  const cards = [...section.querySelectorAll('article[data-use-case]')];
  const info = cards.map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const m = new DOMMatrixReadOnly(cs.transform);
    return {
      id: el.dataset.useCase,
      active: el.dataset.active === 'true',
      opacity: Number(cs.opacity),
      filter: cs.filter,
      scale: Math.hypot(m.a, m.b).toFixed(3),
      cssWidth: Math.round(el.offsetWidth * Math.hypot(m.a, m.b)),
      width: Math.round(r.width),
      height: Math.round(r.height),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      visible: cs.visibility !== 'hidden' && Number(cs.opacity) > 0.09,
    };
  });
  const vis = info.filter((c) => c.visible);
  const deckTop = Math.min(...vis.map((c) => c.top));
  const deckBottom = Math.max(...vis.map((c) => c.bottom));
  const activeIdx = info.findIndex((c) => c.active);
  const overflow = cards
    .map((el) => ({ id: el.dataset.useCase, over: el.scrollHeight - el.clientHeight }))
    .filter((c) => c.over > 0);
  // Dead space inside the ACTIVE card only: rotated cards report axis-aligned
  // bboxes, so their child rects are meaningless for this.
  const act = cards.find((el) => el.dataset.active === 'true');
  const body = act.querySelector('p');
  const mock = act.lastElementChild;
  const slackMax = Math.round(mock.getBoundingClientRect().top - body.getBoundingClientRect().bottom);
  const slackMin = slackMax;
  return {
    stickyTop: Math.round(stickyRect.top),
    stickyBottom: Math.round(stickyRect.bottom),
    headerBottom: Math.round(headerRect.bottom),
    deckTop,
    deckBottom,
    gapAbove: deckTop - Math.round(headerRect.bottom),
    gapBelow: Math.round(stickyRect.bottom) - deckBottom,
    gapFromViewportTop: deckTop - Math.round(stickyRect.top),
    active: info[activeIdx],
    left: info[(activeIdx - 1 + info.length) % info.length],
    right: info[(activeIdx + 1) % info.length],
    visibleCount: vis.length,
    overflow,
    slackMax,
    slackMin,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  };
};

const browser = await chromium.launch();

async function run(width, height, shots) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('#use-cases article[data-use-case]');
  // Sections above the wheel settle after load, so a one-shot scroll target
  // drifts. Converge on the wanted progress by re-reading the live track rect.
  const seek = async (target) => {
    let actual = -1;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      actual = await page.evaluate((want) => {
        const t = document.querySelector('#use-cases > div');
        const span = t.offsetHeight - window.innerHeight;
        const top = t.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top + span * want);
        const now = -t.getBoundingClientRect().top / span;
        return Math.max(0, Math.min(1, now));
      }, target);
      if (Math.abs(actual - target) < 0.002) break;
      await page.waitForTimeout(120);
    }
    return actual;
  };

  const results = [];
  // k/9 lands the head on a whole slot, where the quintic settle holds it.
  const depths = [0.02, 3 / 9, 6 / 9, 0.999];
  for (let i = 0; i < depths.length; i += 1) {
    const got = await seek(depths[i]);
    if (Math.abs(got - depths[i]) > 0.005) throw new Error(`seek missed: ${got} vs ${depths[i]}`);
    await page.waitForTimeout(400);
    const data = await page.evaluate(probe);
    results.push({ depth: depths[i], ...data });
    if (shots) {
      await page.screenshot({
        path: `${OUT}/wheel-v2-${i + 1}.png`,
        animations: 'disabled',
      });
    }
  }
  await page.close();
  return results;
}

const desktop = await run(1440, 900, true);
console.log('=== 1440x900 ===');
for (const r of desktop) {
  console.log(
    `depth ${r.depth} | gapAbove(header→deck) ${r.gapAbove} gapBelow(deck→bottom) ${r.gapBelow} delta ${Math.abs(r.gapAbove - r.gapBelow)} | deck ${r.deckTop}..${r.deckBottom} | sticky ${r.stickyTop}..${r.stickyBottom} headerBottom ${r.headerBottom}`,
  );
  console.log(
    `   active ${r.active.id} w=${r.active.cssWidth}(bbox ${r.active.width}) scale=${r.active.scale} op=${r.active.opacity} filter=${r.active.filter}`,
  );
  console.log(
    `   left   ${r.left.id} w=${r.left.cssWidth}(bbox ${r.left.width}) scale=${r.left.scale} op=${r.left.opacity} filter=${r.left.filter}`,
  );
  console.log(
    `   right  ${r.right.id} w=${r.right.cssWidth}(bbox ${r.right.width}) scale=${r.right.scale} op=${r.right.opacity} filter=${r.right.filter}`,
  );
  console.log(`   scrollWidth=${r.scrollWidth} innerWidth=${r.innerWidth} visible=${r.visibleCount} overflow=${JSON.stringify(r.overflow)} slack=${r.slackMin}..${r.slackMax}`);
}

const mobile = await run(390, 844, false);
console.log('=== 390x844 ===');
for (const r of mobile) {
  console.log(
    `depth ${r.depth} | gapAbove ${r.gapAbove} gapBelow ${r.gapBelow} | scrollWidth=${r.scrollWidth} innerWidth=${r.innerWidth} | active ${r.active.id} w=${r.active.width} op=${r.active.opacity} / left op=${r.left.opacity} w=${r.left.width} overflow=${JSON.stringify(r.overflow)} slack=${r.slackMin}..${r.slackMax}`,
  );
}

await browser.close();
