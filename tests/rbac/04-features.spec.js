// spec: specs/rbac-dashboard.plan.md
// Flow step 4 of 8: Features (uses the page created in step 3)
const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./auth');
const { runNames, tempName, openModule, searchGrid, snap, expectAlert, openForm, ngSelect } = require('./helpers');

const { PAGE, FEATURE } = runNames();

test.describe('4. Features', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openModule(page, '/home/features');
  });

  test('features grid loads with expected columns', async ({ page }, testInfo) => {
    // 1. Verify the grid headers and Add button
    for (const header of ['Feature Name', 'Description', 'Mapped Pages', 'Status', 'Action']) {
      await expect(page.getByRole('columnheader', { name: header }).first()).toBeVisible();
    }
    await expect(page.getByText('Add Feature')).toBeVisible();
    await snap(page, testInfo, 'features grid');
  });

  test('add feature mapped to page', async ({ page }, testInfo) => {
    // 1. Fill name, description and choose the page from step 3
    const dialog = await openForm(page, 'Add Feature', /AddFeature/, 'Enter feature name');
    await dialog.getByPlaceholder('Enter feature name').fill(FEATURE);
    await dialog.getByPlaceholder('Enter feature description').fill('Playwright automation feature');
    await ngSelect(page, dialog, PAGE);
    await snap(page, testInfo, 'feature form filled');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify success popup and the grid row mapped to the page
    await expectAlert(page, testInfo, 'Feature added successfully', 'feature created');
    await searchGrid(page, FEATURE);
    const row = page.locator('tbody tr').first();
    await expect(row).toContainText(FEATURE);
    await expect(row).toContainText(PAGE);
    await snap(page, testInfo, 'feature in grid');
  });

  test('add feature with empty fields shows mandatory alert', async ({ page }, testInfo) => {
    // 1. Submit the form empty
    const dialog = await openForm(page, 'Add Feature', /AddFeature/, 'Enter feature name');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify the mandatory-fields alert
    await expectAlert(page, testInfo, 'All fields are mandatory!', 'empty feature validation');
  });

  test('add feature without page shows mandatory alert', async ({ page }, testInfo) => {
    // 1. Fill name and description but do not choose a page
    const dialog = await openForm(page, 'Add Feature', /AddFeature/, 'Enter feature name');
    await dialog.getByPlaceholder('Enter feature name').fill(tempName('Feature'));
    await dialog.getByPlaceholder('Enter feature description').fill('no page');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify the mandatory-fields alert
    await expectAlert(page, testInfo, 'All fields are mandatory!', 'feature without page validation');
  });

  test('cancel add feature does not create a record', async ({ page }, testInfo) => {
    // 1. Fill the form then click Cancel
    const name = tempName('Feature');
    const dialog = await openForm(page, 'Add Feature', /AddFeature/, 'Enter feature name');
    await dialog.getByPlaceholder('Enter feature name').fill(name);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    // 2. Verify the feature was not created
    await searchGrid(page, name);
    await expect(page.getByRole('gridcell', { name: 'No matching records found' })).toBeVisible();
    await snap(page, testInfo, 'cancelled feature not in grid');
  });

  test('search features with no match shows empty state', async ({ page }, testInfo) => {
    // 1. Search for text that matches nothing
    await searchGrid(page, 'zzz_no_such_feature_999');

    // 2. Verify the empty state
    await expect(page.getByRole('gridcell', { name: 'No matching records found' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Showing 0 to 0 of 0 entries');
    await snap(page, testInfo, 'feature search no match');
  });
});
