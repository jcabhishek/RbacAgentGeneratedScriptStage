// spec: specs/rbac-dashboard.plan.md
// Flow step 7 of 8: User Logs (audit trail of the changes made in steps 2-6)
const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./auth');
const { runNames, openModule, searchGrid, snap } = require('./helpers');

const { ROLE } = runNames();

test.describe('7. User Logs', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openModule(page, '/home/rbac-logs');
  });

  test('user logs grid loads with expected columns', async ({ page }, testInfo) => {
    // 1. Verify the title and grid headers
    await expect(page.getByText('RBAC User Transactions')).toBeVisible();
    for (const header of ['transaction Id', 'activity Start Date', 'activity End Date', 'Screen', 'user Activity', 'modified By']) {
      await expect(page.getByRole('columnheader', { name: header }).first()).toBeVisible();
    }
    await snap(page, testInfo, 'user logs grid');
  });

  test('user logs record the role assignment', async ({ page }, testInfo) => {
    // 1. Search the logs for the role assigned in step 6
    await searchGrid(page, ROLE);

    // 2. Verify an "assigned" entry for the role
    await expect(page.locator('tbody tr').filter({ hasText: /assigned/i }).first()).toContainText(ROLE);
    await snap(page, testInfo, 'assignment in user logs');
  });

  test('search user logs filters by activity', async ({ page }, testInfo) => {
    // 1. Search for role-creation activity
    await searchGrid(page, 'role is created');

    // 2. Verify every visible row matches
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toContainText('role is created');
    const count = Math.min(await rows.count(), 10);
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText(/role is created/i);
    }
    await snap(page, testInfo, 'user logs filtered');
  });

  test('search user logs with no match shows empty state', async ({ page }, testInfo) => {
    // 1. Search for text that matches nothing
    await searchGrid(page, 'zzz_no_such_log_999');

    // 2. Verify the empty state
    await expect(page.getByRole('gridcell', { name: 'No matching records found' })).toBeVisible();
    await snap(page, testInfo, 'user logs no match');
  });
});
