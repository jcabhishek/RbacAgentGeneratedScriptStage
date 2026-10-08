// Custom fixtures for the BDD (Cucumber) suite.
// `ctx` is per-scenario state shared between steps (current dialog, remembered values).
const { test: base, createBdd } = require('playwright-bdd');
const allure = require('allure-js-commons');
const { tempName, runNames } = require('../../tests/rbac/helpers');

// Records created by the ordered flow (02 Application -> 03 Pages -> 04 Features -> 05 Roles ->
// 06 Users): one application with two pages, one feature on each page, and a role granting both.
// The run id is shared by every feature in the run (see playwright.config.ts);
// the "B" suffix keeps them apart from the records created by the spec suite.
const names = runNames('B');
const TOKENS = {
  $EMAIL: process.env.RBAC_EMAIL,
  $APP: names.APP,
  $APP_LOWER: names.APP.toLowerCase(),
  $PAGE: names.PAGE,
  $PAGE2: names.PAGE2,
  $FEATURE: names.FEATURE,
  $FEATURE2: names.FEATURE2,
  $ROLE: names.ROLE,
  $USER: names.USER_ID,
  $USER2: names.USER2_ID,
  $EXISTING_APP: names.EXISTING_APP,
  $EMPTY_APP: names.EMPTY_APP,
};

const TEMP_TYPES = { $TEMP_APP: 'App', $TEMP_PAGE: 'Page', $TEMP_FEATURE: 'Feature', $TEMP_ROLE: 'Role' };

const test = base.extend({
  // Allure tags: which attempt this is (first-run / rerun-after-fix) and the run id.
  allureAttempt: [async ({}, use) => {
    await allure.tag(process.env.RBAC_ATTEMPT || 'first-run');
    await allure.tag(`run-${process.env.RBAC_RUN_ID}`);
    await use();
  }, { auto: true }],
  ctx: async ({}, use) => {
    const ctx = {
      // Replace $TOKENS in step text. $TEMP_APP / $TEMP_PAGE / $TEMP_FEATURE / $TEMP_ROLE are fresh
      // throw-away names ("Indofast Test Automation <Type> <suffix>"), fixed for the whole scenario.
      temp: {},
      resolve(text) {
        return text.replace(/\$[A-Z_0-9]+/g, token => {
          const type = TEMP_TYPES[token];
          if (type) return (ctx.temp[token] ||= tempName(type));
          if (token === '$REMEMBERED') return ctx.remembered ?? token;
          return TOKENS[token] ?? token;
        });
      },
    };
    await use(ctx);
  },
});

module.exports = { test, TOKENS, ...createBdd(test) };
