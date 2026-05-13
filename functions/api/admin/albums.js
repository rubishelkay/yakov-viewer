export async function onRequestGet(context) {
  return json({
    ok: true,
    data: {
      albums: [],
      nextStep: context.env?.DB
        ? "Query archive_albums, album_tags, and cover assets from D1."
        : "Bind yakov_archive D1 before serving admin albums."
    },
    meta: meta("stub")
  });
}

export async function onRequestPost(context) {
  let body;

  try {
    body = await context.request.json();
  } catch {
    return jsonError("invalid_json", "Expected a JSON body with at least a title.", 400);
  }

  if (!body?.title || typeof body.title !== "string") {
    return jsonError("missing_title", "Album creation requires a title.", 400);
  }

  return json(
    {
      ok: false,
      error: {
        code: "not_wired",
        message: "Album writes are disabled until D1 binding and auth policy are configured."
      },
      meta: {
        generatedAt: new Date().toISOString()
      }
    },
    { status: 501 }
  );
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

function jsonError(code, message, status) {
  return json(
    {
      ok: false,
      error: { code, message },
      meta: {
        generatedAt: new Date().toISOString()
      }
    },
    { status }
  );
}

function meta(source) {
  return {
    source,
    generatedAt: new Date().toISOString()
  };
}

