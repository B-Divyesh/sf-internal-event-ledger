import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const binary = join(root, 'target/debug/internal-event-ledger');

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

function start({ port, databaseUrl }) {
  const child = spawn(binary, [], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      STATIC_DIR: join(root, 'dist'),
      ADMIN_TOKEN: 'storage-regression-admin-token',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  return { child, output: () => output };
}

async function waitForHealth(port, process, details) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (process.exitCode !== null) throw new Error(`ledger exited early\n${details()}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`ledger did not become healthy\n${details()}`);
}

async function stop(process) {
  if (process.exitCode !== null) return;
  process.kill('SIGTERM');
  await new Promise((resolve) => process.once('exit', resolve));
}

async function waitForExit(process, timeoutMs) {
  return await Promise.race([
    new Promise((resolve) => process.once('exit', (code) => resolve(code))),
    new Promise((_, reject) => setTimeout(() => reject(new Error('ledger stayed running after bounded startup retries')), timeoutMs)),
  ]);
}

test('locked legacy file remains untouched; fresh database starts and a locked startup exits', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'ledger-startup-storage-'));
  const legacyPath = join(workDir, 'ledger-current.db');
  const safePath = join(workDir, 'internal-event-ledger-r9', 'ledger.db');
  const legacy = new DatabaseSync(legacyPath);
  let healthy;
  let restarted;
  let locked;
  try {
    legacy.exec('CREATE TABLE retained_legacy_state(value TEXT); INSERT INTO retained_legacy_state VALUES (\'keep\'); BEGIN EXCLUSIVE;');
    const legacySize = (await stat(legacyPath)).size;
    const safePort = await freePort();
    healthy = start({ port: safePort, databaseUrl: `sqlite://${safePath}?mode=rwc` });
    const health = await waitForHealth(safePort, healthy.child, healthy.output);
    const payload = await health.json();
    assert.equal(payload.status, 'ok');
    assert.equal(typeof payload.build, 'string');
    assert.ok(payload.build.length > 0, 'health reports its compiled build identity');
    assert.equal((await stat(legacyPath)).size, legacySize, 'the locked legacy file is not modified');
    assert.equal(legacy.prepare('SELECT value FROM retained_legacy_state').get().value, 'keep');
    await stop(healthy.child);

    const safe = new DatabaseSync(safePath);
    assert.equal(safe.prepare('PRAGMA journal_mode').get().journal_mode, 'delete');
    safe.close();

    locked = new DatabaseSync(safePath);
    locked.exec('BEGIN EXCLUSIVE');
    const lockedPort = await freePort();
    restarted = start({ port: lockedPort, databaseUrl: `sqlite://${safePath}?mode=rwc` });
    const exitCode = await waitForExit(restarted.child, 6_000);
    assert.notEqual(exitCode, 0, 'a permanently locked startup exits for the platform to restart');
    assert.match(restarted.output(), /startup failed; exiting instead of serving an unready response/);
    assert.doesNotMatch(restarted.output(), /Ledger is starting its local storage/);
  } finally {
    if (healthy) await stop(healthy.child);
    if (restarted) await stop(restarted.child);
    if (locked) {
      locked.exec('ROLLBACK');
      locked.close();
    }
    legacy.exec('ROLLBACK');
    legacy.close();
    await rm(workDir, { recursive: true, force: true });
  }
});
