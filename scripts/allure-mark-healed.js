// Run before `allure generate`. For every test that failed in an earlier attempt and passed in a
// later one (e.g. rerun after a fix), mark the latest result as flaky and note the earlier
// failure in it, so the Allure report flags the test instead of only listing the attempt under
// "Retries". Results are grouped by historyId, the same way Allure groups attempts.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'allure-results');
if (!fs.existsSync(dir)) process.exit(0);

const results = fs.readdirSync(dir)
  .filter(f => f.endsWith('-result.json'))
  .map(f => ({ file: path.join(dir, f), data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));

const byHistory = new Map();
for (const r of results) {
  const list = byHistory.get(r.data.historyId) || [];
  list.push(r);
  byHistory.set(r.data.historyId, list);
}

let marked = 0;
for (const attempts of byHistory.values()) {
  attempts.sort((a, b) => a.data.start - b.data.start);
  const latest = attempts[attempts.length - 1];
  const failed = attempts.slice(0, -1).filter(a => ['failed', 'broken'].includes(a.data.status));
  if (latest.data.status !== 'passed' || failed.length === 0) continue;

  const first = failed[0].data;
  const reason = (first.statusDetails?.message || '').split('\n')[0];
  latest.data.statusDetails = {
    ...latest.data.statusDetails,
    flaky: true,
    message: `Passed after ${failed.length} failed attempt(s). First failure (${first.status}): ${reason}`,
  };
  if (!latest.data.labels.some(l => l.name === 'tag' && l.value === 'healed')) {
    latest.data.labels.push({ name: 'tag', value: 'healed' });
  }
  fs.writeFileSync(latest.file, JSON.stringify(latest.data));
  marked++;
}
console.log(`allure-mark-healed: ${marked} test(s) passed after an earlier failure`);
