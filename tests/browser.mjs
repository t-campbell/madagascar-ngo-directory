import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';
import { server } from '../scripts/preview.mjs';

server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const context = await browser.newContext({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 180, downloadThroughput: 200 * 1024 / 8, uploadThroughput: 80 * 1024 / 8
  });
  const start = performance.now();
  await page.goto(origin + '/?q=soakoja&region=analanjirofo&sector=wash');
  await page.locator('#filters').waitFor();
  const loadMs = Math.round(performance.now() - start);
  assert.equal(await page.getByRole('status').textContent(), '1 organisation');
  assert.equal(await page.locator('#results h3').textContent(), 'Soakoja');
  assert.equal(await page.getByRole('link', { name: 'Call', exact: true }).getAttribute('href'), 'tel:+261348521408');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  for (const width of [390, 430, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }
  await page.setViewportSize({ width: 320, height: 720 });
  const field = page.getByRole('searchbox', { name: 'Organisation name' });
  await field.fill('AVSF');
  await field.press('Enter');
  await page.getByText('0 organisations', { exact: true }).waitFor();
  await page.goBack();
  assert.equal(await field.inputValue(), 'soakoja');
  assert.equal(await page.locator('#results h3').textContent(), 'Soakoja');
  await page.goForward();
  assert.equal(await field.inputValue(), 'AVSF');
  assert.equal(await page.getByRole('status').textContent(), '0 organisations');
  await page.goBack();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download filtered CSV' }).click();
  const file = await download;
  const text = await readFile(await file.path(), 'utf8');
  assert.match(text, /soakoja-analanjirofo-wash/);
  assert.doesNotMatch(text, /Saint-Benoît/);
  await page.getByRole('link', { name: 'View details for Soakoja' }).click();
  await page.getByRole('heading', { name: 'Public contacts', exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'Soakoja');
  assert.equal((await page.reload()).status(), 200);
  await page.getByRole('link', { name: 'interaide-madagascar', exact: true }).first().click();
  await page.waitForFunction(() => document.querySelector('#sources').open);
  assert.equal((await page.goto(origin + '/ngo/unknown-org/')).status(), 404);
  await page.goto(origin + '/regions/boeny/');
  await page.locator('#results').getByText('No organisations documented here yet.', { exact: true }).waitFor();
  await page.goto(origin + '/contribute/');
  await page.getByRole('button', { name: 'Copy template' }).first().waitFor();
  const config = JSON.parse(await readFile(new URL('../site.config.json', import.meta.url), 'utf8'));
  assert.equal(await page.getByRole('link', { name: 'Open email draft' }).count(), config.maintainer_email ? 3 : 0);
  assert.deepEqual(errors, []);

  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const staticPage = await noJs.newPage();
  await staticPage.goto(origin + '/regions/analanjirofo/');
  assert.ok(await staticPage.getByRole('link', { name: 'Soakoja', exact: true }).isVisible());
  await staticPage.goto(origin + '/ngo/soakoja/');
  assert.ok(await staticPage.getByRole('heading', { name: 'Public contacts' }).isVisible());
  await staticPage.getByText('Sources and evidence', { exact: false }).click();
  assert.ok(await staticPage.getByRole('link', { name: 'Soakoja organisation record' }).isVisible());
  await noJs.close();

  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const current = JSON.parse(await readFile(new URL('../dist/search-index.json', import.meta.url), 'utf8'));
  const records = Array.from({ length: 500 }, (_, i) => {
    const base = current.records[i % current.records.length];
    return { ...base, id: 'fixture-' + i, name: base.name + ' ' + i };
  });
  await page.route('**/search-index.json', route => route.fulfill({ json: { ...current, records } }));
  await page.goto(origin + '/?q=soakoja');
  await page.locator('#filters').waitFor();
  const benchmark = await page.evaluate(async () => {
    const form = document.querySelector('#filters');
    const input = form.elements.namedItem('q');
    const samples = [];
    for (const query of ['', 'soakoja', '', 'soakoja', '', 'soakoja', '', 'soakoja', '', 'soakoja']) {
      input.value = query;
      const begin = performance.now();
      form.requestSubmit();
      samples.push(performance.now() - begin);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    return samples;
  });
  assert.ok(benchmark.every(ms => ms < 100), '500-record filter/render exceeded 100 ms: ' + benchmark.join(', '));
  console.log('Chromium ' + browser.version() + ', headless. Mobile widths 320, 390 and 430 px, desktop 1280 px.');
  console.log('Constrained mobile load ' + loadMs + ' ms to interactive at 200 kbps down, 80 kbps up and 180 ms added latency.');
  console.log('500-record fixture: ' + Math.max(...benchmark).toFixed(1) + ' ms worst synchronous filter and DOM update across 10 runs, excluding paint.');
  console.log('Passed search, URL history, export, contact links, static profiles, 404 and no-JavaScript checks.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
