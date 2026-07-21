import "server-only";

import {
  verifyAdminAccess,
  type AdminAccessEnv
} from "./admin-auth-core";

export { verifyAdminAccess } from "./admin-auth-core";

export async function requireAdminAccess(request: Request, env: AdminAccessEnv) {
  const result = await verifyAdminAccess(request.headers, env);
  if (result.ok) return null;

  return Response.json(
    { ok: false, error: { code: result.code, message: result.message } },
    { status: result.status }
  );
}
