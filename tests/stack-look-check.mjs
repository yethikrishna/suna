import { chromium } from '/Users/markokraemer/Projects/kortix/suna-comms-revamp/node_modules/.pnpm/@playwright+test@1.61.1/node_modules/@playwright/test/index.mjs';
const OUT = '/private/tmp/claude-501/-Users-markokraemer-Projects-kortix-suna/3bec9333-b597-47c4-be52-f0b692c56665/scratchpad';
const URL = 'http://localhost:15100/rauch/stack-preview';
const b = await chromium.launch();

// light: section header in normal flow
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(URL, { waitUntil: 'networkidle', timeout: 180000 });
await p.waitForSelector('[data-stack-track]');
await p.evaluate(() => window.scrollTo(0, 300));
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/stack-header.png`, animations: 'disabled' });

// dark theme, mid-track
await p.evaluate(() => { document.documentElement.classList.add('dark'); document.documentElement.style.colorScheme = 'dark'; });
const t = await p.evaluate(() => { const r = document.querySelector('[data-stack-track]').getBoundingClientRect(); return { top: r.top + window.scrollY, height: r.height, vh: window.innerHeight }; });
await p.evaluate((y) => window.scrollTo(0, y), Math.round(t.top + (t.height - t.vh) * 0.05));
await p.waitForTimeout(2200);
await p.screenshot({ path: `${OUT}/stack-dark.png`, animations: 'disabled' });

// skip link works
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(600);
const before = await p.evaluate(() => window.scrollY);
await p.evaluate(() => { const t2 = document.querySelector('[data-stack-track]').getBoundingClientRect(); window.scrollTo(0, t2.top + window.scrollY + 200); });
await p.waitForTimeout(1500);
await p.click('a[href="#platform-stack-end"]');
await p.waitForTimeout(1200);
const after = await p.evaluate(() => ({ y: window.scrollY, endTop: document.querySelector('#platform-stack-end').getBoundingClientRect().top }));
console.log('skip link: before=', before, 'after=', JSON.stringify(after));
await b.close();
