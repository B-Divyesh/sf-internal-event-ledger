import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
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

function start({ port, databaseUrl, tokenFile }) {
  const child = spawn(binary, [], {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      STATIC_DIR: join(root, 'dist'),
      ADMIN_TOKEN_FILE: tokenFile,
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
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('ledger stayed running after bounded startup retries')),
      timeoutMs,
    );
    process.once('exit', (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
}

async function adminRequest(port, token, path, options = {}) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...options.headers },
  });
}

test('a rolling process starts on the same mounted database and state survives a full restart', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'ledger-startup-storage-'));
  const legacyPath = join(workDir, 'ledger-current.db');
  const safePath = join(workDir, 'internal-event-ledger', 'ledger-v2.sqlite3');
  const tokenFile = join(workDir, 'internal-event-ledger', 'admin-token');
  const legacy = new DatabaseSync(legacyPath);
  let first;
  let replacement;
  let restarted;
  try {
    legacy.exec('CREATE TABLE retained_legacy_state(value TEXT); INSERT INTO retained_legacy_state VALUES (\'keep\'); BEGIN EXCLUSIVE;');
    const legacySize = (await stat(legacyPath)).size;
    const firstPort = await freePort();
    first = start({ port: firstPort, databaseUrl: `sqlite://${safePath}?mode=rwc`, tokenFile });
    const health = await waitForHealth(firstPort, first.child, first.output);
    const payload = await health.json();
    assert.equal(payload.status, 'ok');
    assert.equal(typeof payload.build, 'string');
    assert.ok(payload.build.length > 0, 'health reports its compiled build identity');
    assert.equal((await stat(legacyPath)).size, legacySize, 'the locked legacy file is not modified');
    assert.equal(legacy.prepare('SELECT value FROM retained_legacy_state').get().value, 'keep');
    const token = (await readFile(tokenFile, 'utf8')).trim();
    assert.equal(token.length, 64);
    const created = await adminRequest(firstPort, token, '/api/sources', {
      method: 'POST',
      body: JSON.stringify({ name: 'Persistent deploys', alias: 'persistent-deploys', retention_days: 30 }),
    });
    assert.equal(created.status, 201);

    const replacementPort = await freePort();
    replacement = start({ port: replacementPort, databaseUrl: `sqlite://${safePath}?mode=rwc`, tokenFile });
    const replacementHealth = await waitForHealth(replacementPort, replacement.child, replacement.output);
    assert.equal(replacementHealth.status, 200, `replacement failed to share mounted storage\n${replacement.output()}`);
    assert.equal(first.child.exitCode, null, 'the serving process remains healthy during replacement startup');
    assert.match(replacement.output(), /"admin_token_source":"persisted"/);
    const duringRollout = await adminRequest(replacementPort, token, '/api/sources');
    assert.equal(duringRollout.status, 200);
    assert.equal((await duringRollout.json()).sources.some(({ alias }) => alias === 'persistent-deploys'), true);

    const burstStartedAt = performance.now();
    const burst = await Promise.all(Array.from({ length: 120 }, (_, index) =>
      adminRequest(index % 2 === 0 ? firstPort : replacementPort, token, '/api/events', {
        headers: { 'x-forwarded-for': '203.0.113.244' },
      }),
    ));
    const elapsedSeconds = (performance.now() - burstStartedAt) / 1000;
    const allowed = burst.filter(({ status }) => status === 200).length;
    const limited = burst.filter(({ status }) => status === 429);
    const maximumWithMeasuredRefill = 60 + Math.ceil(elapsedSeconds * 20) + 1;
    assert.ok(allowed >= 60 && allowed <= maximumWithMeasuredRefill,
      `two processes shared one 60-token allowance: ${allowed} allowed in ${elapsedSeconds.toFixed(3)}s`);
    assert.equal(limited.length, 120 - allowed);
    assert.ok(limited.every((response) => response.headers.get('retry-after') === '1'));

    await stop(first.child);
    first = undefined;
    await stop(replacement.child);
    replacement = undefined;

    const restartPort = await freePort();
    restarted = start({ port: restartPort, databaseUrl: `sqlite://${safePath}?mode=rwc`, tokenFile });
    await waitForHealth(restartPort, restarted.child, restarted.output);
    const afterRestart = await adminRequest(restartPort, token, '/api/sources');
    assert.equal(afterRestart.status, 200);
    assert.equal((await afterRestart.json()).sources.some(({ alias }) => alias === 'persistent-deploys'), true);
    assert.match(restarted.output(), /"admin_token_source":"persisted"/);

    await stop(restarted.child);
    restarted = undefined;
    const safe = new DatabaseSync(safePath);
    assert.equal(safe.prepare('PRAGMA journal_mode').get().journal_mode, 'delete');
    safe.close();
  } finally {
    if (first) await stop(first.child);
    if (replacement) await stop(replacement.child);
    if (restarted) await stop(restarted.child);
    legacy.exec('ROLLBACK');
    legacy.close();
    await rm(workDir, { recursive: true, force: true });
  }
});

test('a storage configuration error is printed with its failing path and stage', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'ledger-startup-error-'));
  const databasePath = join(workDir, 'database-is-a-directory');
  await mkdir(databasePath);
  const port = await freePort();
  const failed = start({
    port,
    databaseUrl: `sqlite://${databasePath}?mode=rwc`,
    tokenFile: join(workDir, 'admin-token'),
  });
  try {
    const exitCode = await waitForExit(failed.child, 6_000);
    assert.notEqual(exitCode, 0);
    assert.match(failed.output(), /internal-event-ledger failed to start or serve/);
    assert.match(failed.output(), /could not initialize SQLite storage/);
    assert.match(failed.output(), /database-is-a-directory/);
  } finally {
    await stop(failed.child);
    await rm(workDir, { recursive: true, force: true });
  }
});
