import { z } from "zod";

const idSchema = z.string().trim().min(1).max(200);
const displayNameSchema = z.string().trim().min(1).max(120).nullable();
const promotionTitleSchema = z.string().trim().min(1).max(160);
const inviteEmailSchema = z.string().trim().max(254).email().transform((email) => email.toLowerCase());

export const logjamAdminMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("invite-email"),
    email: inviteEmailSchema
  }),
  z.object({
    action: z.literal("revoke-invite"),
    email: inviteEmailSchema
  }),
  z.object({
    action: z.literal("rename-user"),
    userId: idSchema,
    displayName: displayNameSchema
  }),
  z.object({
    action: z.literal("archive-submission"),
    submissionId: idSchema
  }),
  z.object({
    action: z.literal("promote-submission"),
    submissionId: idSchema,
    title: promotionTitleSchema.optional()
  })
]);

export type LogjamAdminMutation = z.infer<typeof logjamAdminMutationSchema>;

export function validateLogjamAdminMutationRequest(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return {
      ok: false as const,
      code: "csrf_rejected",
      message: "Cross-origin LogJam admin mutations are not allowed.",
      status: 403
    };
  }
  const contentType = request.headers.get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    return {
      ok: false as const,
      code: "json_required",
      message: "LogJam admin mutations require application/json.",
      status: 415
    };
  }
  return { ok: true as const };
}
