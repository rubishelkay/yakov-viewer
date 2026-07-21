import assert from "node:assert/strict";
import test from "node:test";

import { exportJWK, generateKeyPair, SignJWT } from "jose";

import { verifyAdminAccess } from "@/server/cloudflare/admin-auth-core";

test("Cloudflare Access authorization fails closed and accepts only the owner JWT", async () => {
  const issuer = "https://yakov-auth-test.cloudflareaccess.com";
  const audience = "yakov-admin-audience";
  const ownerEmail = "Jacobjshmol@gmail.com";
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.alg = "RS256";
  jwk.kid = "yakov-test-key";
  jwk.use = "sig";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    assert.equal(url, `${issuer}/cdn-cgi/access/certs`);
    return Response.json({ keys: [jwk] }, {
      headers: { "cache-control": "public, max-age=60" }
    });
  }) as typeof fetch;

  const baseEnv = {
    ACCESS_APP_AUD: audience,
    ACCESS_TEAM_DOMAIN: issuer,
    ADMIN_ACCESS_ENABLED: "true" as const,
    ADMIN_EMAIL: ownerEmail as "Jacobjshmol@gmail.com"
  };

  try {
    const disabled = await verifyAdminAccess(new Headers({ host: "yakov.shmol.cc" }), {
      ...baseEnv,
      ADMIN_ACCESS_ENABLED: "false"
    });
    assert.deepEqual(disabled, {
      ok: false,
      code: "admin_disabled",
      message: "Admin access is not enabled.",
      status: 503
    });

    const local = await verifyAdminAccess(new Headers({ host: "127.0.0.1:8787" }), {
      ...baseEnv,
      ADMIN_ACCESS_ENABLED: "false",
      ADMIN_LOCAL_BYPASS: "true",
      ADMIN_RUNTIME_ENV: "local"
    });
    assert.equal(local.ok, true);
    if (local.ok) assert.equal(local.source, "local");

    const productionCannotBypass = await verifyAdminAccess(new Headers({ host: "yakov.shmol.cc" }), {
      ...baseEnv,
      ADMIN_LOCAL_BYPASS: "true",
      ADMIN_RUNTIME_ENV: "local"
    });
    assert.equal(productionCannotBypass.ok, false);
    if (!productionCannotBypass.ok) assert.equal(productionCannotBypass.status, 401);

    const incompleteLocalBypass = await verifyAdminAccess(new Headers({ host: "127.0.0.1:8787" }), {
      ...baseEnv,
      ADMIN_ACCESS_ENABLED: "false",
      ADMIN_LOCAL_BYPASS: "true"
    });
    assert.equal(incompleteLocalBypass.ok, false);

    const ownerToken = await accessToken({ audience, email: ownerEmail, issuer, privateKey });
    const owner = await verifyAdminAccess(new Headers({
      "cf-access-jwt-assertion": ownerToken,
      host: "yakov.shmol.cc"
    }), baseEnv);
    assert.equal(owner.ok, true);
    if (owner.ok) {
      assert.equal(owner.email, ownerEmail.toLowerCase());
      assert.equal(owner.source, "access");
    }

    const otherToken = await accessToken({
      audience,
      email: "someone@example.com",
      issuer,
      privateKey
    });
    const other = await verifyAdminAccess(new Headers({
      "cf-access-jwt-assertion": otherToken,
      host: "yakov.shmol.cc"
    }), baseEnv);
    assert.equal(other.ok, false);
    if (!other.ok) assert.equal(other.status, 403);

    const wrongAudienceToken = await accessToken({
      audience: "another-application",
      email: ownerEmail,
      issuer,
      privateKey
    });
    const wrongAudience = await verifyAdminAccess(new Headers({
      "cf-access-jwt-assertion": wrongAudienceToken,
      host: "yakov.shmol.cc"
    }), baseEnv);
    assert.equal(wrongAudience.ok, false);
    if (!wrongAudience.ok) assert.equal(wrongAudience.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function accessToken(input: {
  audience: string;
  email: string;
  issuer: string;
  privateKey: CryptoKey;
}) {
  return new SignJWT({ email: input.email })
    .setProtectedHeader({ alg: "RS256", kid: "yakov-test-key" })
    .setIssuer(input.issuer)
    .setAudience(input.audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(input.privateKey);
}
