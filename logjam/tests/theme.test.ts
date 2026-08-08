import { describe, expect, it } from "vitest";

import { oppositeTheme, resolveTheme, storedTheme } from "../src/lib/theme";

describe("LogJam theme", () => {
  it("follows the system only when no explicit light or dark choice is stored", () => {
    expect(resolveTheme(null, false)).toBe("light");
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("ignores invalid stored modes and always toggles between two themes", () => {
    expect(storedTheme("system")).toBeNull();
    expect(oppositeTheme("light")).toBe("dark");
    expect(oppositeTheme("dark")).toBe("light");
  });
});
