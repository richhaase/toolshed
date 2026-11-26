#!/usr/bin/env node
// Look at pages before writing a storyboard: saves a screenshot of each URL and prints its
// accessibility outline, which is where getByRole / getByLabel / getByText locators come from.
//
//   node rehearse.mjs [--viewport 1280x720] [--out DIR] [--state FILE] URL [URL ...]
//
// --state loads cookies and storage saved by an earlier build (<storyboard folder>/.docent/state.json),
// so signed-in pages can be inspected. For anything longer, write your own script and load
// Playwright the same way this file does.
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireDep, slug } from './lib/util.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i < 0 ? fallback : args.splice(i, 2)[1];
};
const [width, height] = opt('--viewport', '1280x720').split('x').map(Number);
const out = path.resolve(opt('--out', 'rehearsal'));
const state = opt('--state', null);
if (!args.length) {
  console.error('usage: rehearse.mjs [--viewport WxH] [--out DIR] [--state FILE] URL [URL ...]');
  process.exit(2);
}

const { chromium } = requireDep('playwright');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height }, storageState: state ?? undefined });
const page = await context.newPage();
await fs.mkdir(out, { recursive: true });
try {
  for (const url of args) {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const shot = path.join(out, `${slug(url.replace(/^https?:\/\//, ''))}.png`);
    await page.screenshot({ path: shot });
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log(`\n=== ${url}\nscreenshot: ${shot}\nviewport ${width}x${height}, page height ${pageHeight}px\n`);
    console.log(await page.locator('body').ariaSnapshot());
  }
} finally {
  await browser.close();
}
