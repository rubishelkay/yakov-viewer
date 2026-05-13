export async function onRequestPatch(context) {
  const id = context.params?.id;
  let body;

  try {
    body = await context.request.json();
  } catch {
    return jsonError("invalid_json", "Expected a JSON patch body for the set composer.", 400);
  }

  if (!id) {
    return jsonError("missing_id", "Set id is required.", 400);
  }

  const allowedLayoutModes = new Set([
    "fullscreen-carousel",
    "six-grid",
    "nine-grid",
    "editorial-row",
    "split-feature",
    "custom"
  ]);

  if (body.layoutMode && !allowedLayoutModes.has(body.layoutMode)) {
    return jsonError("invalid_layout_mode", "Unknown set layout mode.", 400);
  }

  return json(
    {
      ok: false,
      error: {
        code: "not_wired",
        message: "Set composer writes are disabled until D1 binding and auth policy are configured."
      },
      meta: {
        generatedAt: new Date().toISOString()
      }
    },
    { status: 501 }
  );
}

export async function onRequestGet() {
  return jsonError("method_not_allowed", "Use PATCH to update a set.", 405);
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

