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

// Traces only for failed attempts: a passing test's trace (~4 MB each) is dropped from the Allure
// results, so the report keeps the traces that explain a failure. Passing tests normally have no
// trace at all; one that saw an HTTP 5xx keeps its trace in test-results/ for the summary email.
let dropped = 0;
let kept = 0;
const isTrace = a => a.name === 'trace' && /zip|playwright-trace/.test(a.type || '');
for (const r of results) {
  const failedAttempt = ['failed', 'broken'].includes(r.data.status);
  let changed = false;
  const visit = node => {
    if (Array.isArray(node.attachments)) {
      node.attachments = node.attachments.filter(a => {
        if (!isTrace(a)) return true;
        if (failedAttempt) { kept++; return true; }
        fs.rmSync(path.join(dir, a.source), { force: true });
        dropped++;
        changed = true;
        return false;
      });
    }
    (node.steps || []).forEach(visit);
  };
  visit(r.data);
  if (changed) fs.writeFileSync(r.file, JSON.stringify(r.data));
}
console.log(`allure-mark-healed: kept ${kept} trace(s) of failed attempts, removed ${dropped} trace(s) of passed tests`);
