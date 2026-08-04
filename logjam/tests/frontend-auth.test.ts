import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, isAccessAuthenticationResponse, privateApi } from "../src/lib/api";
import { replaceWithAuth } from "../src/lib/auth";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("private API authentication classification", () => {
  it("does not treat a network failure as proof that authentication is required", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const error = await privateApi("/api/private/account").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "network_error", authenticationRequired: false });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "same-origin",
      redirect: "manual"
    });
  });

  it("does not turn an unrelated HTML server error into an auth redirect", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", {
      status: 503,
      headers: { "Content-Type": "text/html" }
    })));
    const error = await privateApi("/api/private/account").catch((cause: unknown) => cause);
    expect(error).toMatchObject({
      status: 503,
      code: "unexpected_response",
      authenticationRequired: false
    });
  });

  it("recognizes an actual 401 or Cloudflare Access login redirect", () => {
    expect(isAccessAuthenticationResponse({ status: 401, redirected: false, type: "basic", url: "" })).toBe(true);
    expect(isAccessAuthenticationResponse({
      status: 0,
      redirected: false,
      type: "opaqueredirect",
      url: ""
    })).toBe(true);
    expect(isAccessAuthenticationResponse({
      status: 200,
      redirected: true,
      type: "cors",
      url: "https://team.cloudflareaccess.com/cdn-cgi/access/login/logjam"
    })).toBe(true);
    expect(isAccessAuthenticationResponse({
      status: 503,
      redirected: false,
      type: "basic",
      url: "https://logjam.shmol.cc/api/private/account"
    })).toBe(false);
  });
});

describe("auth history", () => {
  it("replaces the current album entry instead of pushing /auth/start", () => {
    const replace = vi.fn();
    replaceWithAuth({ replace } as unknown as Pick<Location, "replace">, "/albums/night walk");
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith(
      "/auth/start?returnTo=%2Falbums%2Fnight%2520walk"
    );
  });
});
