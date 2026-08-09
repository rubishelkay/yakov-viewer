import { describe, expect, it } from "vitest";

import {
  confirmBlockedNavigation,
  isCurrentInternalNavigation,
  resolveInternalNavigation,
  shouldInterceptLink
} from "../src/router";

describe("same-origin router", () => {
  it("resolves deep links without losing query or hash", () => {
    expect(resolveInternalNavigation(
      "/albums/night%20walk?from=catalog#photo",
      "https://logjam.shmol.cc/account"
    )).toBe("/albums/night%20walk?from=catalog#photo");
  });

  it("does not intercept another origin", () => {
    expect(resolveInternalNavigation("https://yakov.shmol.cc", "https://logjam.shmol.cc/"))
      .toBeNull();
  });

  it("treats a repeated My edit route as a no-op instead of another history entry", () => {
    expect(isCurrentInternalNavigation("/account", "https://logjam.shmol.cc/account")).toBe(true);
    expect(isCurrentInternalNavigation("/account", "https://logjam.shmol.cc/albums/one")).toBe(false);
  });

  it("leaves modified clicks, downloads and new tabs to the browser", () => {
    const click = {
      button: 0,
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false
    };
    expect(shouldInterceptLink(click, { download: false })).toBe(true);
    expect(shouldInterceptLink({ ...click, ctrlKey: true }, { download: false })).toBe(false);
    expect(shouldInterceptLink(click, { download: true })).toBe(false);
    expect(shouldInterceptLink(click, { download: false, target: "_blank" })).toBe(false);
  });

  it("requires explicit confirmation before abandoning a dirty editor", () => {
    let confirmations = 0;
    const confirm = () => {
      confirmations += 1;
      return false;
    };
    expect(confirmBlockedNavigation(null, confirm)).toBe(true);
    expect(confirmations).toBe(0);
    expect(confirmBlockedNavigation("Unsaved changes", confirm)).toBe(false);
    expect(confirmations).toBe(1);
    expect(confirmBlockedNavigation("Unsaved changes", () => true)).toBe(true);
  });
});
