import Link from "next/link";

import type { LocalAdminArchive, LocalArchiveAlbum } from "@/admin/admin-state";
import { getAlbumSubtitleTags } from "@/lib/portfolio";

export function PortfolioTagLinks({
  album,
  archive,
  count
}: {
  album: LocalArchiveAlbum;
  archive: LocalAdminArchive;
  count?: number;
}) {
  const segments = getAlbumSubtitleTags(archive, album);

  return (
    <>
      {segments.map(({ label, tag }, index) => (
        <span className="portfolio-tag-segment" key={`${label}-${index}`}>
          {index ? ", " : ""}
          {tag ? <Link href={`/tags/${tag.slug}`}>{label}</Link> : label}
        </span>
      ))}
      {count !== undefined ? <span className="portfolio-tag-count"> · {count}</span> : null}
    </>
  );
}
