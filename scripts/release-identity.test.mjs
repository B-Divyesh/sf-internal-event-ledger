import assert from 'node:assert/strict';
import test from 'node:test';
import { assertBuildIdentity, verifyLiveBuildIdentity } from './release-identity.mjs';

const candidate = '5c7523f15c39a5655051a7800f7719b313558420';
const staleBuild = '5a15c977709b65e99171de3eb506c662cae30f43';

test('release identity rejects the exact stale deployment recorded by verification 7', () => {
  assert.throws(
    () => assertBuildIdentity({ status: 'ok', build: staleBuild }, candidate),
    new RegExp(`expected ${candidate}, received ${staleBuild}`),
  );
});

test('release identity accepts only the exact candidate SHA from health', async () => {
  let requested;
  const payload = await verifyLiveBuildIdentity('https://internal-event-ledger.sociobot.in/demo', candidate, async (url) => {
    requested = url.toString();
    return new Response(JSON.stringify({ status: 'ok', build: candidate }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  assert.equal(requested, 'https://internal-event-ledger.sociobot.in/health');
  assert.deepEqual(payload, { status: 'ok', build: candidate });
});
