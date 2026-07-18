import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getCloudflareContext().env;

  return Response.json(
    {
      ok: true,
      service: "yakov-viewer",
      runtime: "cloudflare-workers-opennext",
      bindings: {
        assets: "ASSETS" in env,
        database: "DB" in env,
        publicAssets: "PUBLIC_ASSETS" in env,
        privateAssets: "PRIVATE_ASSETS" in env
      }
    },
    {
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}
