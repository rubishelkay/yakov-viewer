import { getCloudflareContext } from "@opennextjs/cloudflare";

import { apiData, apiError } from "@/server/cloudflare/api-response";
import { requireAdminAccess } from "@/server/cloudflare/admin-auth";
import { readD1Archive } from "@/server/cloudflare/archive-d1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdminAccess(request, env);
  if (denied) return denied;

  try {
    return apiData(await readD1Archive(env.DB));
  } catch (error) {
    console.error("Failed to read D1 archive", error);
    return apiError("archive_read_failed", "The Cloudflare archive could not be read.", 500);
  }
}
