// Shared login helper for RBAC dashboard tests.
// URL and credentials come from .env (loaded in playwright.config.ts) or the environment.
const { test, expect } = require('@playwright/test');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env in the project root and fill in ${name}.`);
  }
  return value;
}

const BASE_URL = requireEnv('RBAC_BASE_URL');
const EMAIL = requireEnv('RBAC_EMAIL');
const PASSWORD = requireEnv('RBAC_PASSWORD');

async function login(page, email = EMAIL, password = PASSWORD) {
  await page.goto(BASE_URL);
  // The app shows a loader while bootstrapping; fields filled before it settles can be lost.
  await page.locator('.loader_div').waitFor({ state: 'hidden', timeout: 30000 });
  await page.getByPlaceholder('Enter Email ID').fill(email);
  await page.getByPlaceholder('Enter Password').fill(password);
  await page.getByRole('button', { name: 'LOGIN' }).click();
}

// Give the current test (or hook) extra time for login back-off, if running inside one.
function extendTimeout(ms) {
  try {
    const info = test.info();
    if (info.timeout > 0) info.setTimeout(info.timeout + ms);
  } catch {
    // Not inside a test (e.g. a standalone script) - nothing to extend.
  }
}

// Login is two calls: Firebase verifyPassword, then the SunMobility auth API
// (smauth .../OAuth/ThirdPartyAuthentication). With valid credentials either can fail
// intermittently when many tests log in back to back:
//  - Firebase "QUOTA_EXCEEDED : Exceeded quota for verifying passwords" -> needs a cool-down
//  - smauth 400 "Invalid username or password." right after a successful Firebase call
// The app then shows a popup ("Please check your username and password", or a blank one
// with only OK). Treat any popup on the login page as a rejection, back off and retry.
async function loginAsAdmin(page) {
  const rejected = page.getByRole('dialog').getByRole('button', { name: 'OK' });
  let lastError = '';
  const onResponse = async response => {
    if (/identitytoolkit|smauth|OAuth/i.test(response.url()) && response.status() >= 400) {
      const body = await response.text().catch(() => '');
      const msg = body.match(/"(?:message|responseException)":\s*"([^"]+)"/g)?.pop() ?? body.slice(0, 200);
      lastError = `${response.status()} ${new URL(response.url()).pathname} ${msg}`;
    }
  };
  page.on('response', onResponse);
  try {
    const attempts = 4;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      lastError = '';
      await login(page);
      await Promise.race([
        page.waitForURL(/\/home$/, { timeout: 30000 }),
        rejected.waitFor({ timeout: 30000 }),
      ]).catch(() => {});
      if (/\/home$/.test(page.url())) return;
      if (attempt === attempts || !(await rejected.isVisible())) break;

      await page.getByRole('button', { name: 'OK' }).click();
      // Quota errors need a real cool-down; anything else gets a short retry.
      const waitMs = /QUOTA_EXCEEDED|TOO_MANY_ATTEMPTS/.test(lastError) ? 60000 * attempt : 3000 * attempt;
      console.warn(`Login attempt ${attempt} rejected (${lastError || 'no API error captured'}); retrying in ${waitMs / 1000}s`);
      extendTimeout(waitMs + 60000);
      await page.waitForTimeout(waitMs);
    }
  } finally {
    page.off('response', onResponse);
  }
  await expect(page, `Login failed. Last auth API error: ${lastError || 'none'}`).toHaveURL(/\/home$/);
}

module.exports = { BASE_URL, EMAIL, PASSWORD, login, loginAsAdmin };
