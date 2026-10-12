// Runs the tests, builds the Allure report and sends the summary email, even when tests fail.
//
//   node scripts/run-and-mail.js [playwright test arguments]
//   npm run test:bdd:mail                     -> full BDD flow
//   npm run test:bdd:mail -- --last-failed    -> rerun only the failed tests
//
// Allure results are cleared first, except for a --last-failed rerun, so the report keeps the
// failed attempt next to the rerun after a fix. Exits with the test run's exit code.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const run = (command, commandArgs) => {
  console.log(`\n> ${command} ${commandArgs.join(' ')}`);
  return spawnSync(command, commandArgs, { cwd: ROOT, stdio: 'inherit', shell: true });
};
const quote = a => (/[\s|$]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

if (!args.includes('--last-failed')) {
  fs.rmSync(path.join(ROOT, 'allure-results'), { recursive: true, force: true });
}
run('npx', ['bddgen']);
const tests = run('npx', ['playwright', 'test', ...args.map(quote)]);
run('npm', ['run', 'allure:generate']);
const mail = run('node', ['scripts/send-report-mail.js']);
if (mail.status !== 0) console.error('The summary email could not be built or sent (see above).');
process.exit(tests.status ?? 1);
