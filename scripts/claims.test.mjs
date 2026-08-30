import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, stat, symlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import test, { after } from 'node:test';
import { chromium } from 'playwright';

const requested = process.argv.includes('--grep') ? process.argv[process.argv.indexOf('--grep') + 1] : '';
const adminToken = 'claim-test-administrator';
const workDir = await mkdtemp(join(tmpdir(), 'ledger-claims-'));
let billingVerificationCount = 0;

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

const billingServer = createServer((request, response) => {
  const url = new URL(request.url, 'http://fixture.test');
  if (url.pathname === '/verify') billingVerificationCount += 1;
  const valid = url.pathname === '/verify' && url.searchParams.get('license') === 'recorded-valid-license';
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ valid, reason: valid ? 'ok' : 'invalid', expires_at: null }));
});
await new Promise((resolve) => billingServer.listen(0, '127.0.0.1', resolve));
const billingPort = billingServer.address().port;
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(join(process.cwd(), 'target/debug/internal-event-ledger'), [], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    DATABASE_URL: `sqlite://${join(workDir, 'claims.db')}?mode=rwc`,
    STATIC_DIR: join(process.cwd(), 'dist'),
    ADMIN_TOKEN: adminToken,
    BILLING_API_BASE: `http://127.0.0.1:${billingPort}`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });
for (let attempt = 0; attempt < 100; attempt += 1) {
  if (server.exitCode !== null) throw new Error(`claim server exited early\n${serverOutput}`);
  try {
    if ((await fetch(`${base}/health`)).ok) break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (attempt === 99) throw new Error(`claim server did not start\n${serverOutput}`);
}

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

  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(join(workDir, 'claims.db'));
  database.prepare('UPDATE demo_workspaces SET created_at_unix = ? WHERE workspace_id = ?')
    .run(Math.floor(Date.now() / 1000) - 86_400, workspace.workspace_id);
  database.close();

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
    assert.equal((await readFile(join(runtimeDir, '.internal-event-ledger-admin-token'), 'utf8')).trim().length, 64);
    assert.equal((await stat(join(runtimeDir, '.internal-event-ledger-admin-token'))).mode & 0o777, 0o600);
    await access(join(runtimeDir, 'ledger.db'));
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
  for (const path of ['/api/sources', '/api/events', '/api/digest', '/api/export?format=csv', '/api/settings', '/api/license']) {
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
  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(join(workDir, 'claims.db'));
  database.exec("PRAGMA busy_timeout=5000; UPDATE events SET last_seen_at='2020-01-01T00:00:00Z' WHERE summary='Expired fixture event'");
  database.close();
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

claim('plan-limits', async () => {
  const existing = await fetch(`${base}/api/sources`, { headers: auth }).then((response) => response.json());
  for (const source of existing.sources) await fetch(`${base}/api/sources/${source.id}`, { method: 'DELETE', headers: auth });
  const tooLong = await createSource('too-long-free', { retention_days: 31 });
  assert.equal(tooLong.response.status, 403);
  const created = [];
  for (let index = 0; index < 5; index += 1) {
    const source = await createSource(`free-source-${index}`);
    assert.equal(source.response.status, 201);
    created.push(source.body.id);
  }
  assert.equal((await createSource('sixth-free-source')).response.status, 403);
  const license = await fetch(`${base}/api/license`, { method: 'PUT', headers: auth, body: JSON.stringify({ license: 'recorded-valid-license' }) });
  assert.equal(license.status, 200);
  const proSource = await createSource('pro-source-six', { retention_days: 3650 });
  assert.equal(proSource.response.status, 201);
  assert.equal((await fetch(`${base}/api/digest?hours=6`, { headers: auth })).status, 200);
  for (const id of [...created, proSource.body.id]) await fetch(`${base}/api/sources/${id}`, { method: 'DELETE', headers: auth });
  await fetch(`${base}/api/license`, { method: 'DELETE', headers: auth });
});

claim('license-verification-cache', async () => {
  await fetch(`${base}/api/license`, { method: 'DELETE', headers: auth });
  const before = billingVerificationCount;
  const applied = await fetch(`${base}/api/license`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ license: 'recorded-valid-license' }),
  });
  assert.equal(applied.status, 200);
  assert.equal(billingVerificationCount, before + 1);

  for (let index = 0; index < 5; index += 1) {
    const cached = await fetch(`${base}/api/license`, { headers: auth });
    assert.equal(cached.status, 200);
    assert.equal((await cached.json()).pro, true);
  }
  const reapplied = await fetch(`${base}/api/license`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ license: 'recorded-valid-license' }),
  });
  assert.equal(reapplied.status, 200);
  assert.equal(billingVerificationCount, before + 1, 'cached reads must not call verification again');

  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(join(workDir, 'claims.db'));
  const setCheckedAt = database.prepare("UPDATE settings SET value=? WHERE key='license_checked_at'");
  setCheckedAt.run(String(Math.floor(Date.now() / 1000) - 86_399));
  assert.equal((await fetch(`${base}/api/license`, { headers: auth })).status, 200);
  assert.equal(billingVerificationCount, before + 1, 'a verdict younger than 24 hours stays cached');

  setCheckedAt.run(String(Math.floor(Date.now() / 1000) - 86_401));
  database.close();
  assert.equal((await fetch(`${base}/api/license`, { headers: auth })).status, 200);
  assert.equal(billingVerificationCount, before + 2, 'a verdict older than 24 hours is verified again');
  await fetch(`${base}/api/license`, { method: 'DELETE', headers: auth });
});

claim('checkout-availability', async () => {
  const catalog = await fetch('https://api.sociobot.in/api/v1/products');
  assert.equal(catalog.status, 200);
  const product = (await catalog.json()).data.find((item) => item.slug === 'internal-event-ledger');
  assert.deepEqual(
    product && { name: product.name, price_minor: product.price_minor, currency: product.currency },
    { name: 'Internal Event Ledger Pro', price_minor: 3900, currency: 'USD' },
  );
  const checkout = await fetch(product.checkout_url, { redirect: 'manual' });
  assert.equal(checkout.status, 303);
  assert.match(checkout.headers.get('location') || '', /^https:\/\/checkout\.dodopayments\.com\//);
});

claim('api-rate-limit', async () => {
  const replicaPort = await freePort();
  const replica = spawn(join(process.cwd(), 'target/debug/internal-event-ledger'), [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(replicaPort),
      DATABASE_URL: `sqlite://${join(workDir, 'claims.db')}?mode=rwc`,
      STATIC_DIR: join(process.cwd(), 'dist'),
      ADMIN_TOKEN: adminToken,
      BILLING_API_BASE: `http://127.0.0.1:${billingPort}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let replicaOutput = '';
  replica.stdout.on('data', (chunk) => { replicaOutput += chunk; });
  replica.stderr.on('data', (chunk) => { replicaOutput += chunk; });
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { if ((await fetch(`http://127.0.0.1:${replicaPort}/health`)).ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (attempt === 99) throw new Error(`second limiter replica did not start\n${replicaOutput}`);
    }
    const responses = await Promise.all(Array.from({ length: 120 }, (_, index) => {
      const origin = index % 2 ? base : `http://127.0.0.1:${replicaPort}`;
      return fetch(`${origin}/api/events`, { headers: { authorization: `Bearer ${adminToken}`, 'x-forwarded-for': '203.0.113.90' } });
    }));
    const allowed = responses.filter((response) => response.status === 200).length;
    const limited = responses.filter((response) => response.status === 429);
    assert.ok(allowed >= 58 && allowed <= 62, `shared 60-request burst allowed ${allowed}`);
    assert.ok(limited.length >= 58);
    assert.ok(limited.every((response) => response.headers.get('retry-after') === '1'));
  } finally {
    replica.kill('SIGTERM');
    if (replica.exitCode === null) await new Promise((resolve) => replica.once('exit', resolve));
  }
});

after(async () => {
  await browser.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => server.once('exit', resolve));
  await new Promise((resolve) => billingServer.close(resolve));
  await rm(workDir, { recursive: true, force: true });
});
