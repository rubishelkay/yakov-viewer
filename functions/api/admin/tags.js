export async function onRequestGet(context) {
  return json({
    ok: true,
    data: {
      tags: [],
      nextStep: context.env?.DB
        ? "Query archive_tags from D1 and expose scopes for autocomplete."
        : "Bind yakov_archive D1 before serving tag dictionary."
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

