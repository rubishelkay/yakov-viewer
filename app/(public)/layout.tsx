import { AdminArchiveProvider } from "@/admin/admin-state";
import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminArchiveProvider>
      <div className="portfolio-site">
        <PortfolioHeader />
        {children}
      </div>
    </AdminArchiveProvider>
  );
}
