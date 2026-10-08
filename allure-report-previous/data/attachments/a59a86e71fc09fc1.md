# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ..\.features-gen\features\06-users.feature.spec.js >> 6. Users >> Unassign role from each of the selected users
- Location: .features-gen\features\06-users.feature.spec.js:219:7

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.check: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: /unassignRole/ }).getByRole('listitem').filter({ hasText: 'PW_AUTO_ROLE_MUZACL08B' }).getByRole('checkbox')

```

# Test source

```ts
  170 | Then('the grid should have the columns:', async ({ page }, table) => {
  171 |   for (const header of table.raw().flat()) {
  172 |     await expect(page.getByRole('columnheader', { name: header }).first()).toBeVisible();
  173 |   }
  174 | });
  175 | 
  176 | When('I search for {string}', async ({ page, ctx }, text) => {
  177 |   await searchGrid(page, ctx.resolve(text));
  178 | });
  179 | 
  180 | Then('the grid should have {int} row(s)', async ({ page }, count) => {
  181 |   await expect(page.locator('tbody tr')).toHaveCount(count);
  182 | });
  183 | 
  184 | Then('the first row should contain {string}', async ({ page, ctx }, text) => {
  185 |   await expect(firstRow(page)).toContainText(ctx.resolve(text), { timeout: 30000 });
  186 | });
  187 | 
  188 | Then('the first row should not contain {string}', async ({ page, ctx }, text) => {
  189 |   await expect(firstRow(page)).not.toContainText(ctx.resolve(text), { timeout: 30000 });
  190 | });
  191 | 
  192 | Then('the grid should show no matching records', async ({ page }) => {
  193 |   await expect(page.getByRole('gridcell', { name: 'No matching records found' })).toBeVisible();
  194 | });
  195 | 
  196 | Then('the grid status should contain {string}', async ({ page }, text) => {
  197 |   await expect(page.getByRole('status')).toContainText(text);
  198 | });
  199 | 
  200 | Then('every visible row should contain {string}', async ({ page, ctx }, raw) => {
  201 |   const text = ctx.resolve(raw);
  202 |   const rows = page.locator('tbody tr');
  203 |   await expect(rows.first()).toContainText(text);
  204 |   const count = Math.min(await rows.count(), 10);
  205 |   for (let i = 0; i < count; i++) {
  206 |     await expect(rows.nth(i)).toContainText(new RegExp(text, 'i'));
  207 |   }
  208 | });
  209 | 
  210 | When('I show {int} entries per page', async ({ page }, size) => {
  211 |   await page.getByRole('combobox', { name: 'Show entries' }).selectOption(String(size));
  212 | });
  213 | 
  214 | Then('the grid should show at most {int} rows', async ({ page }, max) => {
  215 |   await expect(page.getByRole('status')).toContainText(/Showing 1 to \d+ of/);
  216 |   expect(await page.locator('tbody tr').count()).toBeLessThanOrEqual(max);
  217 | });
  218 | 
  219 | When('I sort by {string}', async ({ page, ctx }, column) => {
  220 |   const header = page.getByRole('columnheader', { name: new RegExp(column) });
  221 |   await header.click();
  222 |   (ctx.sortStates ||= []).push(await header.getAttribute('aria-sort'));
  223 | });
  224 | 
  225 | Then('the sort order should be reversed', async ({ ctx }) => {
  226 |   const [first, second] = ctx.sortStates.slice(-2);
  227 |   expect(second).not.toBe(first);
  228 | });
  229 | 
  230 | When('I remember the first row', async ({ page, ctx }) => {
  231 |   ctx.rememberedRow = (await firstRow(page).textContent()).trim();
  232 | });
  233 | 
  234 | Then('the first row should be unchanged', async ({ page, ctx }) => {
  235 |   await expect(firstRow(page)).toHaveText(ctx.rememberedRow);
  236 | });
  237 | 
  238 | // ---------- Users: assign / unassign role ----------
  239 | 
  240 | When('I open the assign role dialog', async ({ page, ctx }) => {
  241 |   await firstRow(page).locator('.fa-link').click();
  242 |   await waitForIdle(page);
  243 |   ctx.dialog = page.getByRole('dialog', { name: /assignRole/ });
  244 |   await expect(ctx.dialog).toBeVisible();
  245 | });
  246 | 
  247 | When('I open the unassign role dialog', async ({ page, ctx }) => {
  248 |   await firstRow(page).locator('.fa-unlink').click();
  249 |   await waitForIdle(page);
  250 |   ctx.dialog = page.getByRole('dialog', { name: /unassignRole/ });
  251 |   await expect(ctx.dialog).toBeVisible();
  252 | });
  253 | 
  254 | // The assign dialog loads roles and applications in parallel. If the app is picked before the
  255 | // role list arrives, the list stays "No data available"; picking the app again rebuilds it.
  256 | When('I select the role {string}', async ({ page, ctx }, role) => {
  257 |   const name = ctx.resolve(role);
  258 |   const option = ctx.dialog.locator('li.multiselect-item-checkbox', { hasText: name });
  259 |   for (let attempt = 1; ; attempt++) {
  260 |     await ctx.dialog.locator('.dropdown-btn').click();
  261 |     if (await option.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false)) break;
  262 |     if (attempt === 3) throw new Error(`Role "${name}" is not offered for the chosen application`);
  263 |     await ctx.dialog.locator('.dropdown-btn').click();
  264 |     const app = (await ctx.dialog.locator('.ng-value-label').first().textContent()).trim();
  265 |     await ctx.dialog.locator('.ng-clear-wrapper').first().click();
  266 |     await ngSelect(page, ctx.dialog, app);
  267 |     await waitForIdle(page);
  268 |   }
  269 |   await option.click();
> 270 |   // Close the dropdown so it does not cover the Submit button
      |                                                                                                       ^ Error: locator.check: Test timeout of 120000ms exceeded.
  271 |   await ctx.dialog.locator('.dropdown-btn').click();
  272 | });
  273 | 
  274 | When('I open the role list', async ({ ctx }) => {
  275 |   await ctx.dialog.locator('.dropdown-btn').click();
  276 | });
  277 | 
  278 | Then('the role list should show {string}', async ({ ctx }, text) => {
  279 |   await expect(ctx.dialog.getByText(text)).toBeVisible();
  280 | });
  281 | 
  282 | When('I tick the role {string}', async ({ ctx }, role) => {
  283 |   await ctx.dialog.getByRole('listitem').filter({ hasText: ctx.resolve(role) }).getByRole('checkbox').check();
  284 | });
  285 | 
  286 | // ---------- Row action icons (edit / assign / unassign / disable / enable / delete) ----------
  287 | 
  288 | const ICONS = {
  289 |   edit: '.fa-edit',
  290 |   assign: '.fa-link',
  291 |   unassign: '.fa-unlink',
  292 |   disable: '.fa-times-circle',
  293 |   enable: '.fa-check-circle',
  294 |   delete: '.fa-times-circle',
  295 | };
  296 | const icon = name => {
  297 |   if (!ICONS[name]) throw new Error(`Unknown icon "${name}". Known: ${Object.keys(ICONS).join(', ')}`);
  298 |   return ICONS[name];
  299 | };
  300 | 
  301 | When('I click the {string} icon', async ({ page, ctx }, name) => {
  302 |   await firstRow(page).locator(icon(name)).click();
  303 |   await waitForIdle(page);
  304 |   ctx.dialog = page.getByRole('dialog').first();
  305 |   await expect(ctx.dialog).toBeVisible();
  306 | });
  307 | 
  308 | Then('the first row should have the {string} icon', async ({ page }, name) => {
  309 |   await expect(firstRow(page).locator(icon(name))).toBeVisible();
  310 | });
  311 | 
  312 | Then('the first row should not have the {string} icon', async ({ page }, name) => {
  313 |   await expect(firstRow(page).locator(icon(name))).toHaveCount(0);
  314 | });
  315 | 
  316 | Then('the first row should show status {string}', async ({ page }, status) => {
  317 |   // Status is the column just before Action
  318 |   await expect(firstRow(page).locator('td:nth-last-child(2)')).toHaveText(status, { timeout: 30000 });
  319 | });
  320 | 
  321 | When('I click on the first row', async ({ page }) => {
  322 |   await firstRow(page).locator('td').nth(1).click();
  323 | });
  324 | 
  325 | Then('no dialog should open', async ({ page }) => {
  326 |   await page.waitForTimeout(2000);
  327 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  328 | });
  329 | 
  330 | // ---------- Confirmation popups (Yes / No) ----------
  331 | 
  332 | Then('I should see the confirmation {string}', async ({ page, ctx, $testInfo }, text) => {
  333 |   const dialog = page.getByRole('dialog').filter({ hasText: ctx.resolve(text) });
  334 |   await expect(dialog).toBeVisible({ timeout: 30000 });
  335 |   await snap(page, $testInfo, `confirm ${text}`);
  336 | });
  337 | 
  338 | // "Yes" triggers a write (DELETE/PATCH). Staging sometimes takes over 30s to answer, so wait
  339 | // up to 90s for that call (and give the test the extra time) before checking the popup.
  340 | When('I answer {string}', async ({ page, $testInfo }, answer) => {
  341 |   let written = null;
  342 |   if (answer === 'Yes') {
  343 |     $testInfo.setTimeout($testInfo.timeout + 90000);
  344 |     written = page.waitForResponse(r => r.request().method() !== 'GET' && /\/api\/v1\//.test(r.url()), { timeout: 90000 })
  345 |       .catch(() => null);
  346 |   }
  347 |   await page.getByRole('dialog').getByRole('button', { name: answer, exact: true }).click();
  348 |   await written;
  349 |   await waitForIdle(page);
  350 | });
  351 | 
  352 | // Popup with a message but no title (e.g. delete blocked by a business rule).
  353 | Then('I should see the message {string}', async ({ page, ctx, $testInfo }, raw) => {
  354 |   const text = ctx.resolve(raw);
  355 |   await expect(page.getByRole('dialog').getByText(text)).toBeVisible({ timeout: 30000 });
  356 |   await snap(page, $testInfo, 'message');
  357 |   await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  358 |   await waitForIdle(page);
  359 | });
  360 | 
  361 | // ---------- Form field helpers (edit dialogs) ----------
  362 | 
  363 | When('I remember the value of {string}', async ({ ctx }, placeholder) => {
  364 |   ctx.remembered = await ctx.dialog.getByPlaceholder(placeholder).inputValue();
  365 | });
  366 | 
  367 | When('I append {string} to {string}', async ({ ctx }, suffix, placeholder) => {
  368 |   const field = ctx.dialog.getByPlaceholder(placeholder);
  369 |   await field.fill((await field.inputValue()) + suffix);
  370 | });
```