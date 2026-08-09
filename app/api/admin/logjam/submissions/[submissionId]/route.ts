import { getCloudflareContext } from "@opennextjs/cloudflare";

import { apiData, apiError } from "@/server/cloudflare/api-response";
import { requireAdminAccess } from "@/server/cloudflare/admin-auth";
import {
  LogjamAdminError,
  readLogjamAdminSubmission
} from "@/server/cloudflare/logjam-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ submissionId: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdminAccess(request, env);
  if (denied) return denied;

  try {
    const { submissionId } = await context.params;
    return apiData(await readLogjamAdminSubmission(env.DB, submissionId));
  } catch (error) {
    if (error instanceof LogjamAdminError) {
      return apiError(error.code, error.message, error.status, error.details);
    }
    console.error("Failed to read LogJam submission", error);
    return apiError("logjam_submission_read_failed", "The LogJam submission could not be read.", 500);
  }
}
