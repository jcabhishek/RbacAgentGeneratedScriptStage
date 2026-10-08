// Seed test used by the Playwright planner/generator agents to reach a logged-in state.
// URL and credentials come from .env (loaded in playwright.config.ts).
import { test } from '@playwright/test';

test('seed', async ({ page }) => {
  await page.goto(process.env.RBAC_BASE_URL!);
  await page.getByPlaceholder('Enter Email ID').fill(process.env.RBAC_EMAIL!);
  await page.getByPlaceholder('Enter Password').fill(process.env.RBAC_PASSWORD!);
  await page.getByRole('button', { name: 'LOGIN' }).click();
});
