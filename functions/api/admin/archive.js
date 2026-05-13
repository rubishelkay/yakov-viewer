const STUB_ARCHIVE = {
  sets: [],
  albums: [],
  photos: [],
  assets: [],
  tags: [],
  collections: [],
  uploadJobs: [],
  trash: []
};

export async function onRequestGet(context) {
  const accessEmail = context.request.headers.get("Cf-Access-Authenticated-User-Email");
  const hasBindings = Boolean(context.env?.DB && context.env?.PUBLIC_ASSETS && context.env?.PRIVATE_ASSETS);

  return json({
    ok: true,
    data: {
      ...STUB_ARCHIVE,
      access: {
        protectedByCloudflareAccess: Boolean(accessEmail),
        email: accessEmail ?? null
      },
      bindings: {
        d1: Boolean(context.env?.DB),
        publicAssets: Boolean(context.env?.PUBLIC_ASSETS),
        privateAssets: Boolean(context.env?.PRIVATE_ASSETS),
        imageQueue: Boolean(context.env?.IMAGE_PROCESSING)
      },
      nextStep: hasBindings
        ? "Read archive rows from D1 and R2 asset records."
        : "Configure Cloudflare bindings from wrangler.example.toml."
    },
    meta: meta("stub")
  });
}

function json(payload, init = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {})
    }
  });
}

function meta(source) {
  return {
    source,
    generatedAt: new Date().toISOString()
  };
}

