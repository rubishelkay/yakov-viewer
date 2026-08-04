import { describe, expect, it } from "vitest";

import { authStartResponse, requireAccessIdentity } from "../worker/auth";
import type { Env } from "../worker/env";
import { HttpError, readJsonObject } from "../worker/http";
import {
  enforcePrivateMutation,
  enforcePrivateMutationRate,
  enforcePrivateRequestRate
} from "../worker/index";

function env(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    ASSETS: {} as Fetcher,
    DECISION_RATE_LIMITER: { limit: async () => ({ success: true }) },
    PRIVATE_MUTATION_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ...overrides
  };
}

describe("Access configuration", () => {
  it("allows only the explicit local bypass tuple", async () => {
    const identity = await requireAccessIdentity(new Request("http://localhost/auth/start"), env({
      RUNTIME_ENV: "local",
      ACCESS_ENABLED: "false",
      LOCAL_AUTH_BYPASS: "true",
      LOCAL_AUTH_USER_ID: "local-user",
      LOCAL_AUTH_EMAIL: "Friend@Example.test",
      LOCAL_AUTH_NAME: "Friend"
    }));
    expect(identity).toEqual({ sub: "local-user", email: "friend@example.test", displayName: "Friend" });
  });

  it("fails closed when production contains a bypass flag", async () => {
    await expect(requireAccessIdentity(new Request("https://logjam.shmol.cc/auth/start"), env({
      RUNTIME_ENV: "production",
      ACCESS_ENABLED: "true",
      LOCAL_AUTH_BYPASS: "true"
    }))).rejects.toMatchObject({ status: 503, code: "auth_misconfigured" });
  });
});

describe("auth return URL", () => {
  it("redirects only to a same-site relative route", () => {
    expect(authStartResponse(new URL("https://logjam.shmol.cc/auth/start?returnTo=%2Falbums%2Fone")).headers.get("location"))
      .toBe("/albums/one");
    expect(authStartResponse(new URL("https://logjam.shmol.cc/auth/start?returnTo=https%3A%2F%2Fevil.test")).headers.get("location"))
      .toBe("/");
    expect(authStartResponse(new URL("https://logjam.shmol.cc/auth/start/?returnTo=%2Fauth%2Fstart%2F")).headers.get("location"))
      .toBe("/");
  });
});

describe("private mutation CSRF guard", () => {
  it("accepts same-origin JSON", () => {
    expect(() => enforcePrivateMutation(new Request("https://logjam.shmol.cc/api/private/curations", {
      method: "POST",
      headers: { Origin: "https://logjam.shmol.cc", "Content-Type": "application/json" },
      body: "{}"
    }))).not.toThrow();
  });

  it("rejects cross-origin and non-JSON mutations", () => {
    expect(() => enforcePrivateMutation(new Request("https://logjam.shmol.cc/api/private/curations", {
      method: "POST",
      headers: { Origin: "https://evil.test", "Content-Type": "application/json" },
      body: "{}"
    }))).toThrowError(HttpError);
    expect(() => enforcePrivateMutation(new Request("https://logjam.shmol.cc/api/private/curations", {
      method: "POST",
      headers: { Origin: "https://logjam.shmol.cc", "Content-Type": "text/plain" },
      body: "{}"
    }))).toThrowError(HttpError);
  });
});

describe("private mutation resource guards", () => {
  it("uses the separate private-mutation limiter", async () => {
    let key = "";
    await enforcePrivateMutationRate(env({
      PRIVATE_MUTATION_RATE_LIMITER: {
        limit: async (input) => {
          key = input.key;
          return { success: false };
        }
      }
    }), "user-1").then(
      () => expect.fail("Expected the limiter to reject."),
      (error: unknown) => {
        expect(error).toMatchObject({ status: 429, code: "private_mutation_rate_limited" });
      }
    );
    expect(key).toBe("user-1:private-mutation");
  });

  it("rate-limits verified decision identities before user synchronization", async () => {
    let decisionKey = "";
    await enforcePrivateRequestRate(
      new Request("https://logjam.shmol.cc/api/private/decisions/photo-1", {
        method: "PUT",
        headers: { Origin: "https://logjam.shmol.cc", "Content-Type": "application/json" },
        body: "{}"
      }),
      env({
        DECISION_RATE_LIMITER: {
          limit: async (input) => {
            decisionKey = input.key;
            return { success: true };
          }
        }
      }),
      new URL("https://logjam.shmol.cc/api/private/decisions/photo-1"),
      "verified-access-sub"
    );
    expect(decisionKey).toBe("verified-access-sub:decision");
  });

  it("rejects a streamed body by UTF-8 byte size without Content-Length", async () => {
    const body = JSON.stringify({ value: "é".repeat(33_000) });
    const request = new Request("https://logjam.shmol.cc/api/private/curations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    expect(request.headers.has("content-length")).toBe(false);
    await expect(readJsonObject(request)).rejects.toMatchObject({
      status: 413,
      code: "body_too_large"
    });
  });
});
