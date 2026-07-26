import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { cloudArchiveMutationSchema } from "@/admin/cloudflare-mutations";
import { apiData, apiError } from "@/server/cloudflare/api-response";
import { requireAdminAccess } from "@/server/cloudflare/admin-auth";
import {
  applyD1ArchiveMutation,
  ArchiveMutationError
} from "@/server/cloudflare/archive-mutations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdminAccess(request, env);
  if (denied) return denied;

  try {
    const mutation = cloudArchiveMutationSchema.parse(await request.json());
    const result = await applyD1ArchiveMutation(env, mutation);
    revalidatePath("/", "layout");
    return apiData(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("invalid_mutation", "Archive mutation is invalid.", 400, error.flatten());
    }
    if (error instanceof SyntaxError) {
      return apiError("invalid_json", "Expected a JSON request body.", 400);
    }
    if (error instanceof ArchiveMutationError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("Failed to mutate D1 archive", error);
    return apiError("mutation_failed", "The archive change could not be saved.", 500);
  }
}
