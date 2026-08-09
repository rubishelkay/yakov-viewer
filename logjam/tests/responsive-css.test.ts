import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

describe("narrow header contract", () => {
  it("has a 320px-safe breakpoint below the unchanged 390px layout", () => {
    const start = css.indexOf("@media (max-width: 350px)");
    const end = css.indexOf("@media (prefers-reduced-motion", start);
    const narrow = start >= 0 && end > start ? css.slice(start, end) : "";
    expect(narrow).toContain(".site-header");
    expect(narrow).toContain("gap: 8px");
    expect(narrow).toContain(".site-wordmark");
    expect(narrow).toContain("font-size: 3.75rem");
    expect(narrow).toContain(".account-link");
  });
});
