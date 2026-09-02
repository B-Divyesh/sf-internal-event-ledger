import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const requestedUrl = process.argv[2];
const adminToken = process.env.ADMIN_TOKEN || 'ledger-test-admin';
const publicOnly = process.env.PUBLIC_ONLY === '1';
const executablePath = process.env.CHROMIUM_PATH;
const viewports = [{ name: 'desktop', width: 1366, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
const views = [
  { name: 'Inbox', button: /^Inbox/, heading: 'Event ledger' },
  { name: 'Sources', button: 'Sources', heading: 'Incoming sources' },
  { name: 'Digest', button: 'Digest', heading: 'On-demand digest' },
  { name: 'Settings', button: 'Settings', heading: 'Settings' },
  { name: 'Privacy', link: 'Privacy', heading: 'Privacy' },
  { name: 'Terms', link: 'Terms', heading: 'Terms' },
];

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

  const workDir = await mkdtemp(join(tmpdir(), 'ledger-axe-'));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let output = '';
  const child = spawn(join(process.cwd(), 'target/debug/internal-event-ledger'), [], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      DATABASE_URL: `sqlite://${join(workDir, 'axe.db')}?mode=rwc`,
      STATIC_DIR: join(process.cwd(), 'dist'),
      ADMIN_TOKEN: adminToken,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });

  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`accessibility server exited early\n${output}`);
      try {
        if ((await fetch(`${baseUrl}/health`)).ok) {
          return {
            baseUrl,
            localServer: true,
            async cleanup() {
              await stopProcess(child);
              await rm(workDir, { recursive: true, force: true });
            },
          };
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`accessibility server did not become healthy\n${output}`);
  } catch (error) {
    await stopProcess(child);
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }
}

async function run() {
  const server = requestedUrl
    ? { baseUrl: requestedUrl.replace(/\/$/, ''), localServer: false, cleanup: async () => {} }
    : await startIsolatedServer();
  let browser;
  const scans = [];
  const geometry = [];
  let reflow;

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

  async function scanDemoLoadingState(viewport) {
    // Hold the response after workspace creation so Axe scans the actual
    // loading state rather than racing directly to the settled sample.
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    const page = await context.newPage();
    let releaseDemoResponse;
    const demoResponseHeld = new Promise((resolve) => { releaseDemoResponse = resolve; });
    await page.route('**/api/demo', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      await demoResponseHeld;
      await route.fulfill({ response });
    });

    try {
      await page.goto(`${server.baseUrl}/demo`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('status', { name: 'Loading events' }).waitFor();
      await scan(page, viewport, 'Demo loading state');
    } finally {
      releaseDemoResponse();
      await context.close();
    }
  }

  try {
    browser = await chromium.launch(executablePath ? { executablePath } : {});
    for (const viewport of viewports) {
      await scanDemoLoadingState(viewport);

      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto(server.baseUrl, { waitUntil: 'networkidle' });
      await scan(page, viewport, 'Public landing');
      if (!publicOnly) {
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
      }
      await context.close();

      const demoContext = await browser.newContext({ viewport });
      const demoPage = await demoContext.newPage();
      await demoPage.goto(`${server.baseUrl}/demo`, { waitUntil: 'networkidle' });
      await demoPage.getByRole('heading', { name: 'Event ledger' }).waitFor();
      await scan(demoPage, viewport, 'Demo');
      if (viewport.name === 'mobile') {
        geometry.push(...await demoPage.locator('label.check').evaluateAll((nodes) => nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return { text: node.textContent?.trim() || node.querySelector('input')?.getAttribute('aria-label') || 'event selection', width: rect.width, height: rect.height };
        })));
      }
      await demoContext.close();

      const missingContext = await browser.newContext({ viewport, serviceWorkers: 'block' });
      const missingPage = await missingContext.newPage();
      await missingPage.goto(`${server.baseUrl}/does-not-exist`, { waitUntil: 'networkidle' });
      await missingPage.getByRole('heading', { name: 'This page does not exist' }).waitFor();
      await scan(missingPage, viewport, '404');
      await missingContext.close();
    }

    const reflowContext = await browser.newContext({ viewport: { width: 640, height: 844 }, serviceWorkers: 'block' });
    const reflowPage = await reflowContext.newPage();
    await reflowPage.goto(`${server.baseUrl}/demo`, { waitUntil: 'networkidle' });
    await reflowPage.getByRole('heading', { name: 'Event ledger' }).waitFor();
    await reflowPage.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await scan(reflowPage, { name: '200%-zoom' }, 'Demo reflow');
    reflow = await reflowPage.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      actionRight: Math.max(...[...document.querySelectorAll('.event-side')].map((node) => node.getBoundingClientRect().right)),
    }));
    await reflowContext.close();
  } finally {
    if (browser) await browser.close();
    await server.cleanup();
  }

  console.log(JSON.stringify({ url: server.baseUrl, localServer: server.localServer, publicOnly, scans, geometry, reflow }, null, 2));
  const violations = scans.flatMap((scanResult) => scanResult.violations);
  const undersized = geometry.filter(({ width, height }) => width < 44 || height < 44);
  const overflowsAt200Percent = !reflow || reflow.scrollWidth > reflow.clientWidth || reflow.actionRight > reflow.clientWidth;
  if (violations.length || undersized.length || overflowsAt200Percent) process.exitCode = 1;
}

await run();
