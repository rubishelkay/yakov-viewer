export async function onRequestPost(context) {
  let body;

  try {
    body = await context.request.json();
  } catch {
    return jsonError("invalid_json", "Expected a JSON body with albumId and JPEG file descriptors.", 400);
  }

  if (!body?.albumId || !Array.isArray(body.files)) {
    return jsonError("invalid_upload_request", "Upload signing requires albumId and files[].", 400);
  }

  const unsupportedFile = body.files.find((file) => file.mimeType !== "image/jpeg");
  if (unsupportedFile) {
    return jsonError("unsupported_file_type", "First upload milestone accepts image/jpeg only.", 415);
  }

  return json(
    {
      ok: false,
      error: {
        code: "not_wired",
        message:
          "Signed R2 upload URLs are intentionally disabled until D1/R2 bindings are configured in Cloudflare."
      },
      meta: {
        generatedAt: new Date().toISOString()
      },
      plannedFlow: [
        "create D1 photo records in review status",
        "sign sourceJpeg upload into private R2",
        "enqueue derivative processing job",
        "write thumb/display/expanded/downloadJpeg asset records"
      ]
    },
    { status: 501 }
  );
}

export async function onRequestGet() {
  return jsonError("method_not_allowed", "Use POST with albumId and files[].", 405);
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

