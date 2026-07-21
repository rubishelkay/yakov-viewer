import { PortfolioIndex } from "@/components/portfolio/PortfolioIndex";
import { getHomepageAlbums, getHeroAlbums } from "@/lib/portfolio";

export default function HomePage() {
  return <PortfolioIndex albums={getHomepageAlbums()} hero heroAlbums={getHeroAlbums()} />;
}
