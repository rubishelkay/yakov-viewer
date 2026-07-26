import { PortfolioIndex } from "@/components/portfolio/PortfolioIndex";
import { readPublicHomepageAlbums } from "@/server/cloudflare/public-portfolio-d1";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const albums = await readPublicHomepageAlbums();
  return <PortfolioIndex albums={albums} hero heroAlbums={albums.slice(0, 5)} />;
}
