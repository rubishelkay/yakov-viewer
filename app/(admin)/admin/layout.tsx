import type { Metadata } from "next";

import { AdminArchiveProvider } from "@/admin/admin-state";
import { AdminShell } from "@/components/admin/AdminShell";
import "@/styles/admin.css";

export const metadata: Metadata = {
  title: {
    default: "Admin - Yakov Viewer",
    template: "%s - Yakov Admin"
  },
  description: "Private archive workspace for Yakov Shmol photo portfolio."
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminArchiveProvider>
      <AdminShell>{children}</AdminShell>
    </AdminArchiveProvider>
  );
}
