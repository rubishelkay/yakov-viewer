import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { getPublicAlbums } from "@/lib/portfolio";

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="portfolio-site">
      <PortfolioHeader albums={getPublicAlbums()} />
      {children}
    </div>
  );
}
