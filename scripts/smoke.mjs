import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:8080';
const executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
const badResponses = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Sources' }).click();
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
const eventRow = page.locator('article', { hasText: `Smoke source ${suffix}` });
await eventRow.getByText('End-to-end smoke event', { exact: true }).waitFor();
await eventRow.getByRole('button', { name: 'Acknowledge' }).click();
await eventRow.getByText('acknowledged', { exact: true }).waitFor();
await page.getByRole('button', { name: 'Digest' }).click();
await page.getByRole('heading', { name: 'Daily digest' }).waitFor();
await page.goto(`${base}/privacy`, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'Privacy' }).waitFor();

const h1Count = await page.locator('h1').count();
const sources = await (await context.request.get(`${base}/api/sources`)).json();
const created = sources.sources.find((source) => source.alias === `smoke-${suffix}`);
if (created) await context.request.delete(`${base}/api/sources/${created.id}`);
await browser.close();
if (h1Count !== 1 || errors.length) throw new Error(`Smoke failed: h1=${h1Count}, errors=${JSON.stringify(errors)}, responses=${JSON.stringify(badResponses)}`);
console.log(JSON.stringify({ status: 'ok', source: `smoke-${suffix}`, ingest: 202, acknowledged: true, digest: true, privacy: true, consoleErrors: 0 }));
