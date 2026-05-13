export async function onRequestGet(context) {
  return json({
    ok: true,
    data: {
      sets: [],
      nextStep: context.env?.DB
        ? "Query archive_sets and set_albums from D1."
        : "Bind yakov_archive D1 before serving admin sets."
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

