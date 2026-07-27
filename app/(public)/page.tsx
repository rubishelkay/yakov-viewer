import { PortfolioIndex } from "@/components/portfolio/PortfolioIndex";
import { readPublicHomepageSets } from "@/server/cloudflare/public-portfolio-d1";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sets = await readPublicHomepageSets();
  const heroAlbums = [...new Map(
    sets.flatMap((set) => set.albums).map((album) => [album.id, album])
  ).values()].slice(0, 5);

  return <PortfolioIndex hero heroAlbums={heroAlbums} sets={sets} />;
}
