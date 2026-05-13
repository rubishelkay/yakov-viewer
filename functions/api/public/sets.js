export async function onRequestGet(context) {
  const hasDatabase = Boolean(context.env?.DB);

  return json({
    ok: true,
    data: {
      sets: [],
      nextStep: hasDatabase
        ? "Query published sets, albums, and public asset URLs from D1."
        : "Bind yakov_archive D1 before serving live public sets."
    },
    meta: {
      source: "stub",
      generatedAt: new Date().toISOString()
    }
  });
}

function json(payload, init = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      ...(init.headers ?? {})
    }
  });
}

