import { chromium } from '/Users/markokraemer/Projects/kortix/suna-comms-revamp/node_modules/.pnpm/@playwright+test@1.61.1/node_modules/@playwright/test/index.mjs';

const OUT = '/private/tmp/claude-501/-Users-markokraemer-Projects-kortix-suna/3bec9333-b597-47c4-be52-f0b692c56665/scratchpad';
const URL = 'http://localhost:15100/rauch/stack-preview';
const DEPTHS = [0.04, 0.24, 0.45, 0.66, 0.95];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text()); });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForSelector('[data-stack-track]');

const track = await page.evaluate(() => {
  const el = document.querySelector('[data-stack-track]');
  const r = el.getBoundingClientRect();
  return { top: r.top + window.scrollY, height: r.height, vh: window.innerHeight };
});
console.log('track:', JSON.stringify(track), 'trackVH=', (track.height / track.vh).toFixed(2));

const hscroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('horizontal overflow px:', hscroll);

const results = [];
for (let i = 0; i < DEPTHS.length; i++) {
  const p = DEPTHS[i];
  const y = Math.round(track.top + (track.height - track.vh) * p);
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(2200);
  const state = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-stack-layer]')];
    const expanded = rows.filter((r) => r.dataset.expanded === 'true').map((r) => r.dataset.stackLayer);
    const heights = rows.map((r) => ({
      id: r.dataset.stackLayer,
      expanded: r.dataset.expanded,
      bodyH: Math.round(r.querySelector('[data-stack-body]').getBoundingClientRect().height),
    }));
    const bar = document.querySelector('[data-stack-scrubber]');
    return { expanded, heights, scrubber: bar ? bar.style.width : null };
  });
  results.push({ depth: p, scrollY: y, ...state });
  console.log(`depth ${p} y=${y} expanded=${JSON.stringify(state.expanded)} scrubber=${state.scrubber}`);
  console.log('  bodyHeights:', state.heights.map((h) => `${h.id}:${h.bodyH}`).join(' '));
  await page.screenshot({ path: `${OUT}/stack-${i + 1}.png`, animations: 'disabled' });
}

// ASSERTIONS
let ok = true;
const seq = results.map((r) => r.expanded.join(','));
if (new Set(seq).size < 4) { ok = false; console.log('FAIL: expanded layer did not advance across depths:', seq); }
for (const r of results) {
  if (r.expanded.length !== 1) { ok = false; console.log('FAIL: not exactly one expanded at depth', r.depth, r.expanded); }
  const open = r.heights.filter((h) => h.bodyH > 0);
  if (open.length !== 1 || open[0].expanded !== 'true') {
    ok = false; console.log('FAIL: body heights do not isolate one panel at depth', r.depth, JSON.stringify(open));
  }
  const labels = r.heights.length;
  if (labels !== 7) { ok = false; console.log('FAIL: expected 7 labels, got', labels); }
}
if (results[0].expanded[0] !== 'context') { ok = false; console.log('FAIL: first depth not context'); }
if (results.at(-1).expanded[0] !== 'kortix') { ok = false; console.log('FAIL: last depth not kortix'); }
if (hscroll > 0) { ok = false; console.log('FAIL: horizontal page scrollbar', hscroll); }
console.log(ok ? 'ALL ASSERTIONS PASS' : 'ASSERTIONS FAILED');

// reduced motion check
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p2 = await rm.newPage();
await p2.goto(URL, { waitUntil: 'networkidle', timeout: 180000 });
await p2.waitForTimeout(500);
const rmState = await p2.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-stack-layer]')];
  return {
    count: rows.length,
    allExpanded: rows.every((r) => r.dataset.expanded === 'true'),
    allBodiesVisible: rows.every((r) => r.querySelector('[data-stack-body]').getBoundingClientRect().height > 0),
    hasTrack: !!document.querySelector('[data-stack-track]'),
  };
});
console.log('reduced-motion:', JSON.stringify(rmState));
await p2.screenshot({ path: `${OUT}/stack-reduced.png`, fullPage: true, animations: 'disabled' });

await browser.close();
process.exit(ok && rmState.allExpanded && rmState.allBodiesVisible && !rmState.hasTrack ? 0 : 1);
