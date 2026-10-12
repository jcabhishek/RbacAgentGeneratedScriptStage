// Step definitions for the RBAC dashboard features. They reuse the helpers from the
// spec suite (tests/rbac) so both suites share locators and waits.
const { expect } = require('@playwright/test');
const { Given, When, Then, BeforeAll, AfterAll, AfterStep, TOKENS, SHARED_PAGE } = require('./fixtures');
const { BASE_URL, login, loginAsAdmin } = require('../../tests/rbac/auth');
const {
  PREFIX, waitForIdle, openModule, searchGrid, snap, expectAlert, openForm, ngSelect, resetTestUser,
} = require('../../tests/rbac/helpers');

const MODULES = {
  'Users': '/home/rbac-users',
  'Roles': '/home/rbac-roles',
  'Application': '/home/applications',
  'Pages': '/home/pages',
  'Features': '/home/features',
  'User Logs': '/home/rbac-logs',
};

// Add-form trigger text -> dialog name and the field that gets autofocus.
const FORMS = {
  'Add Application': [/AddApplication/, 'Enter app name'],
  'Add Page': [/AddPage/, 'Enter page name'],
  'Add Feature': [/AddFeature/, 'Enter feature name'],
  'Add Role': [/AddRole/, 'Enter user role name'],
};

const firstRow = page => page.locator('tbody tr').first();

// ---------- Hooks: keep the shared test user free of automation roles ----------

// Both test users are re-enabled, have any "_PWEDIT" name restored and automation roles removed
// before and after the Users feature, so a failed run never leaves them changed.
async function cleanUpTestUsers(browser) {
  const page = await browser.newPage();
  await loginAsAdmin(page);
  await resetTestUser(page, TOKENS.$USER);
  await resetTestUser(page, TOKENS.$USER2);
  await page.close();
}
BeforeAll({ tags: '@users', timeout: 600000 }, async ({ browser }) => cleanUpTestUsers(browser));
AfterAll({ tags: '@users', timeout: 600000 }, async ({ browser }) => cleanUpTestUsers(browser));

// ---------- Hook: screenshot after every step (attached to the HTML and Allure reports) ----------

// Runs after passed and failed steps alike; a page that is already closed is skipped.
AfterStep(async ({ page, $step, $testInfo }) => {
  if (page.isClosed()) return;
  await snap(page, $testInfo, `step - ${$step.title}`.slice(0, 80), { fullPage: false }).catch(() => {});
});

// ---------- Login ----------

Given('I am on the login page', async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});

// With the shared page (see fixtures.js) the session from an earlier scenario is reused: go back to
// the dashboard through the logo link. Otherwise (first scenario, after a failure, after the Login
// feature reloaded the app, or RBAC_FRESH_LOGIN=true) log in.
Given('I am logged in as RBAC admin', async ({ page }) => {
  const sidebar = page.locator('a[href="/home/rbac-users"]');
  if (SHARED_PAGE && /\/home/.test(page.url()) && await sidebar.isVisible().catch(() => false)) {
    await waitForIdle(page);
    await page.locator('a[href="/home"]').first().click();
    await expect(page).toHaveURL(/\/home$/);
    await waitForIdle(page);
    return;
  }
  await loginAsAdmin(page);
});

When('I log in with valid admin credentials', async ({ page }) => {
  await loginAsAdmin(page);
});

When('I log in with email {string} and password {string}', async ({ page, ctx }, email, password) => {
  await login(page, ctx.resolve(email), ctx.resolve(password));
});

When('I click LOGIN', async ({ page }) => {
  await page.getByRole('button', { name: 'LOGIN' }).click();
});

When('I log out', async ({ page }) => {
  await page.locator('app-nav-right').getByRole('link').filter({ hasText: /^$/ }).click();
  await page.getByTitle('Logout').click();
});

Then('I should be on the dashboard', async ({ page }) => {
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('img', { name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
});

Then('I should be on the login page', async ({ page }) => {
  await expect(page).toHaveURL(BASE_URL);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'LOGIN' })).toBeVisible();
});

// ---------- Navigation and generic checks ----------

Given('I open the {string} module', async ({ page }, name) => {
  const href = MODULES[name];
  if (!href) throw new Error(`Unknown module "${name}". Known: ${Object.keys(MODULES).join(', ')}`);
  await openModule(page, href);
});

Then('I should see {string}', async ({ page, ctx }, text) => {
  await expect(page.getByText(ctx.resolve(text)).first()).toBeVisible({ timeout: 30000 });
});

Then('I capture a screenshot {string}', async ({ page, $testInfo }, label) => {
  await snap(page, $testInfo, label);
});

// ---------- Add forms ----------

When('I open the {string} form', async ({ page, ctx }, trigger) => {
  const form = FORMS[trigger];
  if (!form) throw new Error(`Unknown form "${trigger}". Known: ${Object.keys(FORMS).join(', ')}`);
  ctx.dialog = await openForm(page, trigger, ...form);
});

When('I enter {string} in {string}', async ({ ctx }, value, placeholder) => {
  await ctx.dialog.getByPlaceholder(placeholder).fill(ctx.resolve(value));
});

When('I choose {string} from the dropdown', async ({ page, ctx }, value) => {
  await ngSelect(page, ctx.dialog, ctx.resolve(value));
  await waitForIdle(page);
});

When('I grant page {string} with write access to feature {string}', async ({ page, ctx }, pageName, feature) => {
  const pageId = ctx.resolve(pageName);
  await ctx.dialog.locator('li').filter({ has: page.locator(`input[id="${pageId}"]`) }).locator('span.slider').click();
  const featureItem = ctx.dialog.getByRole('listitem').filter({ hasText: ctx.resolve(feature) });
  await featureItem.getByRole('checkbox').first().check();
  await featureItem.getByRole('checkbox').nth(1).check();
});

When('I submit the form', async ({ ctx }) => {
  await ctx.dialog.getByRole('button', { name: 'Submit' }).click();
});

When('I cancel the form', async ({ ctx }) => {
  await ctx.dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(ctx.dialog).toBeHidden();
});

// ---------- Popups and validation ----------

// Popups that report a rejected action; their screenshots are labelled "Error popup - ..." so the
// failure evidence stands out in the HTML and Allure reports.
const ERROR_HEADING = /mandatory|warning|not allowed|error|invalid|already|cannot/i;

// Attach the popup's full text (heading + message) so the exact error is readable in the report.
async function attachPopupText(page, testInfo, name) {
  const popup = page.locator('.swal2-popup:visible');
  if (!(await popup.count())) return;
  const text = (await popup.innerText()).replace(/\s*\bOK\b\s*$/, '').replace(/\s+/g, ' ').trim();
  await testInfo.attach(name, { body: text, contentType: 'text/plain' });
}

Then('I should see the popup {string}', async ({ page, $testInfo }, heading) => {
  if (ERROR_HEADING.test(heading)) {
    await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible({ timeout: 30000 });
    await attachPopupText(page, $testInfo, `Error text - ${heading}`);
    await expectAlert(page, $testInfo, heading, `Error popup - ${heading}`);
  } else {
    await expectAlert(page, $testInfo, heading, heading);
  }
});

Then('I should see a success popup', async ({ page, $testInfo }) => {
  await expectAlert(page, $testInfo, /success|assigned|unassigned|removed/i, 'success popup');
});

Then('I should see the error popup {string}', async ({ page, ctx, $testInfo }, raw) => {
  const message = ctx.resolve(raw);
  await expect(page.getByText(message)).toBeVisible({ timeout: 30000 });
  await attachPopupText(page, $testInfo, `Error text - ${message}`);
  await expectAlert(page, $testInfo, 'Error', `Error popup - ${message}`);
});

Then('I should see the validation message {string}', async ({ ctx }, message) => {
  await expect(ctx.dialog.getByText(message)).toBeVisible();
});

Then('I should not see the validation message {string}', async ({ ctx }, message) => {
  await expect(ctx.dialog.getByText(message)).toBeHidden();
});

// ---------- Grid ----------

Then('I should see the {string} button', async ({ page }, text) => {
  await expect(page.getByText(text, { exact: true })).toBeVisible();
});

Then('the grid should have the columns:', async ({ page }, table) => {
  for (const header of table.raw().flat()) {
    await expect(page.getByRole('columnheader', { name: header }).first()).toBeVisible();
  }
});

When('I search for {string}', async ({ page, ctx }, text) => {
  await searchGrid(page, ctx.resolve(text));
});

Then('the grid should have {int} row(s)', async ({ page }, count) => {
  await expect(page.locator('tbody tr')).toHaveCount(count);
});

Then('the first row should contain {string}', async ({ page, ctx }, text) => {
  await expect(firstRow(page)).toContainText(ctx.resolve(text), { timeout: 30000 });
});

Then('the first row should not contain {string}', async ({ page, ctx }, text) => {
  await expect(firstRow(page)).not.toContainText(ctx.resolve(text), { timeout: 30000 });
});

// Matched by text, not role: right after a success popup closes the page can still be flagged
// aria-hidden, which hides the cell from role queries although it is on screen.
// After a delete the grid also reloads all rows from the API, which can take over 15s on staging.
Then('the grid should show no matching records', async ({ page }) => {
  await expect(page.locator('tbody td', { hasText: 'No matching records found' })).toBeVisible({ timeout: 30000 });
});

// CSS attribute match, not getByRole: see "the grid should show no matching records".
Then('the grid status should contain {string}', async ({ page }, text) => {
  await expect(page.locator('[role="status"]').first()).toContainText(text, { timeout: 30000 });
});

Then('every visible row should contain {string}', async ({ page, ctx }, raw) => {
  const text = ctx.resolve(raw);
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toContainText(text);
  const count = Math.min(await rows.count(), 10);
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(new RegExp(text, 'i'));
  }
});

When('I show {int} entries per page', async ({ page }, size) => {
  await page.getByRole('combobox', { name: 'Show entries' }).selectOption(String(size));
});

Then('the grid should show at most {int} rows', async ({ page }, max) => {
  await expect(page.locator('[role="status"]').first()).toContainText(/Showing 1 to \d+ of/);
  expect(await page.locator('tbody tr').count()).toBeLessThanOrEqual(max);
});

When('I sort by {string}', async ({ page, ctx }, column) => {
  const header = page.getByRole('columnheader', { name: new RegExp(column) });
  await header.click();
  (ctx.sortStates ||= []).push(await header.getAttribute('aria-sort'));
});

Then('the sort order should be reversed', async ({ ctx }) => {
  const [first, second] = ctx.sortStates.slice(-2);
  expect(second).not.toBe(first);
});

When('I remember the first row', async ({ page, ctx }) => {
  ctx.rememberedRow = (await firstRow(page).textContent()).trim();
});

Then('the first row should be unchanged', async ({ page, ctx }) => {
  await expect(firstRow(page)).toHaveText(ctx.rememberedRow);
});

// ---------- Users: assign / unassign role ----------

When('I open the assign role dialog', async ({ page, ctx }) => {
  await firstRow(page).locator('.fa-link').click();
  await waitForIdle(page);
  ctx.dialog = page.getByRole('dialog', { name: /assignRole/ });
  await expect(ctx.dialog).toBeVisible();
});

When('I open the unassign role dialog', async ({ page, ctx }) => {
  await firstRow(page).locator('.fa-unlink').click();
  await waitForIdle(page);
  ctx.dialog = page.getByRole('dialog', { name: /unassignRole/ });
  await expect(ctx.dialog).toBeVisible();
});

// The assign dialog loads roles and applications in parallel. If the app is picked before the
// role list arrives, the list stays "No data available"; picking the app again rebuilds it.
When('I select the role {string}', async ({ page, ctx }, role) => {
  const name = ctx.resolve(role);
  const option = ctx.dialog.locator('li.multiselect-item-checkbox', { hasText: name });
  for (let attempt = 1; ; attempt++) {
    await ctx.dialog.locator('.dropdown-btn').click();
    if (await option.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false)) break;
    if (attempt === 3) throw new Error(`Role "${name}" is not offered for the chosen application`);
    await ctx.dialog.locator('.dropdown-btn').click();
    const app = (await ctx.dialog.locator('.ng-value-label').first().textContent()).trim();
    await ctx.dialog.locator('.ng-clear-wrapper').first().click();
    await ngSelect(page, ctx.dialog, app);
    await waitForIdle(page);
  }
  await option.click();
  // Close the dropdown so it does not cover the Submit button
  await ctx.dialog.locator('.dropdown-btn').click();
});

When('I open the role list', async ({ ctx }) => {
  await ctx.dialog.locator('.dropdown-btn').click();
});

Then('the role list should show {string}', async ({ ctx }, text) => {
  await expect(ctx.dialog.getByText(text)).toBeVisible();
});

When('I tick the role {string}', async ({ ctx }, role) => {
  await ctx.dialog.getByRole('listitem').filter({ hasText: ctx.resolve(role) }).getByRole('checkbox').check();
});

// ---------- Row action icons (edit / assign / unassign / disable / enable / delete) ----------

const ICONS = {
  edit: '.fa-edit',
  assign: '.fa-link',
  unassign: '.fa-unlink',
  disable: '.fa-times-circle',
  enable: '.fa-check-circle',
  delete: '.fa-times-circle',
};
const icon = name => {
  if (!ICONS[name]) throw new Error(`Unknown icon "${name}". Known: ${Object.keys(ICONS).join(', ')}`);
  return ICONS[name];
};

When('I click the {string} icon', async ({ page, ctx }, name) => {
  await firstRow(page).locator(icon(name)).click();
  await waitForIdle(page);
  ctx.dialog = page.getByRole('dialog').first();
  await expect(ctx.dialog).toBeVisible();
});

Then('the first row should have the {string} icon', async ({ page }, name) => {
  await expect(firstRow(page).locator(icon(name))).toBeVisible();
});

Then('the first row should not have the {string} icon', async ({ page }, name) => {
  await expect(firstRow(page).locator(icon(name))).toHaveCount(0);
});

Then('the first row should show status {string}', async ({ page }, status) => {
  // Status is the column just before Action
  await expect(firstRow(page).locator('td:nth-last-child(2)')).toHaveText(status, { timeout: 30000 });
});

When('I click on the first row', async ({ page }) => {
  await firstRow(page).locator('td').nth(1).click();
});

Then('no dialog should open', async ({ page }) => {
  await page.waitForTimeout(2000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

// ---------- Confirmation popups (Yes / No) ----------

Then('I should see the confirmation {string}', async ({ page, ctx, $testInfo }, text) => {
  const dialog = page.getByRole('dialog').filter({ hasText: ctx.resolve(text) });
  await expect(dialog).toBeVisible({ timeout: 30000 });
  await snap(page, $testInfo, `confirm ${text}`);
});

// "Yes" triggers a write (DELETE/PATCH). Staging sometimes takes over 30s to answer, so wait
// up to 90s for that call (and give the test the extra time) before checking the popup.
When('I answer {string}', async ({ page, $testInfo }, answer) => {
  let written = null;
  if (answer === 'Yes') {
    $testInfo.setTimeout($testInfo.timeout + 90000);
    written = page.waitForResponse(r => r.request().method() !== 'GET' && /\/api\/v1\//.test(r.url()), { timeout: 90000 })
      .catch(() => null);
  }
  await page.getByRole('dialog').getByRole('button', { name: answer, exact: true }).click();
  await written;
  await waitForIdle(page);
});

// Popup with a message but no title (e.g. delete blocked by a business rule).
Then('I should see the message {string}', async ({ page, ctx, $testInfo }, raw) => {
  const text = ctx.resolve(raw);
  await expect(page.getByRole('dialog').getByText(text)).toBeVisible({ timeout: 30000 });
  await attachPopupText(page, $testInfo, `Error text - ${text}`);
  await snap(page, $testInfo, `Error popup - ${text}`);
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await waitForIdle(page);
});

// ---------- Form field helpers (edit dialogs) ----------

When('I remember the value of {string}', async ({ ctx }, placeholder) => {
  ctx.remembered = await ctx.dialog.getByPlaceholder(placeholder).inputValue();
});

When('I append {string} to {string}', async ({ ctx }, suffix, placeholder) => {
  const field = ctx.dialog.getByPlaceholder(placeholder);
  await field.fill((await field.inputValue()) + suffix);
});

When('I clear {string}', async ({ ctx }, placeholder) => {
  await ctx.dialog.getByPlaceholder(placeholder).fill('');
});

When('I type {int} characters in {string}', async ({ ctx }, count, placeholder) => {
  const field = ctx.dialog.getByPlaceholder(placeholder);
  await field.fill('');
  await field.pressSequentially('A'.repeat(count));
});

Then('{string} should hold at most {int} characters', async ({ page, ctx, $testInfo }, placeholder, max) => {
  const value = await ctx.dialog.getByPlaceholder(placeholder).inputValue();
  expect(value.length).toBeLessThanOrEqual(max);
  expect(value.length).toBeGreaterThan(0);
  await snap(page, $testInfo, `Validation - ${placeholder} limited to ${max} characters ("${value}")`);
});

Then('the dialog should still be open', async ({ ctx }) => {
  await expect(ctx.dialog).toBeVisible();
});

// Types key by key (unlike "I enter", which pastes), so maxlength and digit-only filters apply.
When('I type {string} into {string}', async ({ ctx }, value, placeholder) => {
  const field = ctx.dialog.getByPlaceholder(placeholder);
  await field.fill('');
  await field.pressSequentially(ctx.resolve(value));
});

Then('{string} should only contain digits', async ({ page, ctx, $testInfo }, placeholder) => {
  const field = ctx.dialog.getByPlaceholder(placeholder);
  await expect(field).toHaveValue(/^\d*$/);
  await snap(page, $testInfo, `Validation - ${placeholder} keeps digits only ("${await field.inputValue()}")`);
});

// Angular marks a field that fails its validators with the ng-invalid class (red border / cross).
Then('{string} should be marked invalid', async ({ page, ctx, $testInfo }, placeholder) => {
  const field = ctx.dialog.getByPlaceholder(placeholder);
  await expect(field).toHaveClass(/ng-invalid/);
  await snap(page, $testInfo, `Invalid field - ${placeholder} ("${await field.inputValue()}")`);
});

Then('{string} should not be marked invalid', async ({ ctx }, placeholder) => {
  await expect(ctx.dialog.getByPlaceholder(placeholder)).not.toHaveClass(/ng-invalid/);
});

// ---------- Row-specific actions (used where a search can match more than one record) ----------

const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The row whose cell text is exactly the name, e.g. the lower-case duplicate but not the original.
When('I click the {string} icon in the row named exactly {string}', async ({ page, ctx }, name, raw) => {
  const cell = page.locator('td').filter({ hasText: new RegExp(`^\\s*${escapeRegex(ctx.resolve(raw))}\\s*$`) });
  const row = page.locator('tbody tr').filter({ has: cell });
  await expect(row).toHaveCount(1);
  await row.locator(icon(name)).click();
  await waitForIdle(page);
  ctx.dialog = page.getByRole('dialog').first();
  await expect(ctx.dialog).toBeVisible();
});

Then('a row should contain {string} and {string}', async ({ page, ctx }, a, b) => {
  const row = page.locator('tbody tr').filter({ hasText: ctx.resolve(a) }).filter({ hasText: ctx.resolve(b) });
  await expect(row).toHaveCount(1, { timeout: 30000 });
});

When('I click the {string} icon in the row containing {string} and {string}', async ({ page, ctx }, name, a, b) => {
  const row = page.locator('tbody tr').filter({ hasText: ctx.resolve(a) }).filter({ hasText: ctx.resolve(b) });
  await expect(row).toHaveCount(1);
  await row.locator(icon(name)).click();
  await waitForIdle(page);
  ctx.dialog = page.getByRole('dialog').first();
  await expect(ctx.dialog).toBeVisible();
});

// A failed "delete a feature that is not the last" run (e.g. staging DELETE 500) leaves its
// temporary feature on the page. Remove only such leftovers: rows on this run's page whose feature
// name has the automation prefix but is neither $FEATURE nor $FEATURE2.
When('I remove leftover temporary features from {string}', async ({ page, ctx, $testInfo }, raw) => {
  const pageName = ctx.resolve(raw);
  const keep = [TOKENS.$FEATURE, TOKENS.$FEATURE2];
  for (let i = 0; i < 5; i++) {
    await searchGrid(page, pageName);
    const rows = page.locator('tbody tr').filter({ hasText: pageName });
    const names = await rows.locator('td:first-child').allTextContents();
    const leftover = names.map(n => n.trim()).find(n => n.startsWith(`${PREFIX} Feature `) && !keep.includes(n));
    if (!leftover) return;
    await snap(page, $testInfo, `Leftover temporary feature - ${leftover}`);
    await rows.filter({ hasText: leftover }).locator(icon('delete')).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Yes', exact: true }).click();
    await expectAlert(page, $testInfo, /success/i, `Leftover removed - ${leftover}`);
  }
  throw new Error(`Could not remove leftover temporary features from ${pageName}`);
});

// A failed "different letter case" run can leave a copy of the record whose name differs only in
// case (staging once answered the DELETE with 200 without deleting). The grid search ignores case,
// so that copy would be the first row of the record's search. Delete only such copies.
When('I remove leftover letter-case copies of {string}', async ({ page, ctx, $testInfo }, raw) => {
  const name = ctx.resolve(raw);
  for (let i = 0; i < 5; i++) {
    await searchGrid(page, name);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30000 });
    const names = (await page.locator('tbody tr td:first-child').allTextContents()).map(n => n.trim());
    const copy = names.find(n => n !== name && n.toLowerCase() === name.toLowerCase());
    if (!copy) return;
    await snap(page, $testInfo, `Leftover letter-case copy - ${copy}`);
    const cell = page.locator('td').filter({ hasText: new RegExp(`^\\s*${escapeRegex(copy)}\\s*$`) });
    await page.locator('tbody tr').filter({ has: cell }).locator(icon('delete')).click();
    await waitForIdle(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Yes', exact: true }).click();
    await expectAlert(page, $testInfo, /success/i, `Leftover removed - ${copy}`);
  }
  throw new Error(`Could not remove leftover letter-case copies of ${name}`);
});

Then('the first row should contain {string} once', async ({ page, ctx }, raw) => {
  const text = ctx.resolve(raw);
  await expect(firstRow(page)).toContainText(text, { timeout: 30000 });
  const content = await firstRow(page).textContent();
  expect(content.split(text).length - 1).toBe(1);
});

// ---------- Users: multi-select with checkboxes ----------

const userRow = (page, ctx, user) => page.locator('tbody tr').filter({ hasText: ctx.resolve(user) });

When('I tick the checkbox for user {string}', async ({ page, ctx }, user) => {
  await userRow(page, ctx, user).locator('input[type="checkbox"]').check();
});

When('I untick the checkbox for user {string}', async ({ page, ctx }, user) => {
  await userRow(page, ctx, user).locator('input[type="checkbox"]').uncheck();
});

Then('the {string} button should be visible', async ({ page }, name) => {
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
});

Then('the {string} button should not be visible', async ({ page }, name) => {
  await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
});

Then('there should be no bulk unassign button', async ({ page }) => {
  await expect(page.getByRole('button', { name: /unassign|un-assign|remove role/i })).toHaveCount(0);
});

When('I click the {string} button', async ({ page, ctx }, name) => {
  await page.getByRole('button', { name, exact: true }).click();
  await waitForIdle(page);
  ctx.dialog = page.getByRole('dialog').first();
  await expect(ctx.dialog).toBeVisible();
});

Then('the row for user {string} should contain {string}', async ({ page, ctx }, user, text) => {
  await expect(userRow(page, ctx, user)).toContainText(ctx.resolve(text), { timeout: 30000 });
});

Then('the row for user {string} should not contain {string}', async ({ page, ctx }, user, text) => {
  await expect(userRow(page, ctx, user)).not.toContainText(ctx.resolve(text), { timeout: 30000 });
});
