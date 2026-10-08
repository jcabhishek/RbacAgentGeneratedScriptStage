// spec: specs/rbac-dashboard.plan.md
// Flow step 6 of 8: Users (search, assign / unassign the role created in step 5)
const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./auth');
const {
  runNames, openModule, searchGrid, snap, expectAlert, ngSelect, waitForIdle, unassignAutomationRoles,
} = require('./helpers');

const { APP, ROLE, USER_ID, EXISTING_APP, EMPTY_APP } = runNames();

test.describe('6. Users', () => {
  // Keep the shared test user clean: remove automation roles left by earlier or failed runs.
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(600000);
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await unassignAutomationRoles(page, USER_ID);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openModule(page, '/home/rbac-users');
  });

  const findUser = async page => {
    await searchGrid(page, USER_ID);
    const row = page.locator('tbody tr').first();
    await expect(row).toContainText(USER_ID);
    return row;
  };

  test('users search filters the grid', async ({ page }, testInfo) => {
    // 1. Verify the grid headers
    const grid = page.getByRole('grid');
    for (const header of ['User Id', 'User Name', 'Email Id', 'Role', 'Status']) {
      await expect(grid.getByRole('columnheader', { name: header, exact: false }).first()).toBeVisible();
    }

    // 2. Search for a known user and verify exactly one row
    await searchGrid(page, 'SUNMP00000791');
    await expect(grid.locator('tbody tr')).toHaveCount(1);
    await expect(grid.locator('tbody tr').first()).toContainText('SUNMP00000791');
    await snap(page, testInfo, 'user search match');
  });

  test('users search with no match shows empty state', async ({ page }, testInfo) => {
    // 1. Search for text that matches nothing
    await searchGrid(page, 'zzz_no_such_user_999');

    // 2. Verify the empty state
    await expect(page.getByRole('gridcell', { name: 'No matching records found' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Showing 0 to 0 of 0 entries');
    await snap(page, testInfo, 'user search no match');
  });

  test('assign role with empty fields shows mandatory alert', async ({ page }, testInfo) => {
    // 1. Open the assign-role dialog and submit it empty
    const row = await findUser(page);
    await row.locator('.fa-link').click();
    await waitForIdle(page);
    const dialog = page.getByRole('dialog', { name: /assignRole/ });
    await expect(dialog).toBeVisible();
    await snap(page, testInfo, 'assign role dialog');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify the mandatory-fields alert
    await expectAlert(page, testInfo, 'All fields are mandatory', 'empty assign validation');
  });

  test('assign role with application but no role shows mandatory alert', async ({ page }, testInfo) => {
    // 1. Choose an application but no role, then submit
    const row = await findUser(page);
    await row.locator('.fa-link').click();
    await waitForIdle(page);
    const dialog = page.getByRole('dialog', { name: /assignRole/ });
    await ngSelect(page, dialog, EXISTING_APP);
    await waitForIdle(page);
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify the mandatory-fields alert
    await expectAlert(page, testInfo, 'All fields are mandatory', 'assign without role validation');
  });

  test('role list is empty for an application with no roles', async ({ page }, testInfo) => {
    // 1. Choose an application that has no roles and open the role dropdown
    const row = await findUser(page);
    await row.locator('.fa-link').click();
    await waitForIdle(page);
    const dialog = page.getByRole('dialog', { name: /assignRole/ });
    await ngSelect(page, dialog, EMPTY_APP);
    await waitForIdle(page);
    await dialog.locator('.dropdown-btn').click();

    // 2. Verify "No data available"
    await expect(dialog.getByText('No data available')).toBeVisible();
    await snap(page, testInfo, 'no roles for application');
  });

  test('cancel assign role leaves user unchanged', async ({ page }, testInfo) => {
    // 1. Open the assign dialog, choose an app, then Cancel
    const row = await findUser(page);
    const before = (await row.textContent()).trim();
    await row.locator('.fa-link').click();
    await waitForIdle(page);
    const dialog = page.getByRole('dialog', { name: /assignRole/ });
    await ngSelect(page, dialog, EXISTING_APP);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    // 2. Verify the user row is unchanged
    await searchGrid(page, USER_ID);
    await expect(page.locator('tbody tr').first()).toHaveText(before);
    await snap(page, testInfo, 'user unchanged after cancel');
  });

  test('assign role to user', async ({ page }, testInfo) => {
    // 1. Find the test user (without the new role yet)
    const row = await findUser(page);
    await expect(row).not.toContainText(ROLE);

    // 2. Click the assign-role (link) icon, choose app and the role from step 5
    await row.locator('.fa-link').click();
    await waitForIdle(page);
    const dialog = page.getByRole('dialog', { name: /assignRole/ });
    await expect(dialog).toBeVisible();
    await ngSelect(page, dialog, APP);
    await waitForIdle(page);
    await dialog.locator('.dropdown-btn').click();
    await dialog.locator('li.multiselect-item-checkbox', { hasText: ROLE }).click();
    // Close the dropdown so it does not cover the Submit button
    await dialog.locator('.dropdown-btn').click();
    await snap(page, testInfo, 'assign role form filled');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 3. Verify success popup and the role shown on the user row
    await expectAlert(page, testInfo, /success|assigned/i, 'role assigned');
    await searchGrid(page, USER_ID);
    await expect(page.locator('tbody tr').first()).toContainText(ROLE, { timeout: 30000 });
    await snap(page, testInfo, 'user row with role');
  });

  test('unassign role from user', async ({ page }, testInfo) => {
    // 1. Find the test user that now has the role
    const row = await findUser(page);
    await expect(row).toContainText(ROLE);

    // 2. Click the unassign-role (unlink) icon, tick the role and submit
    await row.locator('.fa-unlink').click();
    await waitForIdle(page);
    const dialog = page.getByRole('dialog', { name: /unassignRole/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('listitem').filter({ hasText: ROLE }).getByRole('checkbox').check();
    await snap(page, testInfo, 'unassign role form filled');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 3. Verify success popup and that the role is gone from the user row
    await expectAlert(page, testInfo, /success|unassigned|removed/i, 'role unassigned');
    await searchGrid(page, USER_ID);
    await expect(page.locator('tbody tr').first()).not.toContainText(ROLE, { timeout: 30000 });
    await snap(page, testInfo, 'user row without role');
  });
});
