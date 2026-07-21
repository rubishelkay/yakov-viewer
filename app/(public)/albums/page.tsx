import type { Metadata } from "next";

import { PortfolioIndex } from "@/components/portfolio/PortfolioIndex";
import { getPublicAlbums } from "@/lib/portfolio";

export const metadata: Metadata = {
  title: "Albums"
};

export default function AlbumsPage() {
  return <PortfolioIndex albums={getPublicAlbums()} />;
}
