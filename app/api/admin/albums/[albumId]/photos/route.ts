import { getCloudflareContext } from "@opennextjs/cloudflare";

import { apiData, apiError } from "@/server/cloudflare/api-response";
import { requireAdminAccess } from "@/server/cloudflare/admin-auth";
import { ArchiveWriteError, createD1PhotoUpload } from "@/server/cloudflare/archive-d1";

export const dynamic = "force-dynamic";

const maxJpegBytes = 20 * 1024 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ albumId: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = requireAdminAccess(request, env);
  if (denied) return denied;

  try {
    const { albumId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    const width = positiveInteger(form.get("width"));
    const height = positiveInteger(form.get("height"));
    const title = optionalText(form.get("title"));

    if (!(file instanceof File)) {
      return apiError("missing_file", "A JPEG file is required.", 400);
    }
    if (file.type !== "image/jpeg" || !(await hasJpegSignature(file))) {
      return apiError("unsupported_file", "The first upload milestone accepts JPEG files only.", 415);
    }
    if (!file.size || file.size > maxJpegBytes) {
      return apiError("invalid_file_size", "JPEG size must be between 1 byte and 20 MiB.", 413);
    }
    if (!width || !height) {
      return apiError("invalid_dimensions", "Positive JPEG width and height are required.", 400);
    }

    return apiData(
      await createD1PhotoUpload(env, { albumId, file, width, height, title }),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ArchiveWriteError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("Failed to upload JPEG", error);
    return apiError("upload_failed", "The JPEG could not be stored.", 500);
  }
}

async function hasJpegSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  return bytes.length === 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function positiveInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function optionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 200) : undefined;
}
