// Builds and sends the test-run summary email.
//
//   node scripts/send-report-mail.js      (npm run mail:report)
//
// Reads the results of the last run and sends:
//   - counts (total / passed / failed / flaky / skipped), duration, environment
//   - each failed test with its error and failure screenshot (inline)
//   - failed API calls (4xx / 5xx / no response) with URL, payload and response
//   - attachments: failure screenshots, failed-api-calls.xlsx, a light single-file Allure report
//
// Sources: reports/results.json (Playwright JSON reporter), each test's trace.zip (network log)
// and allure-results/. SMTP settings come from .env; without SMTP_HOST the email is only saved to
// reports/test-summary.eml (and an HTML preview), nothing is sent.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const AdmZip = require('adm-zip');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');

const ROOT = path.join(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const RESULTS_JSON = path.join(REPORTS, 'results.json');
const ALLURE_RESULTS = path.join(ROOT, 'allure-results');

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const env = (name, fallback = '') => (process.env[name] ?? '').trim() || fallback;

const MAX_ATTACHMENT_MB = Number(env('MAIL_MAX_ATTACHMENT_MB', '18'));
const MAX_SCREENSHOTS = Number(env('MAIL_MAX_SCREENSHOTS', '10'));
const CELL_LIMIT = 32000; // Excel cell limit is 32,767 characters
const BODY_SNIPPET = 600; // payload / response characters shown in the email body

// ---------- Redaction: never put passwords, keys or tokens in an email ----------

const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const SECRET_KEYS = /^(password|passwd|pwd|key|secret|clientSecret|apiKey|idToken|refreshToken|accessToken|access_token|refresh_token|id_token|token|oauthAccessToken)$/i;
const KNOWN_SECRETS = [process.env.RBAC_PASSWORD, process.env.SMTP_PASS].filter(v => v && v.length >= 4);

function redact(text) {
  if (!text) return text;
  text = KNOWN_SECRETS.reduce((acc, s) => acc.split(s).join('***REDACTED***'), text);
  try {
    const scrub = v => {
      if (Array.isArray(v)) return v.map(scrub);
      if (v && typeof v === 'object') {
        return Object.fromEntries(Object.entries(v).map(([k, val]) =>
          [k, SECRET_KEYS.test(k) && typeof val === 'string' ? '***REDACTED***' : scrub(val)]));
      }
      return typeof v === 'string' ? v.replace(JWT, '<JWT redacted>') : v;
    };
    return JSON.stringify(scrub(JSON.parse(text)), null, 2);
  } catch {
    return text.replace(JWT, '<JWT redacted>').replace(/("password"\s*:\s*")[^"]*"/gi, '$1***REDACTED***"');
  }
}

const stripAnsi = s => (s || '').replace(/\u001b\[[0-9;]*m/g, '');
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n)}\n... [${s.length - n} more characters]` : s || '');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDuration = ms => {
  const s = Math.round(ms / 1000);
  return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

// ---------- 1. Test results ----------

function readResults() {
  if (!fs.existsSync(RESULTS_JSON)) {
    throw new Error(`${path.relative(ROOT, RESULTS_JSON)} not found. Run the tests first (the JSON reporter writes it).`);
  }
  const report = JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf8'));
  const tests = [];
  const walk = (suite, titles) => {
    const here = suite.title && !/\.(js|ts)$/.test(suite.title) ? [...titles, suite.title] : titles;
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const last = test.results[test.results.length - 1] || {};
        tests.push({
          name: [...here, spec.title].join(' › '),
          file: spec.file,
          project: test.projectName,
          outcome: test.status, // expected | unexpected | flaky | skipped
          status: last.status,
          duration: last.duration || 0,
          startTime: last.startTime ? Date.parse(last.startTime) : null,
          error: stripAnsi(last.error?.message || (last.errors || []).map(e => e.message).join('\n')),
          attachments: last.attachments || [],
        });
      }
    }
    for (const child of suite.suites || []) walk(child, here);
  };
  for (const suite of report.suites || []) walk(suite, []);
  return { stats: report.stats || {}, tests };
}

// ---------- 2. Failed API calls from each test's trace ----------

const isApi = url => /\/api\/v\d|identitytoolkit|securetoken/.test(url) && !/\.(js|css|png|svg|woff2?)(\?|$)/.test(url);

function apiFailures(tests) {
  const calls = [];
  for (const test of tests) {
    const trace = test.attachments.find(a => a.name === 'trace' && a.path && fs.existsSync(a.path));
    if (!trace) continue;
    let zip;
    try { zip = new AdmZip(trace.path); } catch { continue; }
    const resource = ref => {
      if (!ref) return '';
      const entry = zip.getEntry(ref.startsWith('resources/') ? ref : `resources/${ref}`);
      return entry ? entry.getData().toString('utf8') : '';
    };
    for (const entry of zip.getEntries().filter(e => e.entryName.endsWith('.network'))) {
      for (const line of entry.getData().toString('utf8').split('\n')) {
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch { continue; }
        const s = event.snapshot;
        if (event.type !== 'resource-snapshot' || !s || !isApi(s.request.url)) continue;
        // Only calls made while this test ran (a trace can also hold earlier network activity).
        const at = Date.parse(s.startedDateTime);
        if (test.startTime && (at < test.startTime - 1000 || at > test.startTime + test.duration + 1000)) continue;
        const status = s.response.status;
        if (status > 0 && status < 400) continue;
        const pd = s.request.postData;
        const content = s.response.content || {};
        calls.push({
          test: test.name,
          testResult: test.outcome === 'unexpected' ? 'FAILED' : test.outcome === 'flaky' ? 'FLAKY' : 'passed',
          time: s.startedDateTime,
          method: s.request.method,
          url: s.request.url,
          status: status > 0 ? status : 'no response',
          statusText: s.response.statusText || (status > 0 ? '' : 'request did not complete'),
          payload: redact(pd ? pd.text || resource(pd._file || pd._sha1) : ''),
          response: redact(content.text || resource(content._file || content._sha1)),
        });
      }
    }
  }
  return calls.sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

// An API error matters in the email when its test failed, or when the server itself failed
// (5xx / no response). 4xx in passing tests are expected by the negative tests (e.g. duplicates).
const isReportable = c => c.testResult !== 'passed' || c.status === 'no response' || c.status >= 500;

async function writeApiWorkbook(calls, file) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Failed API calls');
  ws.columns = [
    { header: '#', width: 5 }, { header: 'Test', width: 50 }, { header: 'Test result', width: 11 },
    { header: 'Time (UTC)', width: 21 }, { header: 'Method', width: 8 }, { header: 'URL', width: 70 },
    { header: 'Status', width: 12 }, { header: 'Status text', width: 22 }, { header: 'Payload', width: 60 },
    { header: 'Response', width: 80 }, { header: 'Note', width: 34 },
  ];
  calls.forEach((c, i) => ws.addRow([
    i + 1, c.test, c.testResult, String(c.time || '').replace('T', ' ').replace('Z', ''), c.method, c.url,
    c.status, c.statusText, clip(c.payload, CELL_LIMIT), clip(c.response, CELL_LIMIT),
    isReportable(c) ? 'Needs attention' : 'Expected by a negative test',
  ]));
  ws.eachRow((row, r) => row.eachCell(cell => {
    cell.font = { name: 'Arial', size: 10, bold: r === 1, color: r === 1 ? { argb: 'FFFFFFFF' } : undefined };
    cell.alignment = { vertical: 'top', wrapText: r > 1 };
    if (r === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  }));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 11 } };
  const notes = wb.addWorksheet('About');
  [
    ['Item', 'Detail'],
    ['Content', 'Every API call that returned 4xx / 5xx or no response during the run, taken from the Playwright traces.'],
    ['Note column', '"Needs attention": the test failed, or the server returned 5xx / no response. "Expected by a negative test": a 4xx in a passing test (e.g. duplicate checks).'],
    ['Redaction', 'Passwords, keys and tokens (password, Key, secret, idToken, refreshToken, access tokens and any JWT) are replaced with ***REDACTED*** / <JWT redacted>.'],
  ].forEach(r => notes.addRow(r));
  notes.columns = [{ width: 14 }, { width: 120 }];
  await wb.xlsx.writeFile(file);
}

// ---------- 3. Light, single-file Allure report for the email ----------
// The full report (traces and a screenshot per step) is hundreds of MB. The email copy keeps the
// results, error/failure screenshots and error texts, and drops traces and per-step screenshots.

function buildMailAllure() {
  if (!fs.existsSync(ALLURE_RESULTS)) return { note: 'No allure-results found.' };
  const lightDir = path.join(REPORTS, 'allure-mail-results');
  const outDir = path.join(REPORTS, 'allure-mail-report');
  fs.rmSync(lightDir, { recursive: true, force: true });
  fs.mkdirSync(lightDir, { recursive: true });
  // Failed / broken tests keep every screenshot; passing tests keep only the labelled error and
  // validation screenshots. Error texts are always kept; traces never.
  const EVIDENCE = /^(Error popup|Invalid field|Validation) - /;
  const keepAttachment = (a, failedTest) => a.type === 'text/plain'
    || (a.type === 'image/png' && (failedTest || EVIDENCE.test(a.name)));
  const copied = new Set();
  const copySource = src => {
    if (copied.has(src) || !fs.existsSync(path.join(ALLURE_RESULTS, src))) return;
    fs.copyFileSync(path.join(ALLURE_RESULTS, src), path.join(lightDir, src));
    copied.add(src);
  };
  let failedTest = false;
  const filter = node => {
    if (Array.isArray(node.attachments)) {
      node.attachments = node.attachments.filter(a => keepAttachment(a, failedTest));
      node.attachments.forEach(a => copySource(a.source));
    }
    (node.steps || []).forEach(filter);
  };
  for (const file of fs.readdirSync(ALLURE_RESULTS)) {
    const full = path.join(ALLURE_RESULTS, file);
    if (file.endsWith('-result.json') || file.endsWith('-container.json')) {
      const data = JSON.parse(fs.readFileSync(full, 'utf8'));
      failedTest = file.endsWith('-result.json') && !['passed', 'skipped'].includes(data.status);
      filter(data);
      (data.befores || []).forEach(filter);
      (data.afters || []).forEach(filter);
      fs.writeFileSync(path.join(lightDir, file), JSON.stringify(data));
    } else if (/^(environment\.properties|categories\.json|executor\.json)$/.test(file)) {
      fs.copyFileSync(full, path.join(lightDir, file));
    }
  }
  const allure = path.join(ROOT, 'node_modules', 'allure-commandline', 'bin', 'allure');
  const gen = spawnSync('node', [allure, 'generate', '--single-file', '--clean', lightDir, '-o', outDir], { encoding: 'utf8', shell: true });
  const html = path.join(outDir, 'index.html');
  if (gen.status !== 0 || !fs.existsSync(html)) return { note: `Allure single-file report could not be generated: ${stripAnsi(gen.stderr || gen.stdout).slice(0, 300)}` };
  const zipFile = path.join(REPORTS, 'allure-report.zip');
  const zip = new AdmZip();
  zip.addLocalFile(html, '', 'allure-report.html');
  zip.writeZip(zipFile);
  const mb = fs.statSync(zipFile).size / 1024 / 1024;
  if (mb > MAX_ATTACHMENT_MB) {
    return { note: `The Allure report is ${mb.toFixed(1)} MB (limit ${MAX_ATTACHMENT_MB} MB), so it is not attached. Find it at ${path.relative(ROOT, zipFile)}.` };
  }
  return { file: zipFile, mb };
}

// ---------- 4. Email ----------

function buildHtml({ stats, tests, failed, flaky, reportable, allCalls, allureInfo, screenshots }) {
  const passed = stats.expected || 0;
  const failedCount = stats.unexpected || 0;
  const total = passed + failedCount + (stats.flaky || 0) + (stats.skipped || 0);
  const ok = failedCount === 0;
  const color = ok ? '#1e7e34' : '#c62828';
  const cell = 'padding:6px 10px;border:1px solid #d0d7de;vertical-align:top;';
  const th = `${cell}background:#1f4e78;color:#fff;text-align:left;`;
  const count = (label, value, c) => `<td style="${cell}text-align:center;min-width:90px"><div style="font-size:22px;font-weight:bold;color:${c}">${value}</div><div style="color:#57606a">${label}</div></td>`;

  const failedRows = failed.map((t, i) => {
    const shot = screenshots.find(s => s.testName === t.name);
    return `<tr><td style="${cell}">${i + 1}</td><td style="${cell}"><b>${esc(t.name)}</b><div style="color:#57606a;font-size:12px">${esc(path.basename(t.file || ''))}</div></td>
      <td style="${cell}"><pre style="white-space:pre-wrap;margin:0;font-size:12px">${esc(clip(t.error.split('\n').slice(0, 8).join('\n'), 900))}</pre>
      ${shot ? `<div style="margin-top:6px"><img src="cid:${shot.cid}" alt="failure screenshot" style="max-width:560px;border:1px solid #d0d7de"></div>` : ''}</td></tr>`;
  }).join('');

  const apiRows = reportable.map((c, i) => `<tr><td style="${cell}">${i + 1}</td><td style="${cell}">${esc(c.test)}<div style="color:#57606a;font-size:12px">test ${esc(c.testResult)}</div></td>
      <td style="${cell}"><b>${esc(c.method)}</b> ${esc(c.url)}</td><td style="${cell}color:#c62828"><b>${esc(c.status)}</b> ${esc(c.statusText)}</td>
      <td style="${cell}"><pre style="white-space:pre-wrap;margin:0;font-size:11px">${esc(clip(c.payload, BODY_SNIPPET)) || '-'}</pre></td>
      <td style="${cell}"><pre style="white-space:pre-wrap;margin:0;font-size:11px">${esc(clip(c.response, BODY_SNIPPET)) || '-'}</pre></td></tr>`).join('');

  const expected4xx = allCalls.length - reportable.length;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#24292f;max-width:1100px">
  <h2 style="margin:0 0 4px">RBAC Dashboard - Test Automation Report</h2>
  <div style="font-size:16px;font-weight:bold;color:${color};margin-bottom:12px">${ok ? 'PASSED' : 'FAILED'} - ${passed} of ${total} tests passed</div>
  <table style="border-collapse:collapse;margin-bottom:12px"><tr>
    ${count('Total', total, '#24292f')}${count('Passed', passed, '#1e7e34')}${count('Failed', failedCount, failedCount ? '#c62828' : '#24292f')}
    ${count('Flaky', stats.flaky || 0, stats.flaky ? '#b26a00' : '#24292f')}${count('Skipped', stats.skipped || 0, '#24292f')}
  </tr></table>
  <table style="border-collapse:collapse;margin-bottom:16px;font-size:13px">
    <tr><td style="${cell}"><b>Application</b></td><td style="${cell}">${esc(env('RBAC_BASE_URL'))}</td></tr>
    <tr><td style="${cell}"><b>Started</b></td><td style="${cell}">${esc(new Date(stats.startTime || Date.now()).toLocaleString())}</td></tr>
    <tr><td style="${cell}"><b>Duration</b></td><td style="${cell}">${fmtDuration(stats.duration || 0)}</td></tr>
    <tr><td style="${cell}"><b>Browser</b></td><td style="${cell}">Chromium, headed, 1 worker</td></tr>
    <tr><td style="${cell}"><b>Projects</b></td><td style="${cell}">${esc([...new Set(tests.map(t => t.project))].join(', '))}</td></tr>
  </table>

  <h3 style="margin:16px 0 6px">Failed tests (${failed.length})</h3>
  ${failed.length ? `<table style="border-collapse:collapse;width:100%"><tr><th style="${th}">#</th><th style="${th}">Test</th><th style="${th}">Error and screenshot</th></tr>${failedRows}</table>
    ${failed.length > screenshots.length ? `<p style="color:#57606a;font-size:12px">Screenshots are shown for the first ${screenshots.length} failed tests; all are in the attached Allure report.</p>` : ''}`
    : '<p style="color:#1e7e34">No failed tests.</p>'}
  ${flaky.length ? `<h3 style="margin:16px 0 6px">Flaky tests (${flaky.length}) - passed on retry</h3><ul>${flaky.map(t => `<li>${esc(t.name)}</li>`).join('')}</ul>` : ''}

  <h3 style="margin:16px 0 6px">Failed API calls (${reportable.length})</h3>
  ${reportable.length ? `<p style="color:#57606a;font-size:12px;margin:0 0 6px">Calls that returned an error in failed tests, or a 5xx / no response in any test. Full payloads and responses are in the attached failed-api-calls.xlsx.</p>
    <table style="border-collapse:collapse;width:100%;font-size:12px"><tr><th style="${th}">#</th><th style="${th}">Test</th><th style="${th}">Request</th><th style="${th}">Status</th><th style="${th}">Payload</th><th style="${th}">Response</th></tr>${apiRows}</table>`
    : '<p style="color:#1e7e34">No failed API calls.</p>'}
  ${expected4xx ? `<p style="color:#57606a;font-size:12px">${expected4xx} other 4xx response(s) came from passing negative tests (e.g. duplicate checks) and are listed in failed-api-calls.xlsx only.</p>` : ''}

  <h3 style="margin:16px 0 6px">Attachments</h3>
  <ul style="margin-top:0">
    ${allureInfo.file ? `<li><b>allure-report.zip</b> (${allureInfo.mb.toFixed(1)} MB): unzip and open allure-report.html in a browser. Error screenshots and error texts are included; traces and per-step screenshots are in the full report on the test machine.</li>` : `<li>${esc(allureInfo.note)}</li>`}
    ${allCalls.length ? '<li><b>failed-api-calls.xlsx</b>: every 4xx / 5xx / no-response API call with URL, payload and response (secrets redacted).</li>' : ''}
    ${screenshots.length ? `<li>${screenshots.length} failure screenshot(s).</li>` : ''}
  </ul>
  <p style="color:#57606a;font-size:12px">Generated by the Playwright test automation on ${esc(new Date().toLocaleString())}.</p>
</div>`;
}

async function main() {
  fs.mkdirSync(REPORTS, { recursive: true });
  const { stats, tests } = readResults();
  const failed = tests.filter(t => t.outcome === 'unexpected');
  const flaky = tests.filter(t => t.outcome === 'flaky');

  // Failure screenshots: Playwright's own "screenshot" attachment, else the test's last image.
  const screenshots = [];
  for (const t of failed.slice(0, MAX_SCREENSHOTS)) {
    const images = t.attachments.filter(a => a.contentType === 'image/png' && a.path && fs.existsSync(a.path));
    const shot = images.find(a => a.name === 'screenshot') || images[images.length - 1];
    if (shot) screenshots.push({ testName: t.name, path: shot.path, cid: `shot${screenshots.length + 1}@rbac`, filename: `failed-${String(screenshots.length + 1).padStart(2, '0')}-${t.name.replace(/[^\w-]+/g, '_').slice(0, 60)}.png` });
  }

  const allCalls = apiFailures(tests);
  const reportable = allCalls.filter(isReportable);
  const attachments = screenshots.map(s => ({ filename: s.filename, path: s.path, cid: s.cid }));
  if (allCalls.length) {
    const xlsx = path.join(REPORTS, 'failed-api-calls.xlsx');
    await writeApiWorkbook(allCalls, xlsx);
    attachments.push({ filename: 'failed-api-calls.xlsx', path: xlsx });
  }
  const allureInfo = buildMailAllure();
  if (allureInfo.file) attachments.push({ filename: 'allure-report.zip', path: allureInfo.file });

  const passed = stats.expected || 0;
  const total = passed + (stats.unexpected || 0) + (stats.flaky || 0) + (stats.skipped || 0);
  const subject = `[RBAC Automation] ${stats.unexpected ? 'FAILED' : 'PASSED'} - ${total} tests: ${passed} passed, ${stats.unexpected || 0} failed`
    + `${stats.flaky ? `, ${stats.flaky} flaky` : ''} - ${new Date(stats.startTime || Date.now()).toLocaleString()}`;
  const html = buildHtml({ stats, tests, failed, flaky, reportable, allCalls, allureInfo, screenshots });
  fs.writeFileSync(path.join(REPORTS, 'test-summary.html'), html.replace(/src="cid:([^"]+)"/g, (m, cid) => {
    const s = screenshots.find(x => x.cid === cid);
    return s ? `src="file:///${s.path.replace(/\\/g, '/')}"` : m;
  }));

  const message = {
    from: env('MAIL_FROM', env('SMTP_USER', 'rbac-automation@localhost')),
    to: env('MAIL_TO'),
    cc: env('MAIL_CC') || undefined,
    subject,
    html,
    attachments,
  };

  // Always keep a copy of the exact email.
  const raw = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(message);
  const emlFile = path.join(REPORTS, 'test-summary.eml');
  fs.writeFileSync(emlFile, raw.message);

  console.log(`Summary: ${subject}`);
  console.log(`Failed tests: ${failed.length}, failed API calls: ${reportable.length} (+${allCalls.length - reportable.length} expected 4xx)`);
  console.log(`Allure attachment: ${allureInfo.file ? `${path.relative(ROOT, allureInfo.file)} (${allureInfo.mb.toFixed(1)} MB)` : allureInfo.note}`);
  console.log(`Email saved: ${path.relative(ROOT, emlFile)} (${(raw.message.length / 1024 / 1024).toFixed(1)} MB), preview: reports/test-summary.html`);

  if (!env('SMTP_HOST') || !env('MAIL_TO')) {
    console.log('SMTP_HOST / MAIL_TO not set in .env - the email was saved but NOT sent.');
    return;
  }
  const transport = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port: Number(env('SMTP_PORT', '587')),
    secure: env('SMTP_SECURE', 'false') === 'true',
    auth: env('SMTP_USER') ? { user: env('SMTP_USER'), pass: env('SMTP_PASS') } : undefined,
  });
  const info = await transport.sendMail(message);
  console.log(`Email sent to ${message.to}${message.cc ? ` (cc ${message.cc})` : ''}: ${info.messageId}`);
}

main().catch(error => {
  console.error(`send-report-mail failed: ${error.message}`);
  process.exit(1);
});
