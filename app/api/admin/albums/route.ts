import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";

import {
  archiveStatusSchema,
  publicDownloadPolicySchema
} from "@/admin/archive-schema";
import { apiData, apiError } from "@/server/cloudflare/api-response";
import { requireAdminAccess } from "@/server/cloudflare/admin-auth";
import { createD1Album, readD1Archive } from "@/server/cloudflare/archive-d1";

export const dynamic = "force-dynamic";

const createAlbumSchema = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(320).optional(),
  status: archiveStatusSchema.optional(),
  publicDownloadPolicy: publicDownloadPolicySchema.optional()
});

export async function GET(request: Request) {
  const { env } = getCloudflareContext();
  const denied = requireAdminAccess(request, env);
  if (denied) return denied;

  try {
    const archive = await readD1Archive(env.DB);
    return apiData(archive.albums);
  } catch (error) {
    console.error("Failed to read D1 albums", error);
    return apiError("albums_read_failed", "Albums could not be read.", 500);
  }
}

export async function POST(request: Request) {
  const { env } = getCloudflareContext();
  const denied = requireAdminAccess(request, env);
  if (denied) return denied;

  try {
    const input = createAlbumSchema.parse(await request.json());
    return apiData(await createD1Album(env.DB, input), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("invalid_album", "Album data is invalid.", 400, error.flatten());
    }
    if (error instanceof SyntaxError) {
      return apiError("invalid_json", "Expected a JSON request body.", 400);
    }
    console.error("Failed to create D1 album", error);
    return apiError("album_create_failed", "The album could not be created.", 500);
  }
}
