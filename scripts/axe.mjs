import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const url = process.argv[2] || 'http://127.0.0.1:8080';
const adminToken = process.env.ADMIN_TOKEN || 'ledger-test-admin';
const executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const viewports = [{ name: 'desktop', width: 1366, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
const views = [
  { name: 'Inbox', button: /^Inbox/, heading: 'Event ledger' },
  { name: 'Sources', button: 'Sources', heading: 'Incoming sources' },
  { name: 'Digest', button: 'Digest', heading: 'Daily digest' },
  { name: 'Settings', button: 'Settings', heading: 'Settings' },
  { name: 'Privacy', link: 'Privacy', heading: 'Privacy' },
  { name: 'Terms', link: 'Terms', heading: 'Terms' },
];
const scans = [];
const geometry = [];

async function scan(page, viewport, view) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
    .analyze();
  scans.push({
    viewport: viewport.name,
    view,
    violations: results.violations.map(({ id, impact, help, nodes }) => ({ id, impact, help, nodes: nodes.length })),
  });
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await scan(page, viewport, 'Public landing');
  await page.getByLabel('Administrator token').fill(adminToken);
  await page.getByRole('button', { name: 'Open my ledger' }).click();
  await page.getByRole('heading', { name: 'Event ledger' }).waitFor();

  for (const view of views) {
    if (view.button) await page.locator(`.main-nav [data-route="${view.name.toLowerCase()}"]`).click();
    else await page.locator(`.sidebar-foot a[data-legal="${view.link.toLowerCase()}"]`).evaluate((node) => node.click());
    await page.getByRole('heading', { name: view.heading }).waitFor();
    await scan(page, viewport, view.name);
    if (view.name === 'Inbox' && viewport.name === 'desktop') {
      const links = await page.locator('.sidebar-foot a').evaluateAll((nodes) => nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { text: node.textContent?.trim(), width: rect.width, height: rect.height };
      }));
      geometry.push(...links);
    }
  }
  await context.close();

  const demoContext = await browser.newContext({ viewport });
  const demoPage = await demoContext.newPage();
  await demoPage.goto(`${url}/demo`, { waitUntil: 'networkidle' });
  await demoPage.getByRole('heading', { name: 'Event ledger' }).waitFor();
  await scan(demoPage, viewport, 'Demo');
  await demoContext.close();
}

await browser.close();
console.log(JSON.stringify({ url, scans, geometry }, null, 2));
const violations = scans.flatMap((scanResult) => scanResult.violations);
const undersized = geometry.filter(({ width, height }) => width < 44 || height < 44);
if (violations.length || undersized.length) process.exit(1);
