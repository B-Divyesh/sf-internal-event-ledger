import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const ignored = new Set(['.git', 'dist', 'node_modules', 'target', 'graphify-out']);
const banned = [
  ['sociobot', 'v2'].join('-'),
  ['sociobot', 'db'].join('-'),
  ['sociobot', 'keyvault1'].join('-'),
  ['shared', 'postgres'].join(' '),
  ['postgre', 'sql'].join(''),
  ['pg', 'bouncer'].join(''),
  ['api', 'sociobot', 'in'].join('.'),
  ['checkout', 'dodopayments', 'com'].join('.'),
  ['billing', 'api', 'base'].join('_').toUpperCase(),
  ['req', 'west'].join(''),
];

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return ignored.has(entry.name) ? [] : files(path);
    return entry.isFile() ? [path] : [];
  }));
  return nested.flat();
}

test('forbidden-resource regression: repository remains scoped to this ledger', async () => {
  const violations = [];
  for (const file of await files(root)) {
    const text = await readFile(file, 'utf8').catch(() => '');
    const lower = text.toLowerCase();
    for (const phrase of banned) {
      if (lower.includes(phrase.toLowerCase())) violations.push(`${relative(root, file)}: ${phrase}`);
    }
  }
  assert.deepEqual(violations, []);
});
