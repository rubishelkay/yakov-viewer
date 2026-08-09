import { describe, expect, it } from "vitest";

import {
  authStartResponse,
  requireAccessIdentity,
  requireInvitation
} from "../worker/auth";
import type { Env } from "../worker/env";
import { HttpError, readJsonObject } from "../worker/http";
import worker, {
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

function invitationDb(
  invitedEmails: Set<string>,
  queries: string[] = [],
  beforeRead?: () => void
): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(email: string) {
          return {
            async first() {
              beforeRead?.();
              queries.push(sql);
              if (!sql.includes("FROM logjam_invites")) {
                throw new Error(`Unexpected query after invitation check: ${sql}`);
              }
              return invitedEmails.has(email) ? { email_normalized: email } : null;
            }
          };
        }
      };
    }
  } as unknown as D1Database;
}

function decisionRouteDb(deleted: boolean): D1Database {
  const statement = (sql: string, values: unknown[] = []) => ({
    bind: (...nextValues: unknown[]) => statement(sql, nextValues),
    async first() {
      if (sql.includes("FROM logjam_invites")) {
        return { email_normalized: "friend@example.test" };
      }
      throw new Error(`Unexpected first query: ${sql}`);
    },
    async all() {
      if (sql.includes("FROM logjam_users")) {
        return {
          success: true,
          results: [{
            id: "user-1",
            access_sub: "local-user",
            email_normalized: "friend@example.test",
            owner_display_name: null,
            last_seen_at: new Date().toISOString()
          }],
          meta: { changes: 0 }
        };
      }
      throw new Error(`Unexpected all query: ${sql} (${values.length} values)`);
    }
  });
  return {
    prepare: (sql: string) => statement(sql),
    async batch() {
      const result = (changes: number) => ({
        success: true,
        results: [],
        meta: { changes }
      });
      return [result(0), result(0), result(deleted ? 1 : 0)];
    }
  } as unknown as D1Database;
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

describe("D1 invitation authorization", () => {
  it("normalizes the verified email and observes revocation on the next check", async () => {
    const invitedEmails = new Set(["friend@example.test"]);
    const db = invitationDb(invitedEmails);
    const identity = { sub: "access-sub", email: " Friend@Example.test ", displayName: "Friend" };

    await expect(requireInvitation(db, identity)).resolves.toBeUndefined();
    invitedEmails.delete("friend@example.test");
    await expect(requireInvitation(db, identity)).rejects.toMatchObject({
      status: 403,
      code: "invitation_required"
    });
  });

  it.each(["/auth/start", "/api/private/session"])(
    "rejects an uninvited identity on %s before reading or creating an app user",
    async (pathname) => {
      const queries: string[] = [];
      const response = await worker.fetch(
        new Request(`http://localhost${pathname}`),
        env({
          DB: invitationDb(new Set(), queries),
          RUNTIME_ENV: "local",
          ACCESS_ENABLED: "false",
          LOCAL_AUTH_BYPASS: "true",
          LOCAL_AUTH_USER_ID: "uninvited-user",
          LOCAL_AUTH_EMAIL: "Uninvited@Example.test"
        })
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "invitation_required" }
      });
      expect(queries).toHaveLength(1);
      expect(queries[0]).toContain("FROM logjam_invites");
      expect(queries[0]).not.toContain("logjam_users");
    }
  );

  it("rate-limits an uninvited mutation before its D1 invitation read", async () => {
    const events: string[] = [];
    const response = await worker.fetch(
      new Request("http://localhost/api/private/curations", {
        method: "POST",
        headers: { Origin: "http://localhost", "Content-Type": "application/json" },
        body: "{}"
      }),
      env({
        DB: invitationDb(new Set(), [], () => events.push("invite-read")),
        PRIVATE_MUTATION_RATE_LIMITER: {
          limit: async () => {
            events.push("rate-limit");
            return { success: true };
          }
        },
        RUNTIME_ENV: "local",
        ACCESS_ENABLED: "false",
        LOCAL_AUTH_BYPASS: "true",
        LOCAL_AUTH_USER_ID: "uninvited-user",
        LOCAL_AUTH_EMAIL: "uninvited@example.test"
      })
    );

    expect(response.status).toBe(403);
    expect(events).toEqual(["rate-limit", "invite-read"]);
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
    expect(() => enforcePrivateMutation(new Request("https://logjam.shmol.cc/api/private/decisions/photo-1", {
      method: "DELETE",
      headers: { Origin: "https://logjam.shmol.cc", "Content-Type": "application/json" }
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
    expect(() => enforcePrivateMutation(new Request("https://logjam.shmol.cc/api/private/decisions/photo-1", {
      method: "DELETE",
      headers: { Origin: "https://evil.test", "Content-Type": "application/json" }
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

  it.each([
    { method: "PUT", pathname: "/api/private/decisions/photo-1" },
    { method: "DELETE", pathname: "/api/private/decisions/photo-1" },
    { method: "POST", pathname: "/api/private/decisions/photo-1/undo" }
  ])("rate-limits verified $method decision identities before user synchronization", async ({ method, pathname }) => {
    let decisionKey = "";
    await enforcePrivateRequestRate(
      new Request(`https://logjam.shmol.cc${pathname}`, {
        method,
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
      new URL(`https://logjam.shmol.cc${pathname}`),
      "verified-access-sub"
    );
    expect(decisionKey).toBe("verified-access-sub:decision");
  });

  it("routes an invited same-origin conditional undo", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/private/decisions/photo-1/undo", {
        method: "POST",
        headers: { Origin: "http://localhost", "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: "current-version", previousDecision: null })
      }),
      env({
        DB: decisionRouteDb(true),
        RUNTIME_ENV: "local",
        ACCESS_ENABLED: "false",
        LOCAL_AUTH_BYPASS: "true",
        LOCAL_AUTH_USER_ID: "local-user",
        LOCAL_AUTH_EMAIL: "friend@example.test"
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ decision: null });
  });

  it("returns a conflict when conditional undo no longer matches", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/private/decisions/photo-1/undo", {
        method: "POST",
        headers: { Origin: "http://localhost", "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: "stale-version", previousDecision: null })
      }),
      env({
        DB: decisionRouteDb(false),
        RUNTIME_ENV: "local",
        ACCESS_ENABLED: "false",
        LOCAL_AUTH_BYPASS: "true",
        LOCAL_AUTH_USER_ID: "local-user",
        LOCAL_AUTH_EMAIL: "friend@example.test"
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "decision_conflict" }
    });
  });

  it("rejects malformed conditional undo bodies", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/private/decisions/photo-1/undo", {
        method: "POST",
        headers: { Origin: "http://localhost", "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: "", previousDecision: "maybe" })
      }),
      env({
        DB: decisionRouteDb(true),
        RUNTIME_ENV: "local",
        ACCESS_ENABLED: "false",
        LOCAL_AUTH_BYPASS: "true",
        LOCAL_AUTH_USER_ID: "local-user",
        LOCAL_AUTH_EMAIL: "friend@example.test"
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_decision_version" }
    });
  });

  it("routes an invited same-origin DELETE and returns an idempotent result", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/private/decisions/photo-1", {
        method: "DELETE",
        headers: { Origin: "http://localhost", "Content-Type": "application/json" }
      }),
      env({
        DB: decisionRouteDb(true),
        RUNTIME_ENV: "local",
        ACCESS_ENABLED: "false",
        LOCAL_AUTH_BYPASS: "true",
        LOCAL_AUTH_USER_ID: "local-user",
        LOCAL_AUTH_EMAIL: "friend@example.test"
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      decision: { photoId: "photo-1", deleted: true }
    });

    const retry = await worker.fetch(
      new Request("http://localhost/api/private/decisions/photo-1", {
        method: "DELETE",
        headers: { Origin: "http://localhost", "Content-Type": "application/json" }
      }),
      env({
        DB: decisionRouteDb(false),
        RUNTIME_ENV: "local",
        ACCESS_ENABLED: "false",
        LOCAL_AUTH_BYPASS: "true",
        LOCAL_AUTH_USER_ID: "local-user",
        LOCAL_AUTH_EMAIL: "friend@example.test"
      })
    );
    await expect(retry.json()).resolves.toEqual({
      decision: { photoId: "photo-1", deleted: false }
    });
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
