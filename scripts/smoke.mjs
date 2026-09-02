import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const suppliedBase = process.argv[2] || process.env.SMOKE_URL;
const adminToken = process.env.ADMIN_TOKEN || 'ledger-test-admin';
const executablePath = process.env.CHROMIUM_PATH;
const viewport = {
  width: Number(process.env.VIEWPORT_WIDTH || 390),
  height: Number(process.env.VIEWPORT_HEIGHT || 844),
};
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function runBuild(command, args) {
  const result = spawnSync(command, args, { cwd: process.cwd(), stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
}

async function stopProcess(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
}

async function startIsolatedServer() {
  runBuild('npm', ['run', 'build']);
  runBuild('cargo', ['build', '--locked']);
  const workDir = await mkdtemp(join(tmpdir(), 'ledger-smoke-'));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let output = '';
  const child = spawn(join(process.cwd(), 'target/debug/internal-event-ledger'), [], {
    cwd: process.cwd(),
    env: { PATH: process.env.PATH, PORT: String(port), DATABASE_URL: `sqlite://${join(workDir, 'smoke.db')}?mode=rwc`, STATIC_DIR: join(process.cwd(), 'dist'), ADMIN_TOKEN: adminToken },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`smoke server exited early\n${output}`);
      try {
        if ((await fetch(`${baseUrl}/health`)).ok) return { baseUrl, localServer: true, cleanup: async () => { await stopProcess(child); await rm(workDir, { recursive: true, force: true }); } };
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`smoke server did not become healthy\n${output}`);
  } catch (error) {
    await stopProcess(child);
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }
}

const server = suppliedBase ? { baseUrl: suppliedBase.replace(/\/$/, ''), localServer: false, cleanup: async () => {} } : await startIsolatedServer();
const base = server.baseUrl;
let browser;
let context;
let page;
const errors = [];
const badResponses = [];

try {
browser = await chromium.launch(executablePath ? { executablePath } : {});
context = await browser.newContext({ viewport });
page = await context.newPage();
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

await page.goto(base, { waitUntil: 'networkidle' });
await page.keyboard.press('Tab');
if (!await page.locator('.skip-link').evaluate((node) => node === document.activeElement)) {
  throw new Error('Skip link was not first in keyboard order');
}
await page.keyboard.press('Enter');
if (!await page.locator('#main').evaluate((node) => node === document.activeElement)) {
  throw new Error('Skip link did not move keyboard focus to main content');
}
await page.getByLabel('Administrator token').fill(adminToken);
await page.getByRole('button', { name: 'Open my ledger' }).click();
await page.getByRole('heading', { name: 'Event ledger' }).waitFor();
await page.getByRole('button', { name: 'Sources', exact: true }).focus();
await page.keyboard.press('Enter');
await page.getByRole('heading', { name: 'Incoming sources' }).waitFor();
if (new URL(page.url()).pathname !== '/sources') throw new Error(`Sources used a non-semantic route: ${page.url()}`);
const suffix = Date.now().toString().slice(-7);
await page.getByLabel('Source name').fill(`Smoke source ${suffix}`);
await page.getByLabel('Endpoint alias').fill(`smoke-${suffix}`);
await page.getByLabel('Redact body paths').fill('customer.email');
await page.getByRole('button', { name: 'Create endpoint' }).click();
await page.getByRole('heading', { name: 'Copy this token now' }).waitFor();
const token = (await page.locator('.credential > code').nth(1).textContent()).trim();

const response = await context.request.post(`${base}/ingest/smoke-${suffix}`, {
  headers: { 'x-ledger-token': token, 'content-type': 'application/json' },
  data: { type: 'smoke.completed', summary: 'End-to-end smoke event', customer: { email: 'must-redact@example.test' } },
});
if (response.status() !== 202) throw new Error(`Ingest returned ${response.status()}`);

await page.getByRole('button', { name: /^Inbox/ }).click();
await page.getByRole('button', { name: 'Refresh' }).click();
if (new URL(page.url()).pathname !== '/inbox') throw new Error(`Inbox used a non-semantic route: ${page.url()}`);
const eventRow = page.locator('article', { hasText: `Smoke source ${suffix}` });
await eventRow.getByText('End-to-end smoke event', { exact: true }).waitFor();
await eventRow.getByRole('button', { name: 'Acknowledge' }).click();
await eventRow.getByText('acknowledged', { exact: true }).waitFor();
await page.getByRole('button', { name: 'Digest' }).click();
await page.getByRole('heading', { name: 'Daily digest' }).waitFor();
if (new URL(page.url()).pathname !== '/digest') throw new Error(`Digest used a non-semantic route: ${page.url()}`);
await page.goto(`${base}/privacy`, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'Privacy' }).waitFor();
const legalFooter = page.locator('footer.app-footer');
await legalFooter.waitFor();
if (await legalFooter.getByRole('link', { name: 'Privacy' }).count() !== 1 || await legalFooter.getByRole('link', { name: 'Terms' }).count() !== 1) throw new Error('Legal route footer is incomplete');

await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'Event ledger' }).waitFor();
const demoFooter = page.locator('footer.app-footer');
await demoFooter.waitFor();
if (await demoFooter.getByText('Built by Param Factory').count() !== 1) throw new Error('Demo route footer is incomplete');

const h1Count = await page.locator('h1').count();
const sources = await (await context.request.get(`${base}/api/sources`, { headers: { authorization: `Bearer ${adminToken}` } })).json();
const created = sources.sources.find((source) => source.alias === `smoke-${suffix}`);
if (created) await context.request.delete(`${base}/api/sources/${created.id}`, { headers: { authorization: `Bearer ${adminToken}` } });

if (h1Count !== 1 || errors.length) throw new Error(`Smoke failed: h1=${h1Count}, errors=${JSON.stringify(errors)}, responses=${JSON.stringify(badResponses)}`);
console.log(JSON.stringify({ status: 'ok', localServer: server.localServer, viewport, keyboard: true, source: `smoke-${suffix}`, ingest: 202, acknowledged: true, digest: true, privacy: true, consoleErrors: 0 }));
} finally {
  if (browser) await browser.close();
  await server.cleanup();
}
