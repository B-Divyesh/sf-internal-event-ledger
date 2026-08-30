import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
const serverMain = await readFile(new URL('../src/main.rs', import.meta.url), 'utf8');

test('container build identity defaults safely and never reads git metadata', () => {
  const firstFrom = dockerfile.indexOf('FROM ');
  assert.match(dockerfile.slice(0, firstFrom), /^ARG BUILD_SHA=dev$/m);
  assert.ok((dockerfile.match(/^ARG BUILD_SHA$/gm) || []).length >= 3);
  assert.doesNotMatch(dockerfile, /test -n ["']?\$BUILD_SHA/);
  assert.doesNotMatch(dockerfile, /(?:COPY|ADD)\s+\.git|\bgit\s+(?:rev-parse|describe|log)\b/);
  assert.match(dockerfile, /VITE_BUILD_SHA="\$\{BUILD_SHA:-dev\}" npm run build/);
  assert.match(dockerfile, /BUILD_SHA="\$\{BUILD_SHA:-dev\}" cargo build --locked --release/);
  assert.match(dockerfile, /^FROM rust:1-alpine AS server-builder$/m);
  assert.match(dockerfile, /COPY frontend\/public\/404\.html \.\/frontend\/public\/404\.html/);
  assert.doesNotMatch(dockerfile, /^FROM rust:1\.\d+/m);
});

test('runtime image carries the supplied build identity and starts with defaults', () => {
  const runtime = dockerfile.slice(dockerfile.lastIndexOf('FROM '));
  assert.match(runtime, /^ARG BUILD_SHA$/m);
  assert.match(runtime, /^\s*BUILD_SHA=\$BUILD_SHA \\/m);
  assert.match(runtime, /^ENV PORT=8080 \\/m);
  assert.match(runtime, /^\s*ADMIN_TOKEN_FILE=\/data\/admin-token \\/m);
  assert.match(runtime, /org\.opencontainers\.image\.revision=\$BUILD_SHA/);
  assert.doesNotMatch(runtime, /ADMIN_TOKEN=/);
});

test('rolling startup binds before it opens the durable SQLite files', () => {
  const listener = serverMain.indexOf('let listener = TcpListener::bind');
  const pools = serverMain.indexOf('open_runtime_pools(&database_url).await');
  assert.ok(listener >= 0, 'the service must bind its configured PORT');
  assert.ok(pools >= 0, 'the service must open its SQLite pools');
  assert.ok(listener < pools, 'a replacement must bind before it contends with an older SQLite writer');
  assert.match(serverMain, /SQLite is busy during rolling startup; retrying/);
});

test('site discovery and designed error documents ship in the frontend', async () => {
  for (const name of ['robots.txt', 'sitemap.xml', '404.html', '404.css', 'social-card.webp', 'apple-touch-icon.png']) {
    await access(new URL(`../frontend/public/${name}`, import.meta.url));
  }
  const robots = await readFile(new URL('../frontend/public/robots.txt', import.meta.url), 'utf8');
  const sitemap = await readFile(new URL('../frontend/public/sitemap.xml', import.meta.url), 'utf8');
  const notFound = await readFile(new URL('../frontend/public/404.html', import.meta.url), 'utf8');
  assert.match(robots, /Sitemap: https:\/\/internal-event-ledger\.sociobot\.in\/sitemap\.xml/);
  for (const route of ['/', '/demo', '/privacy', '/terms']) assert.match(sitemap, new RegExp(`<loc>https://internal-event-ledger\\.sociobot\\.in${route.replace('/', '\\/')}`));
  assert.match(notFound, /<h1>This route is not on the board<\/h1>/);
});
