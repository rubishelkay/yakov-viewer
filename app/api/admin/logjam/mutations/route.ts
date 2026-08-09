import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";

import { apiData, apiError } from "@/server/cloudflare/api-response";
import { requireAdminAccess } from "@/server/cloudflare/admin-auth";
import {
  applyLogjamAdminMutation,
  LogjamAdminError
} from "@/server/cloudflare/logjam-admin";
import {
  logjamAdminMutationSchema,
  validateLogjamAdminMutationRequest
} from "@/server/cloudflare/logjam-admin-contract";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = getCloudflareContext();
  const requestGuard = validateLogjamAdminMutationRequest(request);
  if (!requestGuard.ok) {
    return apiError(
      requestGuard.code,
      requestGuard.message,
      requestGuard.status
    );
  }
  const denied = await requireAdminAccess(request, env);
  if (denied) return denied;

  try {
    const mutation = logjamAdminMutationSchema.parse(await request.json());
    return apiData(await applyLogjamAdminMutation(env.DB, mutation));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("invalid_logjam_mutation", "LogJam mutation is invalid.", 400, error.flatten());
    }
    if (error instanceof SyntaxError) {
      return apiError("invalid_json", "Expected a JSON request body.", 400);
    }
    if (error instanceof LogjamAdminError) {
      return apiError(error.code, error.message, error.status, error.details);
    }
    console.error("Failed to mutate LogJam admin state", error);
    return apiError("logjam_mutation_failed", "The LogJam change could not be saved.", 500);
  }
}
