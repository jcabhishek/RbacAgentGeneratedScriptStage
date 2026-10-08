// spec: specs/rbac-dashboard.plan.md
// Flow step 2 of 8: Application (add / negative cases)
const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./auth');
const { runNames, tempName, openModule, searchGrid, snap, expectAlert, openForm } = require('./helpers');

const { APP } = runNames();

test.describe('2. Application', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openModule(page, '/home/applications');
  });

  test('applications grid loads with expected columns', async ({ page }, testInfo) => {
    // 1. Verify the grid headers and Add button
    for (const header of ['App Name', 'Description', 'Mapped Pages', 'Mapped Features', 'Status', 'Action']) {
      await expect(page.getByRole('columnheader', { name: header }).first()).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Add Application' })).toBeVisible();
    await snap(page, testInfo, 'applications grid');
  });

  test('add application', async ({ page }, testInfo) => {
    // 1. Fill name and description, submit
    const dialog = await openForm(page, 'Add Application', /AddApplication/, 'Enter app name');
    await dialog.getByPlaceholder('Enter app name').fill(APP);
    await dialog.getByPlaceholder('Enter app description').fill('Playwright automation app');
    await snap(page, testInfo, 'application form filled');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify success popup and the new row in the grid
    await expectAlert(page, testInfo, 'Application created successfully', 'application created');
    await searchGrid(page, APP);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr').first()).toContainText(APP);
    await expect(page.locator('tbody tr').first()).toContainText('Playwright automation app');
    await snap(page, testInfo, 'application in grid');
  });

  test('add duplicate application shows error', async ({ page }, testInfo) => {
    // 1. Try to add an application with the name just created
    const dialog = await openForm(page, 'Add Application', /AddApplication/, 'Enter app name');
    await dialog.getByPlaceholder('Enter app name').fill(APP);
    await dialog.getByPlaceholder('Enter app description').fill('duplicate');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify the server rejects the duplicate name
    await expect(page.getByText(`Specified applicationName already exists: ${APP}`)).toBeVisible({ timeout: 30000 });
    await expectAlert(page, testInfo, 'Error', 'duplicate application error');
  });

  test('add application with empty fields shows required errors', async ({ page }, testInfo) => {
    // 1. Submit the form empty
    const dialog = await openForm(page, 'Add Application', /AddApplication/, 'Enter app name');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify both required-field messages
    await expect(dialog.getByText('app name is required')).toBeVisible();
    await expect(dialog.getByText('Description is required')).toBeVisible();
    await snap(page, testInfo, 'empty application validation');
  });

  test('add application without description shows required error', async ({ page }, testInfo) => {
    // 1. Fill only the app name and submit
    const dialog = await openForm(page, 'Add Application', /AddApplication/, 'Enter app name');
    await dialog.getByPlaceholder('Enter app name').fill(tempName('App'));
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify only the description error is shown
    await expect(dialog.getByText('Description is required')).toBeVisible();
    await expect(dialog.getByText('app name is required')).toBeHidden();
    await snap(page, testInfo, 'missing description validation');
  });

  test('add application without name shows required error', async ({ page }, testInfo) => {
    // 1. Fill only the description and submit
    const dialog = await openForm(page, 'Add Application', /AddApplication/, 'Enter app name');
    await dialog.getByPlaceholder('Enter app description').fill('description only');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify only the name error is shown
    await expect(dialog.getByText('app name is required')).toBeVisible();
    await expect(dialog.getByText('Description is required')).toBeHidden();
    await snap(page, testInfo, 'missing name validation');
  });

  test('cancel add application does not create a record', async ({ page }, testInfo) => {
    // 1. Fill the form then click Cancel
    const name = tempName('App');
    const dialog = await openForm(page, 'Add Application', /AddApplication/, 'Enter app name');
    await dialog.getByPlaceholder('Enter app name').fill(name);
    await dialog.getByPlaceholder('Enter app description').fill('should not be saved');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    // 2. Verify the application was not created
    await searchGrid(page, name);
    await expect(page.getByRole('gridcell', { name: 'No matching records found' })).toBeVisible();
    await snap(page, testInfo, 'cancelled application not in grid');
  });

  test('search applications with no match shows empty state', async ({ page }, testInfo) => {
    // 1. Search for text that matches nothing
    await searchGrid(page, 'zzz_no_such_app_999');

    // 2. Verify the empty state
    await expect(page.getByRole('gridcell', { name: 'No matching records found' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Showing 0 to 0 of 0 entries');
    await snap(page, testInfo, 'application search no match');
  });

  test('search applications is case-insensitive', async ({ page }, testInfo) => {
    // 1. Search with lower-case text for upper-case records
    await searchGrid(page, 'indofast test automation app');

    // 2. Verify matching rows are returned
    await expect(page.locator('tbody tr').first()).toContainText(/Indofast Test Automation App/);
    await snap(page, testInfo, 'application search case-insensitive');
  });

  test('page size selector limits rows to 50', async ({ page }, testInfo) => {
    // 1. Choose 50 entries per page
    await page.getByRole('combobox', { name: 'Show entries' }).selectOption('50');

    // 2. Verify at most 50 rows and the status text
    await expect(page.getByRole('status')).toContainText(/Showing 1 to (50|[1-4]?\d) of/);
    expect(await page.locator('tbody tr').count()).toBeLessThanOrEqual(50);
    await snap(page, testInfo, 'application page size 50');
  });

  test('sorting by app name toggles sort order', async ({ page }, testInfo) => {
    // 1. Click the App Name header twice and verify aria-sort changes
    const header = page.getByRole('columnheader', { name: /App Name/ });
    await header.click();
    const first = await header.getAttribute('aria-sort');
    await header.click();
    await expect(header).not.toHaveAttribute('aria-sort', first ?? '');
    await snap(page, testInfo, 'application sorted');
  });
});
