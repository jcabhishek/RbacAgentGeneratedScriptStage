import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import fs from 'fs';
import path from 'path';

/* Load URL and credentials from .env (copy .env.example to create it).
   Variables already set in the environment (e.g. on CI) take precedence. */
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

/* One id per run, inherited by all workers, so the ordered flow
   (Application -> Pages -> Features -> Roles -> Users) works on the same records. */
process.env.RBAC_RUN_ID ||= Date.now().toString(36).toUpperCase();

/* Tag shown on every Allure result, so a failed attempt and the rerun after a fix can be told
   apart in a test's "Retries" tab. `--last-failed` marks a rerun automatically. */
process.env.RBAC_ATTEMPT ||= process.argv.includes('--last-failed') ? 'rerun-after-fix' : 'first-run';

/* Cucumber (Gherkin) suite: .feature files are compiled into Playwright tests in .features-gen
   by `npx bddgen` (run automatically by `npm run test:bdd`). */
const bddTestDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'features/steps/*.js',
  outputDir: '.features-gen',
});

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests serially in a single worker */
  fullyParallel: false,
  workers: 1,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Staging is intermittently flaky (logins, slow APIs); retry once locally, twice on CI */
  retries: process.env.CI ? 2 : 1,
  /* Live progress in the terminal, Playwright HTML report (with traces) and Allure results.
     Build/open the Allure report with `npm run allure:generate` / `npm run allure:open`. */
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    /* Machine-readable results for the summary email (scripts/send-report-mail.js) */
    ...(process.argv.includes('--list') ? [] : [['json', { outputFile: 'reports/results.json' }]] as any[]),
    /* `--list` only prints tests; without this guard Allure would record them all as "skipped" */
    ...(process.argv.includes('--list') ? [] : [['allure-playwright', {
      resultsDir: 'allure-results',
      detail: true,
      suiteTitle: true,
      /* Groups failures by cause on the Allure "Categories" tab */
      categories: [
        { name: 'Test timeout (staging slow or element never appeared)', matchedStatuses: ['broken', 'failed'], messageRegex: '.*Test timeout of \\d+ms exceeded.*' },
        { name: 'Login failed', matchedStatuses: ['broken', 'failed'], messageRegex: '.*Login failed.*' },
        { name: 'Expected popup or element not shown', matchedStatuses: ['failed'], messageRegex: '.*toBeVisible.*' },
        { name: 'Grid or field content mismatch', matchedStatuses: ['failed'], messageRegex: '.*(toContainText|toHaveText|toHaveValue|toHaveCount).*' },
        { name: 'Browser closed during test', matchedStatuses: ['broken', 'failed'], messageRegex: '.*(has been closed|Target closed).*' },
        { name: 'Other assertion failures', matchedStatuses: ['failed'] },
        { name: 'Other errors', matchedStatuses: ['broken'] },
      ],
      environmentInfo: {
        Application: process.env.RBAC_BASE_URL ?? '',
        Browser: 'chromium (headed, maximized)',
        Workers: '1',
        Node: process.version,
        OS: process.platform,
      },
    }]] as any[]),
  ],
  /* The staging app is slow; allow time for its loader and API calls */
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    browserName: 'chromium',
    /* Maximized window: no fixed viewport, so the page fills the browser window */
    viewport: null,
    launchOptions: { args: ['--start-maximized'] },
    /* Record a trace for every test and attach it to the HTML report. See https://playwright.dev/docs/trace-viewer */
    trace: 'on',
    /* Step screenshots come from snap() in tests/rbac/helpers.js and the BDD AfterStep hook;
       also keep a final screenshot of every test (pass or fail) */
    screenshot: 'on',
    headless: false,
  },
  projects: [
    /* Plain Playwright specs in tests/ */
    { name: 'spec', testDir: './tests' },
    /* Cucumber scenarios from features/. They share one logged-in page per worker
       (features/steps/fixtures.js), which records each test's trace and final screenshot itself,
       so the built-in ones are off here. RBAC_FRESH_LOGIN=true restores a new login per test. */
    {
      name: 'bdd',
      testDir: bddTestDir,
      use: process.env.RBAC_FRESH_LOGIN === 'true' ? {} : { trace: 'off', screenshot: 'off' },
    },
  ],
});
