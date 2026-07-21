import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { AdminArchiveProvider } from "@/admin/admin-state";
import { AdminShell } from "@/components/admin/AdminShell";
import { verifyAdminAccess } from "@/server/cloudflare/admin-auth";
import "@/styles/admin.css";

export const metadata: Metadata = {
  title: {
    default: "Admin - Yakov Viewer",
    template: "%s - Yakov Admin"
  },
  description: "Private archive workspace for Yakov Shmol photo portfolio."
};

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { env } = await getCloudflareContext({ async: true });
  const requestHeaders = await headers();
  const access = await verifyAdminAccess(requestHeaders, env);
  if (!access.ok) notFound();

  return (
    <AdminArchiveProvider>
      <AdminShell>{children}</AdminShell>
    </AdminArchiveProvider>
  );
}
