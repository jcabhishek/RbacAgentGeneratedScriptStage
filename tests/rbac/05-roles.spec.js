// spec: specs/rbac-dashboard.plan.md
// Flow step 5 of 8: Roles (uses the application, page and feature from steps 2-4)
const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./auth');
const { runNames, tempName, openModule, searchGrid, snap, expectAlert, openForm, ngSelect } = require('./helpers');

const { APP, PAGE, FEATURE, ROLE, EXISTING_APP } = runNames();

test.describe('5. Roles', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openModule(page, '/home/rbac-roles');
  });

  test('roles grid loads with expected columns', async ({ page }, testInfo) => {
    // 1. Verify the grid headers and Add button
    for (const header of ['Role Name', 'Role Description', 'Application', 'Pages', 'Features', 'Status', 'Action']) {
      await expect(page.getByRole('columnheader', { name: header }).first()).toBeVisible();
    }
    await expect(page.getByText('Add Role')).toBeVisible();
    await snap(page, testInfo, 'roles grid');
  });

  test('add role with page and feature access', async ({ page }, testInfo) => {
    // 1. Fill name, description, choose the app, enable the page and its feature with write access
    const dialog = await openForm(page, 'Add Role', /AddRole/, 'Enter user role name');
    await dialog.getByPlaceholder('Enter user role name').fill(ROLE);
    await dialog.getByPlaceholder('Enter role description').fill('Playwright automation role');
    await ngSelect(page, dialog, APP);
    await dialog.locator('li').filter({ has: page.locator(`input[id="${PAGE}"]`) }).locator('span.slider').click();
    const featureItem = dialog.getByRole('listitem').filter({ hasText: FEATURE });
    await featureItem.getByRole('checkbox').first().check();
    await featureItem.getByRole('checkbox').nth(1).check();
    await snap(page, testInfo, 'role form filled');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify success popup and the grid row with app, page and feature
    await expectAlert(page, testInfo, /success/i, 'role created');
    await searchGrid(page, ROLE);
    const row = page.locator('tbody tr').first();
    await expect(row).toContainText(ROLE);
    await expect(row).toContainText(APP);
    await expect(row).toContainText(PAGE);
    await expect(row).toContainText(FEATURE);
    await snap(page, testInfo, 'role in grid');
  });

  test('add role with empty fields asks for application', async ({ page }, testInfo) => {
    // 1. Submit the form empty
    const dialog = await openForm(page, 'Add Role', /AddRole/, 'Enter user role name');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify the select-application alert
    await expectAlert(page, testInfo, 'Select application to create role', 'empty role validation');
  });

  test('add role without page asks for at least one page', async ({ page }, testInfo) => {
    // 1. Fill name, description and app, but enable no page
    const dialog = await openForm(page, 'Add Role', /AddRole/, 'Enter user role name');
    await dialog.getByPlaceholder('Enter user role name').fill(tempName('Role'));
    await dialog.getByPlaceholder('Enter role description').fill('no page');
    await ngSelect(page, dialog, EXISTING_APP);
    await dialog.getByRole('button', { name: 'Submit' }).click();

    // 2. Verify the select-page alert
    await expectAlert(page, testInfo, 'Select atleast one page for the application', 'role without page validation');
  });

  test('cancel add role does not create a record', async ({ page }, testInfo) => {
    // 1. Fill the form then click Cancel
    const name = tempName('Role');
    const dialog = await openForm(page, 'Add Role', /AddRole/, 'Enter user role name');
    await dialog.getByPlaceholder('Enter user role name').fill(name);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    // 2. Verify the role was not created
    await searchGrid(page, name);
    await expect(page.getByRole('gridcell', { name: 'No matching records found' })).toBeVisible();
    await snap(page, testInfo, 'cancelled role not in grid');
  });

  test('search roles with no match shows empty state', async ({ page }, testInfo) => {
    // 1. Search for text that matches nothing
    await searchGrid(page, 'zzz_no_such_role_999');

    // 2. Verify the empty state
    await expect(page.getByRole('gridcell', { name: 'No matching records found' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Showing 0 to 0 of 0 entries');
    await snap(page, testInfo, 'role search no match');
  });
});
