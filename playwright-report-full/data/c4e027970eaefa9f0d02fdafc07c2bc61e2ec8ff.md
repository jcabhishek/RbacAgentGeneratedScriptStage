# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ..\.features-gen\features\04-features.feature.spec.js >> 4. Features >> Same feature name on a different page is accepted
- Location: .features-gen\features\04-features.feature.spec.js:101:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('tbody tr')
Expected: 2
Received: 3
Timeout:  15000ms

Call log:
  - Expect "toHaveCount" locator('tbody tr') with timeout 15000ms
  - waiting for locator('tbody tr')
    33 × locator resolved to 3 elements
       - unexpected value "3"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - list [ref=e11]:
    - generic [ref=e12]:
      - list [ref=e13]:
        - listitem [ref=e14]
      - listitem [ref=e16]:
        - link [ref=e17] [cursor=pointer]:
          - /url: /home/rbac-users
          - generic [ref=e18]: 
      - listitem [ref=e21]:
        - link [ref=e22] [cursor=pointer]:
          - /url: /home/rbac-roles
      - listitem [ref=e26]:
        - link [ref=e27] [cursor=pointer]:
          - /url: /home/applications
      - listitem [ref=e31]:
        - link [ref=e32] [cursor=pointer]:
          - /url: /home/pages
      - listitem [ref=e36]:
        - link [ref=e37] [cursor=pointer]:
          - /url: /home/features
      - listitem [ref=e41]:
        - link [ref=e42] [cursor=pointer]:
          - /url: /home/rbac-logs
  - generic [ref=e45]:
    - generic [ref=e46]:
      - link [ref=e47] [cursor=pointer]:
        - /url: "javascript:"
      - link [ref=e49] [cursor=pointer]:
        - /url: /home
      - text: 
    - list [ref=e52]:
      - listitem [ref=e53]:
        - generic [ref=e54]:
          - text: RBAC Admin
          - link [ref=e55] [cursor=pointer]:
            - /url: "javascript:"
            - generic [ref=e56]: 
          - text: 
  - generic [ref=e63]:
    - button [ref=e65] [cursor=pointer]: Add Feature
    - generic [ref=e71]:
      - button [ref=e73] [cursor=pointer]:
        - generic [ref=e74]: 
      - generic [ref=e77]:
        - text: Show
        - combobox [ref=e78]
        - text: entries
      - generic [ref=e80]:
        - text: "Search:"
        - searchbox [active] [ref=e81]: Indofast Test Automation Feature MUZO82STB-1
      - grid [ref=e82]:
        - rowgroup [ref=e83]:
          - row [ref=e84]:
            - columnheader [ref=e85] [cursor=pointer]: Feature Name
            - columnheader [ref=e86] [cursor=pointer]: Description
            - columnheader [ref=e87] [cursor=pointer]: Mapped Pages
            - columnheader [ref=e88] [cursor=pointer]: Created Date
            - columnheader [ref=e89] [cursor=pointer]: Created By
            - columnheader [ref=e90] [cursor=pointer]: Updated Date
            - columnheader [ref=e91] [cursor=pointer]: Updated By
            - columnheader [ref=e92] [cursor=pointer]: Status
            - columnheader [ref=e93] [cursor=pointer]: Action
        - rowgroup [ref=e94]:
          - row [ref=e95] [cursor=pointer]:
            - gridcell [ref=e96]: Indofast Test Automation Feature MUZO82STB-1
            - gridcell [ref=e97]: duplicate on another page, deleted in this scenario
            - gridcell [ref=e98]: Indofast Test Automation Page MUZO82STB-2
            - gridcell [ref=e99]: 08-10-2026 20:48:02
            - gridcell [ref=e100]: RBAC Admin
            - gridcell [ref=e101]: RBAC Admin
            - gridcell [ref=e102]: 08-10-2026 20:48:02
            - gridcell [ref=e103]: "true"
            - gridcell [ref=e104]:
              - link [ref=e105]:
                - /url: "javascript:"
                - generic [ref=e106]: 
          - row [ref=e107] [cursor=pointer]:
            - gridcell [ref=e108]: Indofast Test Automation Feature MUZO82STB-1
            - gridcell [ref=e109]: Playwright automation feature
            - gridcell [ref=e110]: Indofast Test Automation Page MUZO82STB-1
            - gridcell [ref=e111]: 08-10-2026 20:44:35
            - gridcell [ref=e112]: RBAC Admin
            - gridcell [ref=e113]: RBAC Admin
            - gridcell [ref=e114]: 08-10-2026 20:44:35
            - gridcell [ref=e115]: "true"
            - gridcell [ref=e116]:
              - link [ref=e117]:
                - /url: "javascript:"
                - generic [ref=e118]: 
          - row [ref=e119] [cursor=pointer]:
            - gridcell [ref=e120]: Indofast Test Automation Feature MUZOHF1T
            - gridcell [ref=e121]: Temporary feature, deleted in this scenario
            - gridcell [ref=e122]: Indofast Test Automation Page MUZO82STB-1
            - gridcell [ref=e123]: 08-10-2026 20:45:21
            - gridcell [ref=e124]: RBAC Admin
            - gridcell [ref=e125]: RBAC Admin
            - gridcell [ref=e126]: 08-10-2026 20:45:21
            - gridcell [ref=e127]: "true"
            - gridcell [ref=e128]:
              - link [ref=e129]:
                - /url: "javascript:"
                - generic [ref=e130]: 
      - status [ref=e131]: Showing 1 to 3 of 3 entries (filtered from 350 total entries)
      - generic [ref=e132]:
        - generic [ref=e133]: Previous
        - generic [ref=e134]: "1"
        - generic [ref=e136]: Next
```

# Test source

```ts
  215 | 
  216 | Then('the grid status should contain {string}', async ({ page }, text) => {
  217 |   await expect(page.getByRole('status')).toContainText(text);
  218 | });
  219 | 
  220 | Then('every visible row should contain {string}', async ({ page, ctx }, raw) => {
  221 |   const text = ctx.resolve(raw);
  222 |   const rows = page.locator('tbody tr');
  223 |   await expect(rows.first()).toContainText(text);
  224 |   const count = Math.min(await rows.count(), 10);
  225 |   for (let i = 0; i < count; i++) {
  226 |     await expect(rows.nth(i)).toContainText(new RegExp(text, 'i'));
  227 |   }
  228 | });
  229 | 
  230 | When('I show {int} entries per page', async ({ page }, size) => {
  231 |   await page.getByRole('combobox', { name: 'Show entries' }).selectOption(String(size));
  232 | });
  233 | 
  234 | Then('the grid should show at most {int} rows', async ({ page }, max) => {
  235 |   await expect(page.getByRole('status')).toContainText(/Showing 1 to \d+ of/);
  236 |   expect(await page.locator('tbody tr').count()).toBeLessThanOrEqual(max);
  237 | });
  238 | 
  239 | When('I sort by {string}', async ({ page, ctx }, column) => {
  240 |   const header = page.getByRole('columnheader', { name: new RegExp(column) });
  241 |   await header.click();
  242 |   (ctx.sortStates ||= []).push(await header.getAttribute('aria-sort'));
  243 | });
  244 | 
  245 | Then('the sort order should be reversed', async ({ ctx }) => {
  246 |   const [first, second] = ctx.sortStates.slice(-2);
  247 |   expect(second).not.toBe(first);
  248 | });
  249 | 
  250 | When('I remember the first row', async ({ page, ctx }) => {
  251 |   ctx.rememberedRow = (await firstRow(page).textContent()).trim();
  252 | });
  253 | 
  254 | Then('the first row should be unchanged', async ({ page, ctx }) => {
  255 |   await expect(firstRow(page)).toHaveText(ctx.rememberedRow);
  256 | });
  257 | 
  258 | // ---------- Users: assign / unassign role ----------
  259 | 
  260 | When('I open the assign role dialog', async ({ page, ctx }) => {
  261 |   await firstRow(page).locator('.fa-link').click();
  262 |   await waitForIdle(page);
  263 |   ctx.dialog = page.getByRole('dialog', { name: /assignRole/ });
  264 |   await expect(ctx.dialog).toBeVisible();
  265 | });
  266 | 
  267 | When('I open the unassign role dialog', async ({ page, ctx }) => {
  268 |   await firstRow(page).locator('.fa-unlink').click();
  269 |   await waitForIdle(page);
  270 |   ctx.dialog = page.getByRole('dialog', { name: /unassignRole/ });
  271 |   await expect(ctx.dialog).toBeVisible();
  272 | });
  273 | 
  274 | // The assign dialog loads roles and applications in parallel. If the app is picked before the
  275 | // role list arrives, the list stays "No data available"; picking the app again rebuilds it.
  276 | When('I select the role {string}', async ({ page, ctx }, role) => {
  277 |   const name = ctx.resolve(role);
  278 |   const option = ctx.dialog.locator('li.multiselect-item-checkbox', { hasText: name });
  279 |   for (let attempt = 1; ; attempt++) {
  280 |     await ctx.dialog.locator('.dropdown-btn').click();
  281 |     if (await option.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false)) break;
  282 |     if (attempt === 3) throw new Error(`Role "${name}" is not offered for the chosen application`);
  283 |     await ctx.dialog.locator('.dropdown-btn').click();
  284 |     const app = (await ctx.dialog.locator('.ng-value-label').first().textContent()).trim();
  285 |     await ctx.dialog.locator('.ng-clear-wrapper').first().click();
  286 |     await ngSelect(page, ctx.dialog, app);
  287 |     await waitForIdle(page);
  288 |   }
  289 |   await option.click();
  290 |   // Close the dropdown so it does not cover the Submit button
  291 |   await ctx.dialog.locator('.dropdown-btn').click();
  292 | });
  293 | 
  294 | When('I open the role list', async ({ ctx }) => {
  295 |   await ctx.dialog.locator('.dropdown-btn').click();
  296 | });
  297 | 
  298 | Then('the role list should show {string}', async ({ ctx }, text) => {
  299 |   await expect(ctx.dialog.getByText(text)).toBeVisible();
  300 | });
  301 | 
  302 | When('I tick the role {string}', async ({ ctx }, role) => {
  303 |   await ctx.dialog.getByRole('listitem').filter({ hasText: ctx.resolve(role) }).getByRole('checkbox').check();
  304 | });
  305 | 
  306 | // ---------- Row action icons (edit / assign / unassign / disable / enable / delete) ----------
  307 | 
  308 | const ICONS = {
  309 |   edit: '.fa-edit',
  310 |   assign: '.fa-link',
  311 |   unassign: '.fa-unlink',
  312 |   disable: '.fa-times-circle',
  313 |   enable: '.fa-check-circle',
  314 |   delete: '.fa-times-circle',
> 315 | };
      |                                          ^ Error: expect(locator).toHaveCount(expected) failed
  316 | const icon = name => {
  317 |   if (!ICONS[name]) throw new Error(`Unknown icon "${name}". Known: ${Object.keys(ICONS).join(', ')}`);
  318 |   return ICONS[name];
  319 | };
  320 | 
  321 | When('I click the {string} icon', async ({ page, ctx }, name) => {
  322 |   await firstRow(page).locator(icon(name)).click();
  323 |   await waitForIdle(page);
  324 |   ctx.dialog = page.getByRole('dialog').first();
  325 |   await expect(ctx.dialog).toBeVisible();
  326 | });
  327 | 
  328 | Then('the first row should have the {string} icon', async ({ page }, name) => {
  329 |   await expect(firstRow(page).locator(icon(name))).toBeVisible();
  330 | });
  331 | 
  332 | Then('the first row should not have the {string} icon', async ({ page }, name) => {
  333 |   await expect(firstRow(page).locator(icon(name))).toHaveCount(0);
  334 | });
  335 | 
  336 | Then('the first row should show status {string}', async ({ page }, status) => {
  337 |   // Status is the column just before Action
  338 |   await expect(firstRow(page).locator('td:nth-last-child(2)')).toHaveText(status, { timeout: 30000 });
  339 | });
  340 | 
  341 | When('I click on the first row', async ({ page }) => {
  342 |   await firstRow(page).locator('td').nth(1).click();
  343 | });
  344 | 
  345 | Then('no dialog should open', async ({ page }) => {
  346 |   await page.waitForTimeout(2000);
  347 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  348 | });
  349 | 
  350 | // ---------- Confirmation popups (Yes / No) ----------
  351 | 
  352 | Then('I should see the confirmation {string}', async ({ page, ctx, $testInfo }, text) => {
  353 |   const dialog = page.getByRole('dialog').filter({ hasText: ctx.resolve(text) });
  354 |   await expect(dialog).toBeVisible({ timeout: 30000 });
  355 |   await snap(page, $testInfo, `confirm ${text}`);
  356 | });
  357 | 
  358 | // "Yes" triggers a write (DELETE/PATCH). Staging sometimes takes over 30s to answer, so wait
  359 | // up to 90s for that call (and give the test the extra time) before checking the popup.
  360 | When('I answer {string}', async ({ page, $testInfo }, answer) => {
  361 |   let written = null;
  362 |   if (answer === 'Yes') {
  363 |     $testInfo.setTimeout($testInfo.timeout + 90000);
  364 |     written = page.waitForResponse(r => r.request().method() !== 'GET' && /\/api\/v1\//.test(r.url()), { timeout: 90000 })
  365 |       .catch(() => null);
  366 |   }
  367 |   await page.getByRole('dialog').getByRole('button', { name: answer, exact: true }).click();
  368 |   await written;
  369 |   await waitForIdle(page);
  370 | });
  371 | 
  372 | // Popup with a message but no title (e.g. delete blocked by a business rule).
  373 | Then('I should see the message {string}', async ({ page, ctx, $testInfo }, raw) => {
  374 |   const text = ctx.resolve(raw);
  375 |   await expect(page.getByRole('dialog').getByText(text)).toBeVisible({ timeout: 30000 });
  376 |   await attachPopupText(page, $testInfo, `Error text - ${text}`);
  377 |   await snap(page, $testInfo, `Error popup - ${text}`);
  378 |   await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  379 |   await waitForIdle(page);
  380 | });
  381 | 
  382 | // ---------- Form field helpers (edit dialogs) ----------
  383 | 
  384 | When('I remember the value of {string}', async ({ ctx }, placeholder) => {
  385 |   ctx.remembered = await ctx.dialog.getByPlaceholder(placeholder).inputValue();
  386 | });
  387 | 
  388 | When('I append {string} to {string}', async ({ ctx }, suffix, placeholder) => {
  389 |   const field = ctx.dialog.getByPlaceholder(placeholder);
  390 |   await field.fill((await field.inputValue()) + suffix);
  391 | });
  392 | 
  393 | When('I clear {string}', async ({ ctx }, placeholder) => {
  394 |   await ctx.dialog.getByPlaceholder(placeholder).fill('');
  395 | });
  396 | 
  397 | When('I type {int} characters in {string}', async ({ ctx }, count, placeholder) => {
  398 |   const field = ctx.dialog.getByPlaceholder(placeholder);
  399 |   await field.fill('');
  400 |   await field.pressSequentially('A'.repeat(count));
  401 | });
  402 | 
  403 | Then('{string} should hold at most {int} characters', async ({ page, ctx, $testInfo }, placeholder, max) => {
  404 |   const value = await ctx.dialog.getByPlaceholder(placeholder).inputValue();
  405 |   expect(value.length).toBeLessThanOrEqual(max);
  406 |   expect(value.length).toBeGreaterThan(0);
  407 |   await snap(page, $testInfo, `Validation - ${placeholder} limited to ${max} characters ("${value}")`);
  408 | });
  409 | 
  410 | Then('the dialog should still be open', async ({ ctx }) => {
  411 |   await expect(ctx.dialog).toBeVisible();
  412 | });
  413 | 
  414 | // Types key by key (unlike "I enter", which pastes), so maxlength and digit-only filters apply.
  415 | When('I type {string} into {string}', async ({ ctx }, value, placeholder) => {
```