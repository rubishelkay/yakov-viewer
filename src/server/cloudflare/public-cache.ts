const excludedPublicPrefixes = ["/admin", "/api", "/_next"];

export const publicDocumentCacheControl =
  "public, max-age=60, stale-while-revalidate=3600, stale-if-error=86400";

export function isCacheablePublicDocumentRequest(request: Request) {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  if (excludedPublicPrefixes.some((prefix) => isPathWithin(url.pathname, prefix))) {
    return false;
  }
  if (url.searchParams.has("_rsc")) return false;

  const accept = request.headers.get("accept")?.toLowerCase() ?? "";
  if (!accept.includes("text/html")) return false;

  return ![
    "rsc",
    "next-router-prefetch",
    "next-router-state-tree",
    "next-url"
  ].some((header) => request.headers.has(header));
}

function isPathWithin(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
