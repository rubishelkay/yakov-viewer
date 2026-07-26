import { AdminArchiveProvider } from "@/admin/admin-state";

export default function LocalAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminArchiveProvider>{children}</AdminArchiveProvider>;
}
