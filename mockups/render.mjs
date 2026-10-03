// Renders every mockups/screens/*.html to mockups/out/<name>.png
// Usage: node mockups/render.mjs [filter]   (filter = substring of file name)
// Phone files (name starts with "m-") => 390x844 @2x. Desktop ("d-") => 1280x800 @1.
// Dark variant: add "-dark" to file name, or the page sets data-theme itself.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || '';
const files = readdirSync(path.join(here, 'screens')).filter(f => f.endsWith('.html') && f.includes(filter));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const f of files) {
  const desktop = f.startsWith('d-');
  const ctx = await browser.newContext({
    viewport: desktop ? { width: 1280, height: 800 } : { width: 390, height: 844 },
    deviceScaleFactor: desktop ? 1 : 2,
  });
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(here, 'screens', f), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(here, 'out', f.replace('.html', '.png')) });
  console.log('rendered', f);
  await ctx.close();
}
await browser.close();
