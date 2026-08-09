import { getCloudflareContext } from "@opennextjs/cloudflare";

import { apiData, apiError } from "@/server/cloudflare/api-response";
import { requireAdminAccess } from "@/server/cloudflare/admin-auth";
import { readLogjamAdminOverview } from "@/server/cloudflare/logjam-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdminAccess(request, env);
  if (denied) return denied;

  try {
    return apiData(await readLogjamAdminOverview(env.DB));
  } catch (error) {
    console.error("Failed to read LogJam admin overview", error);
    return apiError("logjam_read_failed", "LogJam submissions could not be read.", 500);
  }
}
