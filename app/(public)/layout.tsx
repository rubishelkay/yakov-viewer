import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { readPublicAlbums } from "@/server/cloudflare/public-portfolio-d1";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const albums = await readPublicAlbums();
  return (
    <div className="portfolio-site">
      <PortfolioHeader albums={albums} />
      {children}
    </div>
  );
}
