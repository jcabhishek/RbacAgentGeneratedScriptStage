// spec: specs/rbac-dashboard.plan.md
// Flow step 8 of 8: Logout
const { test, expect } = require('@playwright/test');
const { BASE_URL, loginAsAdmin } = require('./auth');
const { snap } = require('./helpers');

test.describe('8. Logout', () => {
  test('logout returns to login page', async ({ page }, testInfo) => {
    // 1. Log in with valid credentials
    await loginAsAdmin(page);

    // 2. Open the profile menu next to "RBAC Admin" and click "Logout"
    await page.locator('app-nav-right').getByRole('link').filter({ hasText: /^$/ }).click();
    await page.getByTitle('Logout').click();

    // 3. Verify the login page is shown
    await expect(page).toHaveURL(BASE_URL);
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'LOGIN' })).toBeVisible();
    await snap(page, testInfo, 'logged out');
  });
});
