// spec: specs/rbac-dashboard.plan.md
// Flow step 3 of 8: Pages (uses the application created in step 2)
const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./auth');
const { runNames, tempName, openModule, searchGrid, snap, expectAlert, openForm, ngSelect } = require('./helpers');

const { APP, PAGE } = runNames();

test.describe('3. Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openModule(page, '/home/pages');
  });

  test('pages grid loads with expected columns', async ({ page }, testInfo) => {
    // 1. Verify the grid headers and Add button
    for (const header of ['Page Name', 'Description', 'Mapped Application', 'Status', 'Action']) {
      await expect(page.getByRole('columnheader', { name: header }).first()).toBeVisible();
    }
    await expect(page.getByText('Add Page')).toBeVisible();
    await snap(page, testInfo, 'pages grid');
  });

  test('add page mapped to application', async ({ page }, testInfo) => {
    // 1. Fill name, description and choose the application from step 2
    const dialog = await openForm(page, 'Add Page', /AddPage/, 'Enter page name');
    await dialog.getByPlaceholder('Enter page name').fill(PAGE);
    await dialog.getByPlaceholder('Enter page description').fill('Playwright automation page');
    await ngSelect(page, dialog, APP);
    await snap(page, testInfo, 'page form filled');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify success popup and the grid row mapped to the application
    await expectAlert(page, testInfo, 'Page created successfully', 'page created');
    await searchGrid(page, PAGE);
    const row = page.locator('tbody tr').first();
    await expect(row).toContainText(PAGE);
    await expect(row).toContainText(APP);
    await snap(page, testInfo, 'page in grid');
  });

  test('add page with empty fields shows mandatory alert', async ({ page }, testInfo) => {
    // 1. Submit the form empty
    const dialog = await openForm(page, 'Add Page', /AddPage/, 'Enter page name');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify the mandatory-fields alert
    await expectAlert(page, testInfo, 'All fields are mandatory!', 'empty page validation');
  });

  test('add page without application shows mandatory alert', async ({ page }, testInfo) => {
    // 1. Fill name and description but do not choose an application
    const dialog = await openForm(page, 'Add Page', /AddPage/, 'Enter page name');
    await dialog.getByPlaceholder('Enter page name').fill(tempName('Page'));
    await dialog.getByPlaceholder('Enter page description').fill('no application');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify the mandatory-fields alert
    await expectAlert(page, testInfo, 'All fields are mandatory!', 'page without application validation');
  });

  test('cancel add page does not create a record', async ({ page }, testInfo) => {
    // 1. Fill the form then click Cancel
    const name = tempName('Page');
    const dialog = await openForm(page, 'Add Page', /AddPage/, 'Enter page name');
    await dialog.getByPlaceholder('Enter page name').fill(name);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    // 2. Verify the page was not created
    await searchGrid(page, name);
    await expect(page.getByRole('gridcell', { name: 'No matching records found' })).toBeVisible();
    await snap(page, testInfo, 'cancelled page not in grid');
  });

  test('search pages with no match shows empty state', async ({ page }, testInfo) => {
    // 1. Search for text that matches nothing
    await searchGrid(page, 'zzz_no_such_page_999');

    // 2. Verify the empty state
    await expect(page.getByRole('gridcell', { name: 'No matching records found' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Showing 0 to 0 of 0 entries');
    await snap(page, testInfo, 'page search no match');
  });
});
