import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const url = process.argv[2] || 'http://127.0.0.1:8080';
const executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
console.log(JSON.stringify({ url, violations: results.violations.map(({ id, impact, help, nodes }) => ({ id, impact, help, nodes: nodes.length })) }, null, 2));
await browser.close();
if (results.violations.some((violation) => violation.impact === 'critical' || violation.impact === 'serious')) process.exit(1);
