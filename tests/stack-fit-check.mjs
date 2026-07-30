import { chromium } from '/Users/markokraemer/Projects/kortix/suna-comms-revamp/node_modules/.pnpm/@playwright+test@1.61.1/node_modules/@playwright/test/index.mjs';
const OUT = '/private/tmp/claude-501/-Users-markokraemer-Projects-kortix-suna/3bec9333-b597-47c4-be52-f0b692c56665/scratchpad';
const URL = 'http://localhost:15100/rauch/stack-preview';
const browser = await chromium.launch();
for (const [w, h, tag] of [[1366, 660, 'short'], [1440, 900, 'tall'], [390, 780, 'mobile']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForSelector('[data-stack-track]');
  const t = await page.evaluate(() => {
    const el = document.querySelector('[data-stack-track]');
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, height: r.height, vh: window.innerHeight };
  });
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(t.top + (t.height - t.vh) * 0.45));
  await page.waitForTimeout(2200);
  const m = await page.evaluate(() => {
    const inner = document.querySelector('[data-stack-track] > div > div');
    const r = inner.getBoundingClientRect();
    const skip = document.querySelector('a[href="#platform-stack-end"]').getBoundingClientRect();
    return { innerH: Math.round(r.height), scrollH: inner.scrollHeight, skipBottom: Math.round(skip.bottom), vh: window.innerHeight,
      hover: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  console.log(tag, w + 'x' + h, JSON.stringify(m));
  await page.screenshot({ path: `${OUT}/fit-${tag}.png`, animations: 'disabled' });
  await page.close();
}
await browser.close();
