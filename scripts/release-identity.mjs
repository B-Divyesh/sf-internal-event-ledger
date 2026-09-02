import assert from 'node:assert/strict';

const SHA_PATTERN = /^[a-f0-9]{40}$/i;

function describeBody(payload) {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

/**
 * Validate the public build identity used to prove a release reached the
 * product URL.  This deliberately requires an exact full SHA: a healthy
 * older revision is still a failed release.
 */
export function assertBuildIdentity(payload, expectedSha) {
  assert.match(expectedSha, SHA_PATTERN, 'expected build identity must be a full 40-character SHA');
  assert.equal(payload?.status, 'ok', `health response must report status ok, received ${describeBody(payload)}`);
  assert.equal(
    payload?.build,
    expectedSha,
    `live build identity mismatch: expected ${expectedSha}, received ${payload?.build ?? 'missing'}`,
  );
  return payload;
}

export async function verifyLiveBuildIdentity(url, expectedSha, fetchImpl = fetch) {
  const healthUrl = new URL('/health', url);
  const response = await fetchImpl(healthUrl, { headers: { accept: 'application/json' } });
  assert.equal(response.ok, true, `health request failed with HTTP ${response.status}`);
  return assertBuildIdentity(await response.json(), expectedSha);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [url, expectedSha] = process.argv.slice(2);
  if (!url || !expectedSha) {
    console.error('Usage: node scripts/release-identity.mjs <https://product.example> <full-40-character-sha>');
    process.exitCode = 2;
  } else {
    try {
      const payload = await verifyLiveBuildIdentity(url, expectedSha);
      console.log(JSON.stringify({ url: new URL('/health', url).toString(), ...payload }));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
