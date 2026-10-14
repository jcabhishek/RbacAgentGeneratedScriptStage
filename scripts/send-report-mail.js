// Builds and sends the test-run summary email.
//
//   node scripts/send-report-mail.js      (npm run mail:report)
//
// Reads the results of the last run and sends:
//   - counts (total / passed / failed / flaky / skipped), duration, environment
//   - each failed test with its error and failure screenshot (inline)
//   - API server errors (HTTP 5xx; 4xx and no-response calls are ignored) with URL, payload and response
//   - attachments: failure screenshots, failed-api-calls.xlsx, a light single-file Allure report
//
// Sources: reports/results.json (Playwright JSON reporter), each test's trace.zip (network log)
// and allure-results/. Sent through SendGrid (SENDGRID_API_KEY) or SMTP (SMTP_HOST) from .env; without either it is only saved to
// reports/test-summary.eml (and an HTML preview), nothing is sent.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const AdmZip = require('adm-zip');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const RESULTS_JSON = path.join(REPORTS, 'results.json');
const ALLURE_RESULTS = path.join(ROOT, 'allure-results');

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const env = (name, fallback = '') => (process.env[name] ?? '').trim() || fallback;

const MAX_ATTACHMENT_MB = Number(env('MAIL_MAX_ATTACHMENT_MB', '18'));
// All attachments together. SendGrid accepts 30 MB per email and attachments grow by a third when
// encoded, so 20 MB of files is the most that fits.
const MAX_TOTAL_MB = Number(env('MAIL_MAX_TOTAL_MB', '20'));
const MAX_SCREENSHOTS = Number(env('MAIL_MAX_SCREENSHOTS', '10'));
const CELL_LIMIT = 32000; // Excel cell limit is 32,767 characters
const BODY_SNIPPET = 600;
// Only server errors are reported: 4xx (400, 422, ...) are validation answers the negative tests
// expect, and calls without a response are mostly fire-and-forget audit logs cut off by navigation.
const MIN_API_STATUS = Number(env('MAIL_API_MIN_STATUS', '500')); // payload / response characters shown in the email body

// ---------- Redaction: never put passwords, keys or tokens in an email ----------

const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const SECRET_KEYS = /^(password|passwd|pwd|key|secret|clientSecret|apiKey|idToken|refreshToken|accessToken|access_token|refresh_token|id_token|token|oauthAccessToken)$/i;
const KNOWN_SECRETS = [process.env.RBAC_PASSWORD, process.env.SMTP_PASS, process.env.SENDGRID_API_KEY].filter(v => v && v.length >= 4);

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
        if (!(status >= MIN_API_STATUS)) continue;
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

// Every collected call is a server error (status >= MIN_API_STATUS), so all of them are reported.
const isReportable = () => true;

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
    c.testResult === 'passed' ? 'Server error (test still passed)' : 'Server error in a failing test',
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
    ['Content', `Every API call that returned HTTP ${MIN_API_STATUS} or higher during the run, taken from the Playwright traces. 4xx responses (400, 422, ...) and calls without a response are not included.`],
    ['Redaction', 'Passwords, keys and tokens (password, Key, secret, idToken, refreshToken, access tokens and any JWT) are replaced with ***REDACTED*** / <JWT redacted>.'],
  ].forEach(r => notes.addRow(r));
  notes.columns = [{ width: 14 }, { width: 120 }];
  await wb.xlsx.writeFile(file);
}

// ---------- 3. Light, single-file Allure report for the email ----------
// The full report (traces and ~1,200 PNG screenshots) is hundreds of MB. The email copy keeps the
// results, error texts, the traces of failed tests and the screenshots as compressed JPEGs:
//   - key screenshots (failed tests, popups, final screen of each test) at 1280 px,
//   - per-step screenshots ("step - ...") at 800 px.
// If the report is over MAIL_MAX_ATTACHMENT_MB it is rebuilt without the per-step screenshots of
// passing tests, then without the traces (those are still attached to the email when they fit).

async function buildMailAllure(withSteps = true, withTraces = true) {
  if (!fs.existsSync(ALLURE_RESULTS)) return { note: 'No allure-results found.' };
  const lightDir = path.join(REPORTS, 'allure-mail-results');
  const outDir = path.join(REPORTS, 'allure-mail-report');
  fs.rmSync(lightDir, { recursive: true, force: true });
  fs.mkdirSync(lightDir, { recursive: true });
  const isStep = a => /^step - /.test(a.name);
  const isTrace = a => a.name === 'trace' && /zip|playwright-trace/.test(a.type || '');
  const keepAttachment = (a, failedTest) => a.type === 'text/plain'
    || (a.type === 'image/png' && (withSteps || failedTest || !isStep(a)))
    || (isTrace(a) && withTraces && failedTest);
  let traces = 0;
  const done = new Map(); // source png -> jpg
  const images = [];
  let failedTest = false;
  const filter = node => {
    if (Array.isArray(node.attachments)) {
      node.attachments = node.attachments.filter(a => keepAttachment(a, failedTest) && fs.existsSync(path.join(ALLURE_RESULTS, a.source)));
      for (const a of node.attachments) {
        if (a.type !== 'image/png') {
          if (isTrace(a) && !done.has(a.source)) traces++;
          if (!done.has(a.source)) { fs.copyFileSync(path.join(ALLURE_RESULTS, a.source), path.join(lightDir, a.source)); done.set(a.source, a.source); }
          continue;
        }
        const jpg = a.source.replace(/\.png$/i, '.jpg');
        if (!done.has(a.source)) {
          done.set(a.source, jpg);
          images.push({ from: path.join(ALLURE_RESULTS, a.source), to: path.join(lightDir, jpg), small: isStep(a) && !failedTest });
        }
        a.source = jpg;
        a.type = 'image/jpeg';
      }
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
  for (const img of images) {
    await sharp(img.from)
      .resize({ width: img.small ? 800 : 1280, withoutEnlargement: true })
      .jpeg({ quality: img.small ? 45 : 60, mozjpeg: true })
      .toFile(img.to);
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
  const screenshots = images.length;
  if (mb > MAX_ATTACHMENT_MB) {
    if (withSteps) return buildMailAllure(false, withTraces);
    if (withTraces && traces) return buildMailAllure(false, false);
    return { note: `The Allure report is ${mb.toFixed(1)} MB (limit ${MAX_ATTACHMENT_MB} MB), so it is not attached. Find it at ${path.relative(ROOT, zipFile)}.` };
  }
  return { file: zipFile, mb, screenshots, withSteps, traces };
}

// ---------- 4. Email ----------

function buildHtml({ stats, tests, failed, flaky, reportable, allCalls, allureInfo, screenshots, traces = [] }) {
  const passed = stats.expected || 0;
  const failedCount = stats.unexpected || 0;
  const flakyCount = stats.flaky || 0;
  const skipped = stats.skipped || 0;
  const total = passed + failedCount + flakyCount + skipped;
  const serverErrors = reportable.length;
  const passRate = total ? Math.round(((passed + flakyCount) / total) * 1000) / 10 : 0;
  const duration = fmtDuration(stats.duration || 0);
  const started = new Date(stats.startTime || Date.now());
  const finished = new Date(started.getTime() + (stats.duration || 0));
  const IST = { timeZone: 'Asia/Kolkata' };
  const day = esc(started.toLocaleDateString('en-IN', { ...IST, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  const clock = d => esc(d.toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit' }));
  const stamp = d => `${esc(d.toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }))} IST`;
  const lastPart = name => name.split(' › ').pop();
  const moduleOf = name => name.split(' › ')[0];
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const num = n => Number(n || 0).toLocaleString('en-IN');
  // ".zip" is also an internet domain ending, so mail clients turn "allure-report.zip" into a web
  // link. An invisible zero-width non-joiner after each dot stops that.
  const fileName = name => esc(name).replace(/\./g, '.&zwnj;');

  // Inline styles and tables only: Outlook and Gmail drop most CSS (the <style> block only adds
  // the phone layout in clients that support it).
  const F = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const MONO = 'font-family:Consolas,Menlo,monospace;';
  const C = {
    ink: '#14213D', muted: '#667085', faint: '#98A2B3', line: '#EAECF0', soft: '#F2F4F7', panel: '#F9FAFB', link: '#175CD3',
    green: '#12B76A', greenInk: '#027A48', greenBg: '#ECFDF3', amber: '#F79009', amberInk: '#B54708', amberBg: '#FFFAEB',
    red: '#F04438', redInk: '#B42318', redBg: '#FEF3F2', orange: '#F7931E', orangeBg: '#FEF0C7', navy: '#13315C',
  };
  const T = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

  // Overall state: failures (red), passed with flaky tests or 5xx errors (amber), clean pass (green).
  const state = failedCount
    ? { tag: 'FAIL', pill: '&#10007; FAILURES DETECTED', ink: C.redInk, bg: C.redBg, big: C.red,
      line: 'Build has <b>failures</b> — needs attention.',
      sub: `${failedCount} of ${total} failed${flakyCount ? ` · ${flakyCount} flaky` : ''} · ${serverErrors ? `${serverErrors} API server error(s)` : 'no API server errors'}` }
    : flakyCount || serverErrors
      ? { tag: 'WARN', pill: '&#9888; PASSED WITH OBSERVATIONS', ink: C.amberInk, bg: C.amberBg, big: C.amber,
        line: 'Build <b>passed</b> with observations — please review.',
        sub: `${passed + flakyCount} of ${total} passed${flakyCount ? ` · ${flakyCount} only on retry` : ' · no retries'} · ${serverErrors ? `${serverErrors} API server error(s)` : 'no API server errors'}` }
      : { tag: 'PASS', pill: '&#10003; ALL TESTS PASSED', ink: C.greenInk, bg: C.greenBg, big: C.green,
        line: 'Build is <b>healthy</b> — safe to proceed.',
        sub: `${passed} of ${total} passed · no retries · no API server errors` };

  // ---------- building blocks ----------
  const bar = (pct, color, track, h = 6, r = 6) => `<table ${T} width="100%" bgcolor="${track}" style="border-radius:${r}px;"><tr>`
    + `<td width="${Math.max(Math.min(pct, 100), 1).toFixed(0)}%" height="${h}" bgcolor="${color}" style="font-size:0;line-height:0;border-radius:${r}px;">&nbsp;</td>`
    + `${pct < 99.5 ? `<td height="${h}" bgcolor="${track}" style="font-size:0;line-height:0;">&nbsp;</td>` : ''}</tr></table>`;
  const card = (title, note, inner) => `<tr><td class="px" style="padding:0 24px 16px;"><table ${T} width="100%" bgcolor="#FFFFFF" style="border:1px solid ${C.line};border-radius:12px;">
<tr><td style="padding:16px 20px 12px;${F}font-size:14px;font-weight:700;color:${C.ink};">${title}${note ? `<span style="font-weight:400;color:${C.faint};font-size:12px;">&nbsp;·&nbsp;${note}</span>` : ''}</td></tr>
<tr><td style="padding:0 20px 16px;">${inner}</td></tr></table></td></tr>`;
  const dot = (ok, warn) => {
    const bg = ok ? C.green : warn ? C.amber : C.red;
    const ch = ok ? '&#10003;' : warn ? '!' : '&#10007;';
    return `<span style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:9px;background:${bg};color:#fff;font-size:11px;font-weight:700;text-align:center;${F}">${ch}</span>`;
  };
  const kpi = (label, value, color = C.ink) => `<td class="k" width="16.6%" style="padding:0 6px;"><table ${T} width="100%" bgcolor="${C.panel}" style="border:1px solid ${C.line};border-radius:10px;"><tr><td align="center" style="padding:12px 4px;${F}">`
    + `<div style="font-size:22px;line-height:26px;font-weight:700;color:${color};">${value}</div><div style="font-size:10px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:.8px;padding-top:2px;">${label}</div></td></tr></table></td>`;

  // ---------- modules ----------
  const modules = new Map();
  for (const t of tests) {
    const m = moduleOf(t.name);
    const r = modules.get(m) || { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, ms: 0 };
    r.total++;
    r.ms += t.duration || 0;
    r[{ expected: 'passed', unexpected: 'failed', flaky: 'flaky' }[t.outcome] || 'skipped']++;
    modules.set(m, r);
  }
  const split = m => { const x = m.match(/^(\d+)\.\s*(.*)$/); return x ? [x[1], x[2]] : ['', m]; };
  const rateColor = r => (r.failed ? [C.red, C.redInk] : r.flaky ? [C.amber, C.amberInk] : [C.green, C.greenInk]);
  const th = (label, extra = '') => `<td ${extra} style="${F}font-size:11px;color:${C.faint};text-transform:uppercase;letter-spacing:.6px;padding:0 0 8px;">${label}</td>`;
  const top = `border-top:1px solid ${C.line};`;
  const moduleRows = [...modules].map(([m, r]) => {
    const [n, label] = split(m);
    const ok = r.total ? ((r.passed + r.flaky) / r.total) * 100 : 0;
    const [col, ink] = rateColor(r);
    return `<tr><td style="${top}padding:10px 8px 10px 0;${F}font-size:13px;color:${C.ink};">${n ? `<span style="display:inline-block;width:20px;height:20px;line-height:20px;border-radius:6px;background:${C.soft};color:${C.muted};font-size:11px;font-weight:700;text-align:center;">${n}</span>&nbsp; ` : ''}${esc(label)}</td>
<td class="hs" width="150" style="${top}padding:10px 8px;"><table ${T} width="100%"><tr><td width="100">${bar(ok, col, C.line)}</td><td align="right" style="${F}font-size:12px;font-weight:700;color:${ink};">${Math.round(ok)}%</td></tr></table></td>
<td align="right" style="${top}padding:10px 8px;${F}font-size:13px;color:${C.ink};white-space:nowrap;"><b style="color:${ink};">${r.passed + r.flaky}</b><span style="color:${C.faint};">/${r.total}</span>${r.failed ? ` <span style="color:${C.redInk};font-size:11px;font-weight:700;">${r.failed} failed</span>` : ''}</td>
<td align="right" style="${top}padding:10px 0 10px 8px;${F}font-size:12px;color:${C.muted};white-space:nowrap;">${fmtDuration(r.ms)}</td></tr>`;
  }).join('');
  const totalInk = failedCount ? C.redInk : flakyCount ? C.amberInk : C.greenInk;
  const top2 = `border-top:2px solid ${C.line};`;
  const moduleTotal = `<tr><td style="${top2}padding:10px 0;${F}font-size:13px;font-weight:700;color:${C.ink};">Total</td>`
    + `<td class="hs" align="right" style="${top2}padding:10px 8px;${F}font-size:12px;font-weight:700;color:${totalInk};">${passRate}%</td>`
    + `<td align="right" style="${top2}padding:10px 8px;${F}font-size:13px;font-weight:700;color:${totalInk};">${passed + flakyCount}<span style="color:${C.faint};">/${total}</span></td>`
    + `<td align="right" style="${top2}padding:10px 0;${F}font-size:12px;font-weight:700;color:${C.ink};white-space:nowrap;">${duration}</td></tr>`;

  // ---------- run health ----------
  const cleanup = tests.filter(t => /cleanup/i.test(moduleOf(t.name)));
  const cleaned = cleanup.length > 0 && cleanup.every(t => t.outcome !== 'unexpected');
  const checks = [
    ['All test cases passed', failedCount === 0, false, failedCount ? `${failedCount} of ${total} failed` : `${total - skipped} of ${total - skipped}`],
    ['No API server errors', serverErrors === 0, false, serverErrors ? `HTTP 5xx: ${serverErrors}` : 'HTTP 5xx: none'],
    ['Stable on first attempt', flakyCount === 0, true, flakyCount ? `${flakyCount} passed only on retry` : 'no retries needed'],
    ['Test data cleaned up', cleaned, true, cleanup.length ? (cleaned ? 'records deleted' : 'cleanup failed') : 'cleanup not run'],
  ];
  const checkCell = ([name, ok, warn, text]) => {
    const bg = ok ? C.greenBg : warn ? C.amberBg : C.redBg;
    const ink = ok ? C.greenInk : warn ? C.amberInk : C.redInk;
    return `<td class="full" width="50%" style="padding:4px;"><table ${T} width="100%" bgcolor="${bg}" style="border-radius:10px;"><tr><td width="30" style="padding:12px 0 12px 12px;" valign="top">${dot(ok, warn)}</td>`
      + `<td style="padding:12px;${F}"><div style="font-size:13px;font-weight:600;color:${C.ink};">${name}</div><div style="font-size:12px;color:${ink};padding-top:2px;">${esc(text)}</div></td></tr></table></td>`;
  };
  const passedChecks = checks.filter(c => c[1]).length;
  const health = `<table ${T} width="100%"><tr>${checkCell(checks[0])}${checkCell(checks[1])}</tr><tr>${checkCell(checks[2])}${checkCell(checks[3])}</tr></table>`;

  // ---------- failures, flaky tests and server errors ----------
  const summaryRow = (ok, warn, title, text, count) => `<tr><td width="30" valign="top" style="padding:12px 0;${top}">${dot(ok, warn)}</td>`
    + `<td style="padding:12px 8px;${top}${F}"><div style="font-size:13px;font-weight:600;color:${C.ink};">${title}</div><div style="font-size:12px;color:${C.muted};padding-top:2px;line-height:18px;">${text}</div></td>`
    + `<td align="right" valign="top" style="padding:12px 0;${top}${F}font-size:13px;font-weight:700;color:${ok ? C.greenInk : warn ? C.amberInk : C.redInk};white-space:nowrap;">${count}</td></tr>`;
  const failureBlocks = failed.map((t, i) => {
    const shot = screenshots.find(s => s.testName === t.name);
    const trace = traces.find(x => x.testName === t.name);
    const traceText = !trace || trace.state === 'missing' ? ''
      : trace.state === 'attached' ? `attached to this email as <b>${fileName(trace.filename)}</b>`
        : allureInfo.traces ? `too large for the email (${trace.mb.toFixed(1)} MB); included in <b>${fileName('allure-report.zip')}</b>`
          : `too large for the email (${trace.mb.toFixed(1)} MB); on the test machine at ${esc(path.relative(ROOT, trace.path))}`;
    return `<tr><td colspan="3" style="padding:0 0 12px;"><table ${T} width="100%" bgcolor="#FFFFFF" style="border:1px solid ${C.line};border-left:4px solid ${C.red};border-radius:8px;">
<tr><td style="padding:12px 14px 6px;${F}"><div style="font-size:11px;font-weight:700;color:${C.redInk};letter-spacing:.6px;text-transform:uppercase;">Failure ${i + 1} · ${esc(moduleOf(t.name))}</div>
<div style="font-size:14px;font-weight:700;color:${C.ink};padding-top:3px;">${esc(lastPart(t.name))}</div></td></tr>
<tr><td style="padding:6px 14px 12px;"><pre style="white-space:pre-wrap;word-break:break-word;margin:0;padding:10px 12px;background:${C.redBg};border-radius:6px;${MONO}font-size:12px;line-height:17px;color:#7A271A;">${esc(clip(t.error.split('\n').slice(0, 8).join('\n'), 900))}</pre>
${shot ? `<div style="${F}font-size:11px;font-weight:700;color:${C.muted};padding:10px 0 4px;text-transform:uppercase;letter-spacing:.6px;">Screenshot at failure</div><img src="cid:${shot.cid}" alt="Screenshot at failure" width="580" style="display:block;width:100%;max-width:580px;height:auto;border:1px solid ${C.line};border-radius:6px;">` : ''}
${traceText ? `<div style="${F}font-size:12px;color:${C.muted};padding-top:10px;">&#127902; <b style="color:${C.ink};">Trace:</b> ${traceText}</div>` : ''}</td></tr></table></td></tr>`;
  }).join('');
  const flakyBlock = flaky.length ? `<tr><td colspan="3" style="padding:0 0 12px;"><table ${T} width="100%" bgcolor="${C.amberBg}" style="border-radius:8px;">${flaky.map(t => `<tr><td style="padding:8px 12px;${F}font-size:12px;color:${C.ink};"><b style="color:${C.amberInk};">&#8635;</b>&nbsp; ${esc(lastPart(t.name))} <span style="color:${C.faint};">· ${esc(moduleOf(t.name))}</span></td></tr>`).join('')}</table></td></tr>` : '';
  const pre = s => `<pre style="white-space:pre-wrap;word-break:break-all;margin:0;padding:8px 10px;background:${C.panel};border:1px solid ${C.line};border-radius:6px;${MONO}font-size:11px;line-height:16px;color:${C.ink};">${esc(clip(s, BODY_SNIPPET)) || '-'}</pre>`;
  const apiBlocks = reportable.map((c, i) => `<tr><td colspan="3" style="padding:0 0 12px;"><table ${T} width="100%" bgcolor="#FFFFFF" style="border:1px solid ${C.line};border-left:4px solid ${C.red};border-radius:8px;"><tr><td style="padding:12px 14px;${F}">
<div><span style="display:inline-block;background:${C.redBg};color:${C.redInk};font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;">${esc(c.status)} ${esc(c.statusText)}</span>&nbsp; <b style="font-size:12px;color:${C.ink};">${esc(c.method)}</b> <span style="font-size:11px;color:${C.faint};">#${i + 1} · ${esc(lastPart(c.test))}</span></div>
<div style="${MONO}font-size:12px;color:${C.ink};word-break:break-all;padding:6px 0 8px;">${esc(c.url)}</div>
<div style="font-size:11px;font-weight:700;color:${C.muted};padding-bottom:3px;">PAYLOAD</div>${pre(c.payload)}
<div style="font-size:11px;font-weight:700;color:${C.muted};padding:8px 0 3px;">RESPONSE</div>${pre(c.response)}</td></tr></table></td></tr>`).join('');
  const note4xx = '4xx responses (400, 422) are expected from negative tests and are not reported.';
  const issues = `<table ${T} width="100%">
${summaryRow(failedCount === 0, false, 'Failed test cases', failedCount ? 'Error and screenshot of each failure below.' : 'No failed test cases in this run.', failedCount)}${failureBlocks}
${flakyCount ? summaryRow(false, true, 'Flaky test cases', 'Failed on the first attempt and passed on retry.', flakyCount) + flakyBlock : ''}
${summaryRow(serverErrors === 0, false, 'API server errors (HTTP 5xx)', serverErrors ? `Request URL, payload and response below. ${note4xx}` : note4xx, serverErrors)}${apiBlocks}</table>`;

  // ---------- slowest tests ----------
  const slowest = [...tests].sort((a, b) => b.duration - a.duration).slice(0, 5);
  const maxMs = slowest[0]?.duration || 1;
  const slowRows = slowest.map(t => `<tr><td style="padding:8px 0 4px;${F}font-size:13px;color:${C.ink};">${esc(lastPart(t.name))} <span style="color:${C.faint};font-size:12px;">· ${esc(split(moduleOf(t.name))[1])}</span></td>`
    + `<td align="right" style="padding:8px 0 4px;${F}font-size:13px;font-weight:700;color:${C.ink};white-space:nowrap;">${(t.duration / 1000).toFixed(1)}s</td></tr>`
    + `<tr><td colspan="2" style="padding:0 0 6px;">${bar((t.duration / maxMs) * 100, C.orange, C.orangeBg)}</td></tr>`).join('');
  const busiest = [...modules].sort((a, b) => b[1].ms - a[1].ms)[0];
  const sumMs = tests.reduce((s, t) => s + (t.duration || 0), 0) || 1;
  const inBusiest = busiest ? slowest.filter(t => moduleOf(t.name) === busiest[0]).length : 0;
  const insight = busiest ? `<table ${T} width="100%" style="margin-top:10px;"><tr><td bgcolor="${C.panel}" style="padding:10px 12px;border-radius:8px;${F}font-size:12px;color:${C.muted};line-height:18px;">&#128161; <b style="color:${C.ink};">Insight:</b> the ${esc(split(busiest[0])[1])} module takes ${fmtDuration(busiest[1].ms)} — <b style="color:${C.ink};">${Math.round((busiest[1].ms / sumMs) * 100)}% of run time</b>${inBusiest ? ` — and holds ${inBusiest === slowest.length ? `all ${slowest.length}` : `${inBusiest} of the ${slowest.length}`} slowest tests` : ''}.</td></tr></table>` : '';

  // ---------- test case details ----------
  const ICON = {
    expected: `<span style="color:${C.green};font-weight:700;">&#10003;</span>`,
    unexpected: `<span style="color:${C.red};font-weight:700;">&#10007;</span>`,
    flaky: `<span style="color:${C.amber};font-weight:700;">&#8635;</span>`,
    skipped: `<span style="color:${C.faint};font-weight:700;">&#8211;</span>`,
  };
  const TAG = {
    unexpected: ` <span style="color:${C.redInk};font-size:11px;font-weight:700;">FAILED</span>`,
    flaky: ` <span style="color:${C.amberInk};font-size:11px;font-weight:700;">FLAKY</span>`,
    skipped: ` <span style="color:${C.faint};font-size:11px;font-weight:700;">SKIPPED</span>`,
  };
  const soft = `border-top:1px solid ${C.soft};`;
  let caseNo = 0;
  const caseRows = [...modules].map(([m, r]) => `<tr><td colspan="3" style="padding:14px 0 6px;${F}font-size:12px;font-weight:700;color:${C.navy};text-transform:uppercase;letter-spacing:.6px;">${esc(m)} <span style="color:${C.faint};font-weight:400;text-transform:none;letter-spacing:0;">&nbsp;${plural(r.total, 'test')} · ${fmtDuration(r.ms)}</span></td></tr>`
    + tests.filter(t => moduleOf(t.name) === m).map(t => `<tr><td width="30" style="padding:6px 0;${soft}${F}font-size:11px;color:${C.faint};">${++caseNo}</td>`
      + `<td style="padding:6px 8px 6px 0;${soft}${F}font-size:12px;color:${C.ink};line-height:17px;">${ICON[t.outcome] || ICON.skipped}&nbsp; ${esc(lastPart(t.name))}${TAG[t.outcome] || ''}</td>`
      + `<td align="right" style="padding:6px 0;${soft}${F}font-size:12px;color:${C.muted};white-space:nowrap;">${(t.duration / 1000).toFixed(1)}s</td></tr>`).join('')).join('');
  const caseNote = [`${passed} passed`, failedCount && `${failedCount} failed`, flakyCount && `${flakyCount} flaky`, skipped && `${skipped} skipped`].filter(Boolean).join(' · ');

  // ---------- run details and attachments ----------
  const base = env('RBAC_BASE_URL');
  const detail = (k, v) => `<tr><td width="120" style="padding:8px 0;${top}${F}font-size:12px;color:${C.muted};">${k}</td><td style="padding:8px 0;${top}${F}font-size:13px;color:${C.ink};">${v}</td></tr>`;
  const runDetails = `<table ${T} width="100%">
${detail('Application', base ? `<a href="${esc(base)}" style="color:${C.link};text-decoration:none;">${esc(base.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : '-')}
${detail('Environment', 'Staging')}${detail('Started', stamp(started))}${detail('Finished', stamp(finished))}${detail('Duration', duration)}
${detail('Framework', 'Playwright + playwright-bdd (Gherkin)')}${detail('Browser', 'Chromium · 1 worker · 1 retry on failure')}</table>`;
  const attachment = (icon, name, size, text) => `<table ${T} width="100%" bgcolor="${C.panel}" style="border:1px dashed #D0D5DD;border-radius:10px;margin-bottom:8px;"><tr>
<td width="52" align="center" valign="top" style="padding:14px 0 14px 14px;"><table ${T}><tr><td width="40" height="40" align="center" bgcolor="#FFF6ED" style="border-radius:8px;font-size:18px;">${icon}</td></tr></table></td>
<td style="padding:14px;${F}"><div style="font-size:14px;font-weight:700;color:${C.ink};">${name}${size ? ` <span style="font-weight:400;color:${C.faint};font-size:12px;">&nbsp;${size}</span>` : ''}</div>${text}</td></tr></table>`;
  const attachmentList = [
    allureInfo.file ? attachment('&#128206;', fileName('allure-report.zip'), `${allureInfo.mb.toFixed(1)} MB`,
      `<div style="font-size:12px;color:${C.muted};line-height:18px;padding-top:3px;">Interactive Allure report with ${num(allureInfo.screenshots)} ${allureInfo.withSteps ? 'step screenshots' : 'key screenshots (per-step ones are in the full report)'}${allureInfo.traces ? ` and the trace${allureInfo.traces === 1 ? '' : 's'} of ${allureInfo.traces} failed test attempt${allureInfo.traces === 1 ? '' : 's'}` : ''}.</div>`
      + `<div style="font-size:12px;color:${C.muted};line-height:18px;padding-top:6px;"><b style="color:${C.ink};">How to open:</b> attachment bar &rarr; save &rarr; unzip &rarr; open <b>${fileName('allure-report.html')}</b> in a browser.</div>`)
      : attachment('&#9888;', 'Allure report not attached', '', `<div style="font-size:12px;color:${C.muted};line-height:18px;padding-top:3px;">${esc(allureInfo.note || '')}</div>`),
    ...traces.filter(t => t.state === 'attached').map(t => attachment('&#127902;', fileName(t.filename), `${t.mb.toFixed(1)} MB`,
      `<div style="font-size:12px;color:${C.muted};line-height:18px;padding-top:3px;">Playwright trace of <b style="color:${C.ink};">${esc(lastPart(t.testName))}</b>: every action, network call and DOM snapshot of the failed run.</div>`
      + `<div style="font-size:12px;color:${C.muted};line-height:18px;padding-top:6px;"><b style="color:${C.ink};">How to open:</b> save the file &rarr; go to <a href="https://trace.playwright.dev" style="color:${C.link};text-decoration:none;">trace.playwright.dev</a> &rarr; drop the file there (it stays on your computer).</div>`)),
    allCalls.length ? attachment('&#128202;', fileName('failed-api-calls.xlsx'), '',
      `<div style="font-size:12px;color:${C.muted};line-height:18px;padding-top:3px;">Every HTTP 5xx call with URL, request payload and full response (credentials redacted).</div>`) : '',
  ].filter(Boolean);

  const preheader = `${state.tag === 'PASS' ? `All ${total}/${total} passed` : state.tag === 'WARN' ? `${passed + flakyCount}/${total} passed with observations` : `${failedCount} of ${total} failed`} on Staging · ${failedCount} failed · ${flakyCount} flaky · ${serverErrors} API 5xx · ${duration}`;
  const greeting = failedCount
    ? `${failedCount} of ${total} test cases failed — the errors and screenshots are listed below.`
    : `All ${total} test cases passed${flakyCount ? ` (${flakyCount} only on retry)` : ''} and ${serverErrors ? `${serverErrors} API server error(s) were recorded` : 'no API server errors were recorded'}.`;
  const legend = [['Passed', passed, C.green], ['Flaky', flakyCount, C.amber], ['Failed', failedCount, C.red], ['Skipped', skipped, C.faint]]
    .map(([l, n, col]) => `<span style="color:${col};">&#9679;</span> ${l} ${n}`).join(' &nbsp;&nbsp;');
  const pct = n => (total ? (n / total) * 100 : 0);
  const segments = [[passed, C.green], [flakyCount, C.amber], [failedCount, C.red], [skipped, C.faint]]
    .filter(([n]) => n > 0).map(([n, col]) => `<td width="${Math.max(pct(n), 1).toFixed(1)}%" height="10" bgcolor="${col}" style="font-size:0;line-height:0;">&nbsp;</td>`).join('');
  const distribution = `<table ${T} width="100%" bgcolor="${C.line}" style="border-radius:10px;"><tr>${segments || '<td height="10" style="font-size:0;line-height:0;">&nbsp;</td>'}</tr></table>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>[${state.tag}] RBAC Dashboard · Daily Regression · Staging · ${passed + flakyCount}/${total}</title>
<!--[if mso]><style>*{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>a{color:${C.link};text-decoration:none}
@media only screen and (max-width:640px){.wrap{width:100% !important}.px{padding-left:12px !important;padding-right:12px !important}
.k{display:inline-block !important;width:33.33% !important;box-sizing:border-box;padding:0 3px 6px !important}.full{display:block !important;width:100% !important;box-sizing:border-box}.hs{display:none !important}.st{display:block !important;width:100% !important;text-align:left !important;padding-top:10px !important}}</style></head>
<body style="margin:0;padding:0;background:${C.soft};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table ${T} width="100%" bgcolor="${C.soft}"><tr><td align="center" style="padding:28px 8px;">
<table ${T} class="wrap" width="680" style="width:680px;max-width:680px;">

<tr><td class="px" style="padding:0 28px 18px;${F}font-size:14px;line-height:22px;color:${C.ink};">Hi Team,<br>Here are today's daily regression results for the <b>RBAC Dashboard (Staging)</b>. ${greeting}</td></tr>

<tr><td class="px" style="padding:0 24px;"><table ${T} width="100%" bgcolor="#0A1F3D" style="border-radius:16px 16px 0 0;background:#0A1F3D;background-image:linear-gradient(135deg,#0A1F3D 0%,#13315C 100%);">
<tr><td style="padding:22px 24px 0;${F}"><table ${T} width="100%"><tr>
<td style="${F}"><span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${C.orange};"></span>&nbsp;<span style="font-size:12px;font-weight:700;letter-spacing:2px;color:#FFFFFF;">SUN MOBILITY</span><span class="hs" style="font-size:12px;letter-spacing:2px;color:#8FA3BF;"> &nbsp;|&nbsp; QA AUTOMATION</span></td>
<td align="right" style="${F}"><span style="display:inline-block;background:rgba(247,147,30,.15);border:1px solid ${C.orange};color:${C.orange};font-size:11px;font-weight:700;letter-spacing:1px;padding:4px 10px;border-radius:20px;">&#9679; STAGING</span></td></tr></table></td></tr>
<tr><td style="padding:18px 24px 26px;${F}"><div style="font-size:13px;color:#8FA3BF;">Daily Regression Report</div>
<div style="font-size:26px;line-height:32px;font-weight:700;color:#FFFFFF;padding-top:2px;">RBAC Dashboard</div>
<div style="font-size:13px;color:#C3CFDF;padding-top:6px;">&#128197; ${day} &nbsp;·&nbsp; &#128339; ${clock(started)} IST &nbsp;·&nbsp; &#9201; ${duration}</div></td></tr>
</table></td></tr>

<tr><td class="px" style="padding:0 24px 16px;"><table ${T} width="100%" bgcolor="#FFFFFF" style="border:1px solid ${C.line};border-top:0;border-radius:0 0 16px 16px;">
<tr><td style="padding:22px 24px 6px;"><table ${T} width="100%"><tr>
<td class="full" valign="middle" style="${F}"><span style="display:inline-block;background:${state.bg};color:${state.ink};font-size:12px;font-weight:700;padding:5px 12px;border-radius:20px;">${state.pill}</span>
<div style="font-size:15px;line-height:22px;color:${C.ink};padding-top:10px;">${state.line}</div>
<div style="font-size:13px;color:${C.muted};padding-top:2px;">${esc(state.sub)}</div></td>
<td class="st" align="right" valign="middle" style="${F}"><div style="font-size:48px;line-height:48px;font-weight:800;color:${state.big};letter-spacing:-1px;">${passRate}<span style="font-size:24px;">%</span></div><div style="font-size:12px;color:${C.muted};padding-top:4px;">pass rate</div></td>
</tr></table></td></tr>
<tr><td style="padding:12px 24px 0;">${distribution}</td></tr>
<tr><td style="padding:8px 24px 0;${F}font-size:12px;color:${C.muted};">${legend}</td></tr>
<tr><td style="padding:18px 18px 20px;"><table ${T} width="100%"><tr>
${kpi('Total', total)}${kpi('Passed', passed, C.greenInk)}${kpi('Failed', failedCount, failedCount ? C.redInk : C.ink)}${kpi('Flaky', flakyCount, flakyCount ? C.amberInk : C.ink)}${kpi('API 5xx', serverErrors, serverErrors ? C.redInk : C.ink)}${kpi('Modules', modules.size)}
</tr></table></td></tr></table></td></tr>

${card('Run health', `${passedChecks} of ${checks.length} checks passed`, health)}
${card('Module coverage', plural(modules.size, 'module'), `<table ${T} width="100%"><tr>${th('Module')}${th('Pass rate', 'class="hs"')}${th('Passed', 'align="right"')}${th('Time', 'align="right"')}</tr>${moduleRows}${moduleTotal}</table>`)}
${card('Failures &amp; server errors', '', issues)}
${card('Slowest test cases', `top ${slowest.length}`, `<table ${T} width="100%">${slowRows}</table>${insight}`)}
${card('Test case details', caseNote, `<table ${T} width="100%">${caseRows}</table>`)}
${card('Run details', '', runDetails)}
${card(attachmentList.length > 1 ? 'Attachments' : 'Attachment', '', attachmentList.join(''))}
<tr><td class="px" style="padding:6px 28px 20px;${F}font-size:14px;line-height:22px;color:${C.ink};">Regards,<br><b>QA Automation Team</b><br><span style="color:${C.muted};">SUN Mobility</span></td></tr>
<tr><td class="px" align="center" style="padding:0 28px 8px;${F}font-size:11px;line-height:17px;color:${C.faint};">This report is sent automatically after every daily regression run.<br>For queries, please reach out to the QA team.</td></tr>
</table></td></tr></table></body></html>`;
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
  const allureInfo = await buildMailAllure();
  if (allureInfo.file) attachments.push({ filename: 'allure-report.zip', path: allureInfo.file });

  // The Playwright trace of each failed test (its last attempt) as a file of its own, while all
  // attachments stay within MAIL_MAX_TOTAL_MB.
  const sizeMb = file => fs.statSync(file).size / 1024 / 1024;
  let totalMb = attachments.reduce((n, a) => n + sizeMb(a.path), 0);
  const traces = failed.map((t, i) => {
    const trace = t.attachments.find(a => a.name === 'trace' && a.path && fs.existsSync(a.path));
    if (!trace) return { testName: t.name, state: 'missing' };
    const filename = `trace-${String(i + 1).padStart(2, '0')}-${t.name.split(' › ').pop().replace(/[^\w-]+/g, '_').slice(0, 50)}.zip`;
    const mb = sizeMb(trace.path);
    if (totalMb + mb > MAX_TOTAL_MB) return { testName: t.name, filename, mb, state: 'too big', path: trace.path };
    totalMb += mb;
    attachments.push({ filename, path: trace.path });
    return { testName: t.name, filename, mb, state: 'attached' };
  });

  const subject = `Daily Regression Report | RBAC Dashboard | ${new Date(stats.startTime || Date.now()).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`;
  const html = buildHtml({ stats, tests, failed, flaky, reportable, allCalls, allureInfo, screenshots, traces });
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
  console.log(`Failed tests: ${failed.length}, API server errors (5xx): ${reportable.length}`);
  console.log(`Allure attachment: ${allureInfo.file ? `${path.relative(ROOT, allureInfo.file)} (${allureInfo.mb.toFixed(1)} MB, ${allureInfo.screenshots} screenshots${allureInfo.withSteps ? '' : ', without per-step screenshots'}, ${allureInfo.traces} trace(s))` : allureInfo.note}`);
  if (traces.length) console.log(`Traces of failed tests: ${traces.map(t => `${t.filename || t.testName} (${t.state}${t.mb ? `, ${t.mb.toFixed(1)} MB` : ''})`).join('; ')}`);
  console.log(`Email saved: ${path.relative(ROOT, emlFile)} (${(raw.message.length / 1024 / 1024).toFixed(1)} MB), preview: reports/test-summary.html`);

  if (!env('MAIL_TO')) {
    console.log('MAIL_TO not set in .env - the email was saved but NOT sent.');
    return;
  }
  if (env('SENDGRID_API_KEY')) {
    await sendWithSendGrid(message);
    return;
  }
  if (!env('SMTP_HOST')) {
    console.log('Neither SENDGRID_API_KEY nor SMTP_HOST is set in .env - the email was saved but NOT sent.');
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

// SendGrid Web API v3 (https://api.sendgrid.com/v3/mail/send): accepted with HTTP 202.
// MAIL_TO / MAIL_CC are comma-separated lists. Screenshots stay inline (content_id = the cid used
// in the HTML body); SendGrid allows at most 30 MB per message including attachments.
async function sendWithSendGrid(message) {
  const list = value => (value || '').split(/[,;]/).map(s => s.trim()).filter(Boolean).map(email => ({ email }));
  const to = list(message.to);
  const cc = list(message.cc).filter(c => !to.some(t => t.email.toLowerCase() === c.email.toLowerCase()));
  const body = {
    personalizations: [{ to, ...(cc.length ? { cc } : {}) }],
    from: { email: message.from },
    subject: message.subject,
    content: [{ type: 'text/html', value: message.html }],
    attachments: message.attachments.map(a => ({
      content: fs.readFileSync(a.path).toString('base64'),
      filename: a.filename,
      type: a.filename.endsWith('.png') ? 'image/png'
        : a.filename.endsWith('.zip') ? 'application/zip'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ...(a.cid ? { disposition: 'inline', content_id: a.cid } : { disposition: 'attachment' }),
    })),
  };
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('SENDGRID_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status !== 202) {
    throw new Error(`SendGrid returned HTTP ${response.status}: ${redact(await response.text())}`);
  }
  console.log(`Email sent via SendGrid to ${to.map(t => t.email).join(', ')}${cc.length ? ` (cc ${cc.map(c => c.email).join(', ')})` : ''} (HTTP 202)`);
}

main().catch(error => {
  console.error(`send-report-mail failed: ${error.message}`);
  process.exit(1);
});
