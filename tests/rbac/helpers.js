// Shared UI helpers for RBAC dashboard tests.
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

const SCREENSHOT_DIR = path.join(__dirname, '..', '..', 'screenshots');

// Every record the tests create starts with this prefix, followed by the record type.
const PREFIX = 'Indofast Test Automation';

// Unique suffix so every run creates fresh, identifiable records.
function uniqueSuffix() {
  return Date.now().toString(36).toUpperCase();
}

// Name for a throw-away record (cancel / validation cases), e.g. "Indofast Test Automation App MV1X2K3".
function tempName(type) {
  return `${PREFIX} ${type} ${uniqueSuffix()}`;
}

// Names of the records created by the ordered flow (Application -> 2 Pages -> 1 Feature per page
// -> Role -> assigned to User). RBAC_RUN_ID is set once per `playwright test` run in
// playwright.config.ts and inherited by every worker, so all files in the run refer to the same
// records. `suite` keeps the spec (S) and BDD (B) suites from colliding when both run.
// The page/feature number is joined to the id ("<id>-1") because the grids search word by word:
// "Page 1 <id>" would also match Page 2's rows, whose dates contain a "1".
function runNames(suite = 'S') {
  const id = `${process.env.RBAC_RUN_ID || uniqueSuffix()}${suite}`;
  return {
    APP: `${PREFIX} App ${id}`,
    PAGE: `${PREFIX} Page ${id}-1`,
    PAGE2: `${PREFIX} Page ${id}-2`,
    FEATURE: `${PREFIX} Feature ${id}-1`,
    FEATURE2: `${PREFIX} Feature ${id}-2`,
    ROLE: `${PREFIX} Role ${id}`,
    USER_ID: process.env.RBAC_TEST_USER_ID || 'SUNMF00000630',
    USER2_ID: process.env.RBAC_TEST_USER2_ID || 'SUNMF00000629',
    EXISTING_APP: process.env.RBAC_EXISTING_APP || 'SM_SERVICE',
    // Application that exists but has no roles (created during exploration).
    EMPTY_APP: process.env.RBAC_EMPTY_APP || 'PW_AUTO_APP_1006',
  };
}

// The app shows a full-page loader that intercepts clicks, and the collapsed
// sidebar expands over the content while hovered. Park the mouse and wait.
async function waitForIdle(page) {
  await page.mouse.move(900, 700);
  await page.locator('.loader_div').waitFor({ state: 'hidden', timeout: 30000 });
}

// Open a module from the sidebar (deep links return 404, so always navigate via the menu).
async function openModule(page, href) {
  await page.locator(`a[href="${href}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await waitForIdle(page);
  // Wait for the grid data (User Logs has no "Showing N entries" status, so check rows)
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('tbody tr').first()).not.toContainText(/loading|processing/i);
}

async function searchGrid(page, text) {
  await page.locator('input[type="search"]').first().fill(text);
}

// Screenshot saved to screenshots/<test title>/<NN-label>.png and attached to the HTML report.
// `fullPage: false` (the visible window) is faster; per-step screenshots use it.
async function snap(page, testInfo, label, { fullPage = true } = {}) {
  const dir = path.join(SCREENSHOT_DIR, testInfo.title.replace(/[^\w-]+/g, '_'));
  fs.mkdirSync(dir, { recursive: true });
  const count = testInfo.attachments.filter(a => a.contentType === 'image/png').length + 1;
  // The label can hold a full error message; keep the file name short (Windows path limit).
  const file = path.join(dir, `${String(count).padStart(2, '0')}-${label.replace(/[^\w-]+/g, '_').slice(0, 80)}.png`);
  // A minimized or covered headed browser stops painting and a screenshot would wait for it;
  // give up after 15s and note it in the report instead of blocking the test.
  try {
    await page.screenshot({ path: file, fullPage, timeout: 15000 });
  } catch (error) {
    await testInfo.attach(`${label} (screenshot not taken)`, { body: error.message.split('\n')[0], contentType: 'text/plain' });
    return;
  }
  await testInfo.attach(label, { path: file, contentType: 'image/png' });
}

// SweetAlert-style popup: assert its heading, screenshot it, then dismiss with OK.
async function expectAlert(page, testInfo, heading, label) {
  const title = page.getByRole('heading', { level: 2, name: heading });
  await expect(title).toBeVisible({ timeout: 30000 });
  await snap(page, testInfo, label);
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(title).toBeHidden();
  await waitForIdle(page);
}

// Open an Add dialog. The dialog autofocuses its first field once its open animation
// finishes; typing before that sends text into the wrong field, so wait for focus.
async function openForm(page, triggerText, dialogName, firstPlaceholder) {
  await waitForIdle(page);
  await page.getByText(triggerText, { exact: true }).click();
  const dialog = page.getByRole('dialog', { name: dialogName });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder(firstPlaceholder)).toBeFocused();
  return dialog;
}

// ng-select dropdown inside a dialog: type to filter, then pick the exact option.
async function ngSelect(page, dialog, value) {
  await dialog.getByRole('combobox').first().fill(value);
  await page.getByRole('option', { name: value, exact: true }).click();
}

// Automation roles: current naming plus the old PW_AUTO_ROLE_* records from earlier runs.
const AUTOMATION_ROLE = new RegExp(`${PREFIX} Role |PW_AUTO_ROLE_`);

// Remove any automation roles still assigned to a user, e.g. after a failed run.
async function unassignAutomationRoles(page, userId) {
  await openModule(page, '/home/rbac-users');
  await searchGrid(page, userId);
  const row = page.locator('tbody tr').first();
  await expect(row).toContainText(userId);
  if (!AUTOMATION_ROLE.test(await row.innerText())) return;

  await row.locator('.fa-unlink').click();
  await waitForIdle(page);
  const dialog = page.getByRole('dialog', { name: /unassignRole/ });
  await expect(dialog).toBeVisible();
  const items = dialog.getByRole('listitem').filter({ hasText: AUTOMATION_ROLE });
  for (let i = 0; i < await items.count(); i++) {
    await items.nth(i).getByRole('checkbox').check();
  }
  await dialog.getByRole('button', { name: 'Submit' }).click();
  await page.getByRole('button', { name: 'OK' }).click({ timeout: 30000 });
  await waitForIdle(page);
}

// Put a shared test user back to its normal state after an earlier or failed run:
// re-enable it, strip a leftover "_PWEDIT" name suffix and remove automation roles.
async function resetTestUser(page, userId) {
  await openModule(page, '/home/rbac-users');
  await searchGrid(page, userId);
  const row = page.locator('tbody tr').first();
  await expect(row).toContainText(userId);
  const confirmAndAck = async () => {
    await page.getByRole('dialog').getByRole('button', { name: 'Yes' }).click();
    await page.getByRole('button', { name: 'OK' }).click({ timeout: 30000 });
    await waitForIdle(page);
    await searchGrid(page, userId);
  };

  if (await row.locator('.fa-check-circle').count()) {
    await row.locator('.fa-check-circle').click();
    await confirmAndAck();
  }
  if ((await row.innerText()).includes('_PWEDIT')) {
    await row.locator('.fa-edit').click();
    await waitForIdle(page);
    const first = page.getByRole('dialog').getByPlaceholder('Enter first name');
    await first.fill((await first.inputValue()).replace(/(_PWEDIT)+$/, ''));
    await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
    await page.getByRole('button', { name: 'OK' }).click({ timeout: 30000 });
    await waitForIdle(page);
  }
  await unassignAutomationRoles(page, userId);
}

module.exports = { PREFIX, resetTestUser, runNames, tempName, unassignAutomationRoles, uniqueSuffix, waitForIdle, openModule, searchGrid, snap, expectAlert, openForm, ngSelect };
