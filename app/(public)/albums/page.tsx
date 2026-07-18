import type { Metadata } from "next";

import { PortfolioIndex } from "@/components/portfolio/PortfolioIndex";

export const metadata: Metadata = {
  title: "Albums"
};

export default function AlbumsPage() {
  return <PortfolioIndex />;
}
