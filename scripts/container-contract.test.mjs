import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');

test('container build identity defaults safely and never reads git metadata', () => {
  const firstFrom = dockerfile.indexOf('FROM ');
  assert.match(dockerfile.slice(0, firstFrom), /^ARG BUILD_SHA=dev$/m);
  assert.ok((dockerfile.match(/^ARG BUILD_SHA$/gm) || []).length >= 3);
  assert.doesNotMatch(dockerfile, /test -n ["']?\$BUILD_SHA/);
  assert.doesNotMatch(dockerfile, /(?:COPY|ADD)\s+\.git|\bgit\s+(?:rev-parse|describe|log)\b/);
  assert.match(dockerfile, /VITE_BUILD_SHA="\$\{BUILD_SHA:-dev\}" npm run build/);
  assert.match(dockerfile, /BUILD_SHA="\$\{BUILD_SHA:-dev\}" cargo build --locked --release/);
  assert.match(dockerfile, /^FROM rust:1-alpine AS server-builder$/m);
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
