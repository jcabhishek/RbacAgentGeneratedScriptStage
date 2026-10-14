// Custom fixtures for the BDD (Cucumber) suite.
// `ctx` is per-scenario state shared between steps (current dialog, remembered values).
const fs = require('fs');
const { test: base, createBdd } = require('playwright-bdd');
const allure = require('allure-js-commons');
const { tempName, runNames } = require('../../tests/rbac/helpers');

// Records created by the ordered flow (02 Application -> 03 Pages -> 04 Features -> 05 Roles ->
// 06 Users): one application with two pages, one feature on each page, and a role granting both.
// The run id is shared by every feature in the run (see playwright.config.ts);
// the "B" suffix keeps them apart from the records created by the spec suite.
const names = runNames('B');
const TOKENS = {
  $EMAIL: process.env.RBAC_EMAIL,
  $APP: names.APP,
  $APP_LOWER: names.APP.toLowerCase(),
  $PAGE: names.PAGE,
  $PAGE2: names.PAGE2,
  $FEATURE: names.FEATURE,
  $FEATURE2: names.FEATURE2,
  $ROLE: names.ROLE,
  $USER: names.USER_ID,
  $USER2: names.USER2_ID,
  $EXISTING_APP: names.EXISTING_APP,
  $EMPTY_APP: names.EMPTY_APP,
};

const TEMP_TYPES = { $TEMP_APP: 'App', $TEMP_PAGE: 'Page', $TEMP_FEATURE: 'Feature', $TEMP_ROLE: 'Role' };

// ---------- One browser page per worker (log in once, not once per scenario) ----------
// Logging in took ~13s and was two thirds of the run time. The app keeps part of its session in
// memory and deep links to /home return 404, so a saved storageState cannot be reused: instead the
// worker keeps one page, and "Given I am logged in" only logs in when that page is not logged in.
// Every test still gets its own trace and a final screenshot.
// After a failure Playwright starts a new worker, which logs in again.
// Set RBAC_FRESH_LOGIN=true to go back to a new browser context and login for every test.
const SHARED_PAGE = process.env.RBAC_FRESH_LOGIN !== 'true';

// Close what a previous scenario left open. Confirmations are answered "No" (never "Yes").
// Clicks are time-limited: an open dropdown can cover a dialog's Cancel button.
async function closeLeftoverDialogs(page) {
  const click = locator => locator.click({ timeout: 5000 }).catch(() => page.keyboard.press('Escape').catch(() => {}));
  for (let i = 0; i < 4 && !page.isClosed(); i++) {
    const popup = page.locator('.swal2-popup:visible');
    if (await popup.count()) {
      const safe = popup.getByRole('button', { name: /^(No|Cancel|OK)$/ }).first();
      if (await safe.count()) await click(safe);
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      continue;
    }
    const dialog = page.locator('mat-dialog-container');
    if (await dialog.count()) {
      // Close an open dropdown first (ng-select / multiselect), then cancel the dialog.
      await page.keyboard.press('Escape').catch(() => {});
      await page.mouse.click(5, 5).catch(() => {});
      const cancel = dialog.getByRole('button', { name: /^(Cancel|Close|No)$/ }).first();
      if (await cancel.count()) await click(cancel);
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      continue;
    }
    break;
  }
  // The app's popups sometimes leave aria-hidden on the page root after closing. On a shared page
  // that would hide the next scenario's grid from role-based locators, so clear it when no
  // dialog is open.
  await page.evaluate(() => {
    if (document.querySelector('.swal2-container, mat-dialog-container')) return;
    document.querySelectorAll('body > [aria-hidden="true"]').forEach(el => el.removeAttribute('aria-hidden'));
  }).catch(() => {});
}

const sharedPageFixtures = {
  sharedPage: [async ({ browser }, use) => {
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    await use(page);
    await context.close().catch(() => {});
  }, { scope: 'worker' }],

  page: async ({ sharedPage: page }, use, testInfo) => {
    // Every set-up / tear-down action is time-limited, so housekeeping can never time a test out;
    // an action that runs out of time is recorded as an annotation on the test.
    const limited = (label, ms, action) => {
      let timer;
      const timeout = new Promise(resolve => {
        timer = setTimeout(() => {
          testInfo.annotations.push({ type: 'housekeeping timeout', description: `${label} took over ${ms / 1000}s` });
          resolve();
        }, ms);
      });
      return Promise.race([Promise.resolve().then(action).catch(() => {}), timeout]).finally(() => clearTimeout(timer));
    };
    const context = page.context();
    // A separate trace per test (start/stop, not chunks: a chunk also carries the network log
    // recorded before it, so each test's trace would list earlier tests' API calls).
    await limited('start trace', 15000, () => context.tracing.start({
      title: testInfo.titlePath.slice(1).join(' › '), screenshots: true, snapshots: true, sources: true,
    }));
    // Server errors seen during the test: a passing test keeps its trace only when it saw one, so
    // the summary email can still show that call's URL, payload and response.
    let serverErrors = 0;
    const onResponse = response => { if (response.status() >= 500) serverErrors++; };
    page.on('response', onResponse);
    await limited('close leftover dialogs', 20000, () => closeLeftoverDialogs(page));
    await use(page);
    page.off('response', onResponse);
    // Final screenshot of every test (pass or fail), as `screenshot: 'on'` did before.
    const shot = testInfo.outputPath('final-screenshot.png');
    await limited('final screenshot', 20000, async () => {
      await page.screenshot({ path: shot, timeout: 15000 });
      await testInfo.attach('screenshot', { path: shot, contentType: 'image/png' });
    });
    // Traces only for failures: a passing test's trace is discarded (unless it saw a 5xx error).
    const failed = testInfo.status !== testInfo.expectedStatus;
    const trace = testInfo.outputPath('trace.zip');
    await limited('save trace', 30000, () => context.tracing.stop(failed || serverErrors ? { path: trace } : {}));
    if ((failed || serverErrors) && fs.existsSync(trace)) await testInfo.attach('trace', { path: trace, contentType: 'application/zip' });
    await limited('close dialogs after test', 20000, () => closeLeftoverDialogs(page));
  },
};

const test = base.extend({
  ...(SHARED_PAGE ? sharedPageFixtures : {}),
  // Allure tags: which attempt this is (first-run / rerun-after-fix) and the run id.
  allureAttempt: [async ({}, use) => {
    await allure.tag(process.env.RBAC_ATTEMPT || 'first-run');
    await allure.tag(`run-${process.env.RBAC_RUN_ID}`);
    await use();
  }, { auto: true }],
  ctx: async ({}, use, testInfo) => {
    // Staging still counts deleted names as taken, so a retry cannot reuse the lower-case copy of
    // $APP that the failed attempt created and deleted: retries use the upper-case copy instead.
    const otherCase = testInfo.retry ? names.APP.toUpperCase() : names.APP.toLowerCase();
    const ctx = {
      // Replace $TOKENS in step text. $TEMP_APP / $TEMP_PAGE / $TEMP_FEATURE / $TEMP_ROLE are fresh
      // throw-away names ("Indofast Test Automation <Type> <suffix>"), fixed for the whole scenario.
      temp: {},
      resolve(text) {
        return text.replace(/\$[A-Z_0-9]+/g, token => {
          const type = TEMP_TYPES[token];
          if (type) return (ctx.temp[token] ||= tempName(type));
          if (token === '$REMEMBERED') return ctx.remembered ?? token;
          if (token === '$APP_LOWER') return otherCase;
          return TOKENS[token] ?? token;
        });
      },
    };
    await use(ctx);
  },
});

module.exports = { test, TOKENS, SHARED_PAGE, ...createBdd(test) };
