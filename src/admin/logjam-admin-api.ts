import { z } from "zod";

const idSchema = z.string().trim().min(1).max(200);
const timestampSchema = z.string().trim().min(1);
const optionalTimestampSchema = timestampSchema.nullable().optional();
const countSchema = z.number().int().nonnegative();
const inviteEmailSchema = z.string().trim().max(254).email().transform((email) => email.toLowerCase());

export const logjamAdminUserSchema = z.object({
  id: idSchema,
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1).max(120).nullable(),
  createdAt: timestampSchema,
  lastSeenAt: optionalTimestampSchema
});

export const logjamAdminInviteSchema = z.object({
  email: inviteEmailSchema,
  invitedAt: timestampSchema,
  joinedAt: timestampSchema.nullable()
});

export const logjamAdminSubmissionSchema = z.object({
  id: idSchema,
  version: z.number().int().positive(),
  sourceRevision: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(160),
  status: z.enum(["submitted", "archived"]),
  photoCount: countSchema,
  submittedAt: timestampSchema,
  archivedAt: optionalTimestampSchema,
  promotedAlbumId: idSchema.nullable().optional(),
  promotedAlbumStatus: z.string().trim().min(1).nullable().optional(),
  promotedAt: optionalTimestampSchema
});

export const logjamAdminCurationSchema = z.object({
  id: idSchema,
  userId: idSchema,
  title: z.string().trim().min(1).max(160),
  status: z.enum(["active", "archived"]),
  locked: z.boolean(),
  revision: z.number().int().nonnegative(),
  photoCount: countSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  submissions: z.array(logjamAdminSubmissionSchema)
});

export const logjamAdminSnapshotSchema = z.object({
  invites: z.array(logjamAdminInviteSchema),
  users: z.array(logjamAdminUserSchema),
  curations: z.array(logjamAdminCurationSchema)
});

export const logjamAdminSubmissionPhotoSchema = z.object({
  id: idSchema,
  position: z.number().int().nonnegative(),
  title: z.string().trim().min(1).nullable(),
  thumbUrl: z.string().trim().min(1).nullable(),
  displayUrl: z.string().trim().min(1).nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  available: z.boolean(),
  published: z.boolean()
});

export const logjamAdminSubmissionDetailSchema = z.object({
  submission: logjamAdminSubmissionSchema.extend({
    curationId: idSchema,
    userId: idSchema,
    userEmail: z.string().trim().email(),
    userDisplayName: z.string().trim().min(1).max(120).nullable()
  }),
  photos: z.array(logjamAdminSubmissionPhotoSchema)
});

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
    displayName: z.string().trim().min(1).max(120).nullable()
  }),
  z.object({
    action: z.literal("archive-submission"),
    submissionId: idSchema
  }),
  z.object({
    action: z.literal("promote-submission"),
    submissionId: idSchema,
    title: z.string().trim().min(1).max(160).optional()
  })
]);

export type LogjamAdminSnapshot = z.infer<typeof logjamAdminSnapshotSchema>;
export type LogjamAdminInvite = z.infer<typeof logjamAdminInviteSchema>;
export type LogjamAdminUser = z.infer<typeof logjamAdminUserSchema>;
export type LogjamAdminCuration = z.infer<typeof logjamAdminCurationSchema>;
export type LogjamAdminSubmission = z.infer<typeof logjamAdminSubmissionSchema>;
export type LogjamAdminSubmissionDetail = z.infer<typeof logjamAdminSubmissionDetailSchema>;
export type LogjamAdminSubmissionPhoto = z.infer<typeof logjamAdminSubmissionPhotoSchema>;
export type LogjamAdminMutation = z.infer<typeof logjamAdminMutationSchema>;

export function isLogjamSubmissionPhotoPromotable(photo: LogjamAdminSubmissionPhoto) {
  return photo.available && photo.published && Boolean(photo.thumbUrl && photo.displayUrl);
}

export async function readLogjamAdmin(signal?: AbortSignal): Promise<LogjamAdminSnapshot> {
  return logjamAdminSnapshotSchema.parse(
    await requestData("/api/admin/logjam/", { signal })
  );
}

export async function readLogjamSubmissionDetail(
  submissionId: string,
  signal?: AbortSignal
): Promise<LogjamAdminSubmissionDetail> {
  return logjamAdminSubmissionDetailSchema.parse(
    await requestData(`/api/admin/logjam/submissions/${encodeURIComponent(idSchema.parse(submissionId))}/`, {
      signal
    })
  );
}

export async function mutateLogjamAdmin(mutation: LogjamAdminMutation) {
  return requestData("/api/admin/logjam/mutations/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(logjamAdminMutationSchema.parse(mutation))
  });
}

async function requestData(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const payload = await response.json() as {
    ok: boolean;
    data?: unknown;
    error?: { code?: string; message?: string };
  };

  if (!response.ok || !payload.ok) {
    throw new LogjamAdminApiError(
      payload.error?.code ?? "request_failed",
      payload.error?.message ?? `LogJam admin request failed with ${response.status}.`,
      response.status
    );
  }

  return payload.data;
}

export class LogjamAdminApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}
