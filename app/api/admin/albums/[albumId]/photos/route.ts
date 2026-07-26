import { getCloudflareContext } from "@opennextjs/cloudflare";

import { apiData, apiError } from "@/server/cloudflare/api-response";
import { requireAdminAccess } from "@/server/cloudflare/admin-auth";
import { ArchiveWriteError, createD1PhotoUpload } from "@/server/cloudflare/archive-d1";
import { inspectPublicJpeg, JpegMetadataError } from "@/lib/jpeg-metadata";

export const dynamic = "force-dynamic";

const maxJpegBytes = 20 * 1024 * 1024;
const maxThumbBytes = 512 * 1024;
const maxDisplayBytes = 2 * 1024 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ albumId: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdminAccess(request, env);
  if (denied) return denied;

  try {
    const { albumId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    const thumb = form.get("thumb");
    const display = form.get("display");
    const width = positiveInteger(form.get("width"));
    const height = positiveInteger(form.get("height"));
    const thumbWidth = positiveInteger(form.get("thumbWidth"));
    const thumbHeight = positiveInteger(form.get("thumbHeight"));
    const displayWidth = positiveInteger(form.get("displayWidth"));
    const displayHeight = positiveInteger(form.get("displayHeight"));
    const expandedColorProfile = colorProfile(form.get("expandedColorProfile"));
    const clientUploadId = optionalText(form.get("clientUploadId"));
    const title = optionalText(form.get("title"));

    if (!(file instanceof File)) {
      return apiError("missing_file", "The expanded JPEG is required.", 400);
    }
    if (!(thumb instanceof File) || !(display instanceof File)) {
      return apiError("missing_derivatives", "Thumb and display JPEG files are required.", 400);
    }
    if (!clientUploadId || !uuidPattern.test(clientUploadId)) {
      return apiError("invalid_upload_id", "A valid client upload ID is required.", 400);
    }
    if (!(await isJpeg(file)) || !(await isJpeg(thumb)) || !(await isJpeg(display))) {
      return apiError("unsupported_file", "The first upload milestone accepts JPEG files only.", 415);
    }
    if (!file.size || file.size > maxJpegBytes) {
      return apiError("invalid_file_size", "JPEG size must be between 1 byte and 20 MiB.", 413);
    }
    if (!expandedColorProfile) {
      return apiError("invalid_color_profile", "Expanded JPEG color profile is invalid.", 400);
    }
    const inspection = inspectPublicJpeg(new Uint8Array(await file.arrayBuffer()));
    if (inspection.unsafeSegments.length) {
      return apiError(
        "unsafe_metadata",
        `Expanded JPEG still contains public metadata: ${inspection.unsafeSegments.join(", ")}.`,
        422
      );
    }
    if (!thumb.size || thumb.size > maxThumbBytes || !display.size || display.size > maxDisplayBytes) {
      return apiError("invalid_derivative_size", "Thumb must be at most 512 KiB and display at most 2 MiB.", 413);
    }
    if (!width || !height || !thumbWidth || !thumbHeight || !displayWidth || !displayHeight) {
      return apiError("invalid_dimensions", "Positive source and derivative dimensions are required.", 400);
    }

    return apiData(
      await createD1PhotoUpload(env, {
        albumId,
        clientUploadId,
        display: { file: display, height: displayHeight, width: displayWidth },
        height,
        expanded: file,
        expandedBytes: file.size,
        expandedColorProfile,
        expandedFileName: file.name,
        thumb: { file: thumb, height: thumbHeight, width: thumbWidth },
        title,
        width
      }),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof JpegMetadataError) {
      return apiError("invalid_jpeg", error.message, 415);
    }
    if (error instanceof ArchiveWriteError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("Failed to upload JPEG", error);
    return apiError("upload_failed", "The JPEG could not be stored.", 500);
  }
}

async function isJpeg(file: File) {
  return file.type === "image/jpeg" && await hasJpegSignature(file);
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

function colorProfile(value: FormDataEntryValue | null) {
  return value === "preserve" || value === "srgb" ? value : undefined;
}
