#!/usr/bin/env node
/**
 * Screenshot helper for visual QA (dev-only).
 *
 *   node tools/shoot.mjs --url http://localhost:4321/ --selector "#car" --out /tmp/bilal-shots/car
 *     [--viewports desktop,mobile] [--scroll 0.5] [--wait 1200] [--full] [--reduced]
 *
 * Writes <out>-<viewport>.png (default: <os tmpdir>/bilal-shots/page, never inside the
 * repo) and prints console errors / page errors so broken scripts are caught, not just
 * broken pixels. Exit code 2 if the page logged errors.
 */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith('--')) {
      const next = all[i + 1];
      acc.push([cur.slice(2), next && !next.startsWith('--') ? next : true]);
    }
    return acc;
  }, []),
);

const url = args.url ?? 'http://localhost:4321/';
const out = typeof args.out === 'string' ? args.out : join(tmpdir(), 'bilal-shots', 'page');
const selector = typeof args.selector === 'string' ? args.selector : null;
const scrollFrac = args.scroll ? Number(args.scroll) : 0; // 0..1 through the target section
const wait = args.wait ? Number(args.wait) : 1200;
const viewports = String(args.viewports ?? 'desktop,mobile').split(',');
const SIZES = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  laptop: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

mkdirSync(dirname(out), { recursive: true });

// Browser: $CHROME_PATH, else the cloud sandbox's preinstalled Chromium, else Playwright's own
// download (run `npx playwright-core install chromium` once on a local machine).
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROME_PATH ?? (existsSync(SANDBOX_CHROME) ? SANDBOX_CHROME : undefined);
let browser;
try {
  browser = await chromium.launch({
    executablePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
} catch (err) {
  console.error(
    `Could not launch Chromium (${err.message.split('\n')[0]}).\n` +
      'Set CHROME_PATH to a Chrome/Chromium binary, or run: npx playwright-core install chromium',
  );
  process.exit(1);
}

let hadErrors = false;
for (const vp of viewports) {
  const size = SIZES[vp] ?? SIZES.desktop;
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.deviceScaleFactor,
    isMobile: size.isMobile,
    hasTouch: size.hasTouch,
    reducedMotion: args.reduced ? 'reduce' : 'no-preference',
  });
  // Skip the intro loader during QA unless explicitly testing it.
  if (!args.loader) {
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem('bilal:skip-intro', '1');
      } catch {}
    });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto(url, { waitUntil: 'networkidle' });
  if (selector) {
    await page.evaluate(
      async ({ selector, scrollFrac }) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`selector not found: ${selector}`);
        const rect = el.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const travel = Math.max(0, rect.height - window.innerHeight);
        const y = top + travel * scrollFrac;
        // Step through so scroll-triggered animations fire in order.
        const steps = 12;
        const start = window.scrollY;
        for (let i = 1; i <= steps; i++) {
          window.scrollTo(0, start + ((y - start) * i) / steps);
          await new Promise((r) => setTimeout(r, 60));
        }
      },
      { selector, scrollFrac },
    );
  }
  await page.waitForTimeout(wait);
  const file = `${out}-${vp}.png`;
  await page.screenshot({ path: file, fullPage: Boolean(args.full) });
  console.log(`saved ${file}`);
  if (errors.length) {
    hadErrors = true;
    console.log(`[${vp}] errors:\n  ${errors.join('\n  ')}`);
  }
  await context.close();
}

await browser.close();
process.exit(hadErrors ? 2 : 0);
