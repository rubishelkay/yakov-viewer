import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { AdminArchiveProvider } from "@/admin/admin-state";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminAccessEnabled, isLocalAdminHost } from "@/server/cloudflare/admin-auth";
import "@/styles/admin.css";

export const metadata: Metadata = {
  title: {
    default: "Admin - Yakov Viewer",
    template: "%s - Yakov Admin"
  },
  description: "Private archive workspace for Yakov Shmol photo portfolio."
};

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!isLocalAdminHost(host)) {
    const enabled = isAdminAccessEnabled(process.env.ADMIN_ACCESS_ENABLED);
    const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const authenticatedEmail = requestHeaders
      .get("cf-access-authenticated-user-email")
      ?.trim()
      .toLowerCase();

    if (!enabled || !expectedEmail || authenticatedEmail !== expectedEmail) notFound();
  }

  return (
    <AdminArchiveProvider>
      <AdminShell>{children}</AdminShell>
    </AdminArchiveProvider>
  );
}
