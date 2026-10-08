// spec: specs/rbac-dashboard.plan.md
// Flow step 1 of 8: Login
const { test, expect } = require('@playwright/test');
const { BASE_URL, EMAIL, login, loginAsAdmin } = require('./auth');
const { snap } = require('./helpers');

test.describe('1. Login', () => {
  test('login with valid credentials lands on dashboard', async ({ page }, testInfo) => {
    // 1. Log in with valid credentials
    await loginAsAdmin(page);

    // 2. Verify the dashboard is shown
    await expect(page.getByText('RBAC Admin').first()).toBeVisible();
    await expect(page.getByRole('img', { name: 'Welcome' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
    await snap(page, testInfo, 'dashboard');
  });

  test('login with invalid password shows error', async ({ page }, testInfo) => {
    // 1. Submit a wrong password
    await login(page, EMAIL, 'WrongPass@000');

    // 2. Verify the error message and that the user stays on the login page
    await expect(page.getByText('Invalid password. please enter correct password.')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(BASE_URL);
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await snap(page, testInfo, 'invalid password error');
  });

  test('login with empty fields stays on login page', async ({ page }, testInfo) => {
    // 1. Click LOGIN without entering anything
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'LOGIN' }).click();

    // 2. Verify the user stays on the login page
    await expect(page).toHaveURL(BASE_URL);
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByPlaceholder('Enter Email ID')).toBeVisible();
    await expect(page.getByPlaceholder('Enter Password')).toBeVisible();
    await snap(page, testInfo, 'empty login');
  });
});
