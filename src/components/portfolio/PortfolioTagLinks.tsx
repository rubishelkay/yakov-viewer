import Link from "next/link";

import type { PublicAlbumSummary } from "@/lib/portfolio";

export function PortfolioTagLinks({
  album,
  count
}: {
  album: PublicAlbumSummary;
  count?: number;
}) {
  return (
    <>
      {album.subtitleTags.map(({ label, slug }, index) => (
        <span className="portfolio-tag-segment" key={`${label}-${index}`}>
          {index ? ", " : ""}
          {slug ? <Link href={`/tags/${slug}`}>{label}</Link> : label}
        </span>
      ))}
      {count !== undefined ? <span className="portfolio-tag-count"> · {count}</span> : null}
    </>
  );
}
