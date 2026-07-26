import type { Metadata } from "next";

import { PortfolioIndex } from "@/components/portfolio/PortfolioIndex";
import { readPublicAlbums } from "@/server/cloudflare/public-portfolio-d1";

export const metadata: Metadata = {
  title: "Albums"
};

export const dynamic = "force-dynamic";

export default async function AlbumsPage() {
  return <PortfolioIndex albums={await readPublicAlbums()} />;
}
