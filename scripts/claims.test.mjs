import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, stat, symlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import test, { after } from 'node:test';
import { chromium } from 'playwright';

const requested = process.argv.includes('--grep') ? process.argv[process.argv.indexOf('--grep') + 1] : '';
const adminToken = 'claim-test-administrator';
const workDir = await mkdtemp(join(tmpdir(), 'ledger-claims-'));

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
let serverOutput = '';
function startServer() {
  const child = spawn(join(process.cwd(), 'target/debug/internal-event-ledger'), [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: `sqlite://${join(workDir, 'claims.db')}?mode=rwc`,
      STATIC_DIR: join(process.cwd(), 'dist'),
      ADMIN_TOKEN: adminToken,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { serverOutput += chunk; });
  child.stderr.on('data', (chunk) => { serverOutput += chunk; });
  return child;
}

let server = startServer();
async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`claim server exited early\n${serverOutput}`);
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`claim server did not start\n${serverOutput}`);
}
async function restartServer(updateDatabase) {
  server.kill('SIGTERM');
  if (server.exitCode === null) await new Promise((resolve) => server.once('exit', resolve));
  updateDatabase();
  server = startServer();
  await waitForServer();
}
await waitForServer();

const executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const auth = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };

function claim(id, run) {
  const name = `@claim:${id}`;
  test(name, { skip: Boolean(requested) && requested !== name }, run);
}

async function createSource(alias, extra = {}) {
  const response = await fetch(`${base}/api/sources`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: alias, alias, retention_days: 30, ...extra }),
  });
  return { response, body: await response.json().catch(() => ({})) };
}

claim('demo-sandbox', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('h1').textContent(), 'Review operational events without Slack noise');
  assert.equal(await page.getByRole('button', { name: 'Try it with sample data' }).count(), 1);
  await page.getByRole('button', { name: 'Try it with sample data' }).click();
  await page.locator('.event-summary', { hasText: 'Refund review requested for annual plan' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/demo');
  assert.match(await page.locator('.demo-banner strong').textContent(), /^Demo — sample data, nothing is saved/);
  assert.equal(await page.locator('article.event-row').count(), 5);
  assert.equal(await page.getByLabel('Administrator token').count(), 0);
  const firstWorkspace = await page.locator('.demo-banner > span').textContent();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.waitForFunction((previous) => document.querySelector('.demo-banner > span')?.textContent !== previous, firstWorkspace);
  await page.getByLabel('Search the ledger').fill('catalogue');
  await page.waitForTimeout(350);
  assert.equal(await page.locator('article.event-row').count(), 2);
  await context.close();
});

claim('demo-expiry', async () => {
  const created = await fetch(`${base}/api/demo`, {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.72' },
  });
  assert.equal(created.status, 200);
  const workspace = await created.json();
  assert.equal(workspace.expires_in_seconds, 86_400);

  await restartServer(() => {
    const database = new DatabaseSync(join(workDir, 'claims.db'));
    database.prepare('UPDATE demo_workspaces SET created_at_unix = ? WHERE workspace_id = ?')
      .run(Math.floor(Date.now() / 1000) - 86_400, workspace.workspace_id);
    database.close();
  });

  const expired = await fetch(`${base}/api/demo/${workspace.workspace_id}`, {
    headers: { 'x-forwarded-for': '203.0.113.73' },
  });
  assert.equal(expired.status, 404);
  assert.match((await expired.json()).error, /demo expired/i);
});

claim('self-hosted-runtime', async () => {
  const runtimeDir = join(workDir, 'port-only-runtime');
  await mkdir(runtimeDir);
  await symlink(join(process.cwd(), 'dist'), join(runtimeDir, 'dist'));
  const runtimePort = await freePort();
  const runtime = spawn(join(process.cwd(), 'target/debug/internal-event-ledger'), [], {
    cwd: runtimeDir,
    env: { PATH: process.env.PATH, PORT: String(runtimePort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  runtime.stdout.on('data', (chunk) => { output += chunk; });
  runtime.stderr.on('data', (chunk) => { output += chunk; });
  try {
    let health;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { health = await fetch(`http://127.0.0.1:${runtimePort}/health`); if (health.ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(health?.ok, `PORT-only runtime did not start\n${output}`);
    assert.ok((await health.json()).build);
    const nativeData = join(runtimeDir, '.internal-event-ledger-data');
    assert.equal((await readFile(join(nativeData, 'admin-token'), 'utf8')).trim().length, 64);
    assert.equal((await stat(join(nativeData, 'admin-token'))).mode & 0o777, 0o600);
    await access(join(nativeData, 'ledger-v2.sqlite3'));
    assert.equal((await fetch(`http://127.0.0.1:${runtimePort}/`)).status, 200);
  } finally {
    runtime.kill('SIGTERM');
    if (runtime.exitCode === null) await new Promise((resolve) => runtime.once('exit', resolve));
  }
});

claim('review-workflow', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  await page.getByLabel('Search the ledger').fill('catalogue');
  await page.waitForTimeout(350);
  assert.equal(await page.locator('article.event-row').count(), 2);
  await page.getByLabel('Search the ledger').fill('');
  await page.waitForTimeout(350);
  const refund = page.locator('article.event-row').filter({ hasText: 'Refund review requested' });
  await refund.getByRole('button', { name: 'Acknowledge' }).click();
  await refund.getByText('acknowledged', { exact: true }).waitFor();
  const mapping = page.locator('article.event-row').filter({ hasText: 'Three product rows' });
  page.once('dialog', (dialog) => dialog.accept());
  await mapping.getByRole('button', { name: 'Archive event' }).click();
  await mapping.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Sources', exact: true }).click();
  await page.getByRole('heading', { name: 'Incoming sources' }).waitFor();
  await page.getByRole('button', { name: 'Digest' }).click();
  await page.getByRole('heading', { name: 'Daily digest' }).waitFor();
  await page.locator('.digest-number').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H1');
  assert.equal(await page.locator('.digest-number strong').textContent(), '11');
  await page.goBack();
  await page.getByRole('heading', { name: 'Incoming sources' }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H1');
  await context.close();
});

claim('administrator-boundary', async () => {
  const anonymousHeaders = { 'x-forwarded-for': '203.0.113.70' };
  for (const path of ['/api/sources', '/api/events', '/api/digest', '/api/export?format=csv', '/api/settings']) {
    assert.equal((await fetch(`${base}${path}`, { headers: anonymousHeaders })).status, 401);
  }
  assert.equal((await fetch(`${base}/api/events`, { headers: { authorization: `Bearer ${adminToken}`, 'x-forwarded-for': '203.0.113.71' } })).status, 200);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByLabel('Administrator token').fill(adminToken);
  await page.getByRole('button', { name: 'Open my ledger' }).click();
  await page.getByRole('heading', { name: 'Event ledger' }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('iel:admin-token')), adminToken);
  assert.equal(await page.evaluate(() => localStorage.getItem('iel:admin-token')), null);
  await context.close();
});

claim('retention-delete', async () => {
  const created = await createSource('expired-event-source', { retention_days: 1 });
  assert.equal(created.response.status, 201);
  assert.equal((await fetch(`${base}/ingest/expired-event-source`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ledger-token': created.body.token }, body: JSON.stringify({ type: 'old.event', summary: 'Expired fixture event' }) })).status, 202);
  await restartServer(() => {
    const database = new DatabaseSync(join(workDir, 'claims.db'));
    database.exec("UPDATE events SET last_seen_at='2020-01-01T00:00:00Z' WHERE summary='Expired fixture event'");
    database.close();
  });
  const retention = await fetch(`${base}/api/maintenance/retention`, { method: 'POST', headers: auth, body: '{}' });
  assert.equal(retention.status, 200);
  assert.equal((await retention.json()).deleted, 1);
  const events = await fetch(`${base}/api/events`, { headers: auth }).then((response) => response.json());
  assert.equal(events.events.some((event) => event.summary === 'Expired fixture event'), false);
  await fetch(`${base}/api/sources/${created.body.id}`, { method: 'DELETE', headers: auth });
});

claim('response-policy', async () => {
  const root = await fetch(base);
  assert.equal(root.status, 200);
  assert.equal(root.headers.get('cache-control'), 'no-cache');
  assert.match(root.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const html = await root.text();
  const script = html.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(script);
  const asset = await fetch(`${base}${script}`);
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal((await fetch(`${base}/sw.js`)).headers.get('cache-control'), 'no-cache');
});

claim('demo-isolation', async () => {
  const created = await createSource('private-production-source');
  assert.equal(created.response.status, 201);
  const context = await browser.newContext();
  const page = await context.newPage();
  const apiRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) apiRequests.push(`${request.method()} ${url.pathname}`);
  });
  await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  await page.locator('.event-summary', { hasText: 'Refund review requested for annual plan' }).waitFor();
  assert.equal(await page.getByText('private-production-source').count(), 0);
  await page.locator('article.event-row').filter({ hasText: 'Refund review requested' }).getByRole('button', { name: 'Acknowledge' }).click();
  await page.locator('article.event-row').filter({ hasText: 'Refund review requested' }).getByText('acknowledged', { exact: true }).waitFor();
  assert.deepEqual([...new Set(apiRequests)], ['POST /api/demo']);
  const productionEvents = await fetch(`${base}/api/events`, { headers: auth }).then((response) => response.json());
  assert.equal(productionEvents.events.length, 0);
  await fetch(`${base}/api/sources/${created.body.id}`, { method: 'DELETE', headers: auth });
  await context.close();
});

claim('ledger-export', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csv = await (await csvDownload).createReadStream();
  let csvText = '';
  for await (const chunk of csv) csvText += chunk;
  assert.equal(csvText.trim().split('\n').length, 6);
  assert.equal(csvText.split('\n')[0], 'id,source,type,summary,status,occurrences,first_seen,last_seen,fingerprint');
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const jsonStream = await (await jsonDownload).createReadStream();
  let jsonText = '';
  for await (const chunk of jsonStream) jsonText += chunk;
  assert.equal(JSON.parse(jsonText).length, 5);
  await context.close();
});

claim('privacy-no-tracking', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const origins = new Set();
  page.on('request', (request) => origins.add(new URL(request.url()).origin));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Try it with sample data' }).click();
  await page.locator('.event-summary', { hasText: 'Refund review requested for annual plan' }).waitFor();
  await page.getByRole('button', { name: 'Digest' }).click();
  await page.getByRole('heading', { name: 'Daily digest' }).waitFor();
  assert.deepEqual([...origins], [new URL(base).origin]);
  await context.close();
});

claim('offline-demo', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  await page.locator('.event-summary', { hasText: 'Refund review requested for annual plan' }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.event-summary', { hasText: 'Refund review requested for annual plan' }).waitFor();
  assert.equal(await page.locator('h1').textContent(), 'Event ledger');
  assert.equal(await page.locator('article.event-row').count(), 5);
  await context.close();
});

claim('ingest-safety', async () => {
  const created = await createSource('signed-redacted-source', { signing_secret: 'fixture-signing-secret', redact_headers: ['x-customer-email'], redact_paths: ['customer.email'] });
  assert.equal(created.response.status, 201);
  const body = JSON.stringify({ type: 'order.review', summary: 'Order needs review', customer: { email: 'secret@example.test' } });
  const signature = createHmac('sha256', 'fixture-signing-secret').update(body).digest('hex');
  for (let index = 0; index < 2; index += 1) {
    const response = await fetch(`${base}/ingest/signed-redacted-source`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ledger-token': created.body.token, 'x-ledger-signature': `sha256=${signature}`, 'x-customer-email': 'secret@example.test', 'x-event-fingerprint': 'same-order' },
      body,
    });
    assert.equal(response.status, 202);
  }
  const events = await fetch(`${base}/api/events`, { headers: auth }).then((response) => response.json());
  const event = events.events.find((item) => item.source_alias === 'signed-redacted-source');
  assert.equal(event.occurrence_count, 2);
  assert.match(event.payload_json, /\[REDACTED\]/);
  assert.doesNotMatch(event.payload_json, /secret@example\.test/);
  assert.doesNotMatch(event.headers_json, /x-ledger-token|x-ledger-signature/);
  assert.match(event.headers_json, /\[REDACTED\]/);
  await fetch(`${base}/api/sources/${created.body.id}`, { method: 'DELETE', headers: auth });
});

claim('self-hosted-controls', async () => {
  const existing = await fetch(`${base}/api/sources`, { headers: auth }).then((response) => response.json());
  for (const source of existing.sources) await fetch(`${base}/api/sources/${source.id}`, { method: 'DELETE', headers: auth });
  const created = [];
  for (let index = 0; index < 6; index += 1) {
    const source = await createSource(`local-source-${index}`, { retention_days: 3650 });
    assert.equal(source.response.status, 201);
    created.push(source.body.id);
  }
  assert.equal((await fetch(`${base}/api/digest?hours=6`, { headers: auth })).status, 200);
  for (const id of created) await fetch(`${base}/api/sources/${id}`, { method: 'DELETE', headers: auth });
});

claim('api-rate-limit', async () => {
  const burstStartedAt = performance.now();
  const responses = await Promise.all(Array.from({ length: 120 }, () =>
    fetch(`${base}/api/events`, { headers: { authorization: `Bearer ${adminToken}`, 'x-forwarded-for': '203.0.113.90' } }),
  ));
  const burstElapsedSeconds = (performance.now() - burstStartedAt) / 1000;
  const allowed = responses.filter((response) => response.status === 200).length;
  const limited = responses.filter((response) => response.status === 429);
  const maximumWithMeasuredRefill = 60 + Math.ceil(burstElapsedSeconds * 20) + 1;
  assert.ok(
    allowed >= 60 && allowed <= maximumWithMeasuredRefill,
    `one-connection 60-token burst allowed ${allowed} in ${burstElapsedSeconds.toFixed(3)}s (maximum ${maximumWithMeasuredRefill})`,
  );
  assert.ok(limited.length >= 120 - maximumWithMeasuredRefill);
  assert.ok(limited.every((response) => response.headers.get('retry-after') === '1'));
});

after(async () => {
  await browser.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => server.once('exit', resolve));
  await rm(workDir, { recursive: true, force: true });
});
