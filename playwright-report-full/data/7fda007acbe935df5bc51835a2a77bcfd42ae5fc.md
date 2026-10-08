# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ..\.features-gen\features\04-features.feature.spec.js >> 4. Features >> Add feature with a duplicate name on the same page is rejected
- Location: .features-gen\features\04-features.feature.spec.js:87:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('tbody tr')
Expected: 1
Received: 2
Timeout:  15000ms

Call log:
  - Expect "toHaveCount" locator('tbody tr') with timeout 15000ms
  - waiting for locator('tbody tr')
    32 × locator resolved to 2 elements
       - unexpected value "2"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - list [ref=e11]:
    - generic [ref=e12]:
      - list [ref=e13]:
        - listitem [ref=e14]
      - listitem [ref=e16]:
        - link " Users" [ref=e17] [cursor=pointer]:
          - /url: /home/rbac-users
          - generic [ref=e18]: 
          - generic: Users
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
          - link "" [ref=e55] [cursor=pointer]:
            - /url: "javascript:"
          - text: 
  - generic [ref=e63]:
    - button "Add Feature" [ref=e65] [cursor=pointer]
    - generic [ref=e71]:
      - button "" [ref=e73] [cursor=pointer]
      - generic [ref=e77]:
        - text: Show
        - combobox "Show entries" [ref=e78]:
          - option "50"
          - option "100" [selected]
          - option "200"
          - option "250"
          - option "500"
        - text: entries
      - generic [ref=e80]:
        - text: "Search:"
        - searchbox "Search:" [active] [ref=e81]: Indofast Test Automation Feature MUZO82STB-1
      - grid [ref=e82]:
        - rowgroup [ref=e83]:
          - row [ref=e84]:
            - 'columnheader "Feature Name: activate to sort column descending" [ref=e85] [cursor=pointer]': Feature Name
            - 'columnheader "Description: activate to sort column ascending" [ref=e86] [cursor=pointer]': Description
            - 'columnheader "Mapped Pages: activate to sort column ascending" [ref=e87] [cursor=pointer]': Mapped Pages
            - 'columnheader "Created Date: activate to sort column ascending" [ref=e88] [cursor=pointer]': Created Date
            - 'columnheader "Created By: activate to sort column ascending" [ref=e89] [cursor=pointer]': Created By
            - 'columnheader "Updated Date: activate to sort column ascending" [ref=e90] [cursor=pointer]': Updated Date
            - 'columnheader "Updated By: activate to sort column ascending" [ref=e91] [cursor=pointer]': Updated By
            - 'columnheader "Status: activate to sort column ascending" [ref=e92] [cursor=pointer]': Status
            - 'columnheader "Action: activate to sort column ascending" [ref=e93] [cursor=pointer]': Action
        - rowgroup [ref=e94]:
          - row [ref=e95] [cursor=pointer]:
            - gridcell "Indofast Test Automation Feature MUZO82STB-1" [ref=e96]
            - gridcell "Playwright automation feature" [ref=e97]
            - gridcell "Indofast Test Automation Page MUZO82STB-1" [ref=e98]
            - gridcell "08-10-2026 20:44:35" [ref=e99]
            - gridcell "RBAC Admin" [ref=e100]
            - gridcell "RBAC Admin" [ref=e101]
            - gridcell "08-10-2026 20:44:35" [ref=e102]
            - gridcell "true" [ref=e103]
            - gridcell [ref=e104]:
              - link "" [ref=e105]:
                - /url: "javascript:"
          - row [ref=e107] [cursor=pointer]:
            - gridcell "Indofast Test Automation Feature MUZOHF1T" [ref=e108]
            - gridcell "Temporary feature, deleted in this scenario" [ref=e109]
            - gridcell "Indofast Test Automation Page MUZO82STB-1" [ref=e110]
            - gridcell "08-10-2026 20:45:21" [ref=e111]
            - gridcell "RBAC Admin" [ref=e112]
            - gridcell "RBAC Admin" [ref=e113]
            - gridcell "08-10-2026 20:45:21" [ref=e114]
            - gridcell "true" [ref=e115]
            - gridcell [ref=e116]:
              - link "" [ref=e117]:
                - /url: "javascript:"
      - status [ref=e119]: Showing 1 to 2 of 2 entries (filtered from 349 total entries)
      - generic [ref=e120]:
        - generic [ref=e121]: Previous
        - generic [ref=e122]: "1"
        - generic [ref=e124]: Next
```

# Test source

```ts
  101 | });
  102 | 
  103 | Then('I capture a screenshot {string}', async ({ page, $testInfo }, label) => {
  104 |   await snap(page, $testInfo, label);
  105 | });
  106 | 
  107 | // ---------- Add forms ----------
  108 | 
  109 | When('I open the {string} form', async ({ page, ctx }, trigger) => {
  110 |   const form = FORMS[trigger];
  111 |   if (!form) throw new Error(`Unknown form "${trigger}". Known: ${Object.keys(FORMS).join(', ')}`);
  112 |   ctx.dialog = await openForm(page, trigger, ...form);
  113 | });
  114 | 
  115 | When('I enter {string} in {string}', async ({ ctx }, value, placeholder) => {
  116 |   await ctx.dialog.getByPlaceholder(placeholder).fill(ctx.resolve(value));
  117 | });
  118 | 
  119 | When('I choose {string} from the dropdown', async ({ page, ctx }, value) => {
  120 |   await ngSelect(page, ctx.dialog, ctx.resolve(value));
  121 |   await waitForIdle(page);
  122 | });
  123 | 
  124 | When('I grant page {string} with write access to feature {string}', async ({ page, ctx }, pageName, feature) => {
  125 |   const pageId = ctx.resolve(pageName);
  126 |   await ctx.dialog.locator('li').filter({ has: page.locator(`input[id="${pageId}"]`) }).locator('span.slider').click();
  127 |   const featureItem = ctx.dialog.getByRole('listitem').filter({ hasText: ctx.resolve(feature) });
  128 |   await featureItem.getByRole('checkbox').first().check();
  129 |   await featureItem.getByRole('checkbox').nth(1).check();
  130 | });
  131 | 
  132 | When('I submit the form', async ({ ctx }) => {
  133 |   await ctx.dialog.getByRole('button', { name: 'Submit' }).click();
  134 | });
  135 | 
  136 | When('I cancel the form', async ({ ctx }) => {
  137 |   await ctx.dialog.getByRole('button', { name: 'Cancel' }).click();
  138 |   await expect(ctx.dialog).toBeHidden();
  139 | });
  140 | 
  141 | // ---------- Popups and validation ----------
  142 | 
  143 | // Popups that report a rejected action; their screenshots are labelled "Error popup - ..." so the
  144 | // failure evidence stands out in the HTML and Allure reports.
  145 | const ERROR_HEADING = /mandatory|warning|not allowed|error|invalid|already|cannot/i;
  146 | 
  147 | // Attach the popup's full text (heading + message) so the exact error is readable in the report.
  148 | async function attachPopupText(page, testInfo, name) {
  149 |   const popup = page.locator('.swal2-popup:visible');
  150 |   if (!(await popup.count())) return;
  151 |   const text = (await popup.innerText()).replace(/\s*\bOK\b\s*$/, '').replace(/\s+/g, ' ').trim();
  152 |   await testInfo.attach(name, { body: text, contentType: 'text/plain' });
  153 | }
  154 | 
  155 | Then('I should see the popup {string}', async ({ page, $testInfo }, heading) => {
  156 |   if (ERROR_HEADING.test(heading)) {
  157 |     await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible({ timeout: 30000 });
  158 |     await attachPopupText(page, $testInfo, `Error text - ${heading}`);
  159 |     await expectAlert(page, $testInfo, heading, `Error popup - ${heading}`);
  160 |   } else {
  161 |     await expectAlert(page, $testInfo, heading, heading);
  162 |   }
  163 | });
  164 | 
  165 | Then('I should see a success popup', async ({ page, $testInfo }) => {
  166 |   await expectAlert(page, $testInfo, /success|assigned|unassigned|removed/i, 'success popup');
  167 | });
  168 | 
  169 | Then('I should see the error popup {string}', async ({ page, ctx, $testInfo }, raw) => {
  170 |   const message = ctx.resolve(raw);
  171 |   await expect(page.getByText(message)).toBeVisible({ timeout: 30000 });
  172 |   await attachPopupText(page, $testInfo, `Error text - ${message}`);
  173 |   await expectAlert(page, $testInfo, 'Error', `Error popup - ${message}`);
  174 | });
  175 | 
  176 | Then('I should see the validation message {string}', async ({ ctx }, message) => {
  177 |   await expect(ctx.dialog.getByText(message)).toBeVisible();
  178 | });
  179 | 
  180 | Then('I should not see the validation message {string}', async ({ ctx }, message) => {
  181 |   await expect(ctx.dialog.getByText(message)).toBeHidden();
  182 | });
  183 | 
  184 | // ---------- Grid ----------
  185 | 
  186 | Then('I should see the {string} button', async ({ page }, text) => {
  187 |   await expect(page.getByText(text, { exact: true })).toBeVisible();
  188 | });
  189 | 
  190 | Then('the grid should have the columns:', async ({ page }, table) => {
  191 |   for (const header of table.raw().flat()) {
  192 |     await expect(page.getByRole('columnheader', { name: header }).first()).toBeVisible();
  193 |   }
  194 | });
  195 | 
  196 | When('I search for {string}', async ({ page, ctx }, text) => {
  197 |   await searchGrid(page, ctx.resolve(text));
  198 | });
  199 | 
  200 | Then('the grid should have {int} row(s)', async ({ page }, count) => {
> 201 |   await expect(page.locator('tbody tr')).toHaveCount(count);
      |                                          ^ Error: expect(locator).toHaveCount(expected) failed
  202 | });
  203 | 
  204 | Then('the first row should contain {string}', async ({ page, ctx }, text) => {
  205 |   await expect(firstRow(page)).toContainText(ctx.resolve(text), { timeout: 30000 });
  206 | });
  207 | 
  208 | Then('the first row should not contain {string}', async ({ page, ctx }, text) => {
  209 |   await expect(firstRow(page)).not.toContainText(ctx.resolve(text), { timeout: 30000 });
  210 | });
  211 | 
  212 | Then('the grid should show no matching records', async ({ page }) => {
  213 |   await expect(page.getByRole('gridcell', { name: 'No matching records found' })).toBeVisible();
  214 | });
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
```