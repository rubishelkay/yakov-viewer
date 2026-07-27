import assert from "node:assert/strict";
import test from "node:test";

import { isCacheablePublicDocumentRequest } from "@/server/cloudflare/public-cache";

const htmlHeaders = { accept: "text/html,application/xhtml+xml" };

test("caches normal public document requests", () => {
  assert.equal(cacheable("/"), true);
  assert.equal(cacheable("/albums"), true);
  assert.equal(cacheable("/albums/boring-film-57?photo=3"), true);
  assert.equal(cacheable("/tags/bangkok"), true);
});

test("never caches admin, API, asset, mutation, or React Server Component requests", () => {
  assert.equal(cacheable("/admin"), false);
  assert.equal(cacheable("/admin/albums"), false);
  assert.equal(cacheable("/api/admin/archive"), false);
  assert.equal(cacheable("/_next/static/app.js"), false);
  assert.equal(cacheable("/", { method: "POST" }), false);
  assert.equal(cacheable("/albums?_rsc=abc"), false);
  assert.equal(cacheable("/albums", { headers: { ...htmlHeaders, rsc: "1" } }), false);
  assert.equal(cacheable("/albums", {
    headers: { ...htmlHeaders, "next-router-prefetch": "1" }
  }), false);
  assert.equal(cacheable("/albums", { headers: { accept: "text/x-component" } }), false);
});

test("does not treat similarly named public paths as private prefixes", () => {
  assert.equal(cacheable("/administrator"), true);
  assert.equal(cacheable("/apiary"), true);
});

function cacheable(path: string, init: RequestInit = {}) {
  return isCacheablePublicDocumentRequest(new Request(`https://yakov.shmol.cc${path}`, {
    headers: htmlHeaders,
    ...init
  }));
}
