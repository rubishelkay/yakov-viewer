import type { Metadata } from "next";

import { PhotoLightbox } from "@/components/media/PhotoLightbox";
import { getPublishedPhotos } from "@/content";

export const metadata: Metadata = {
  title: "Archive",
  description: "The full public index of published photographs."
};

export default function ArchivePage() {
  const photos = getPublishedPhotos();

  return (
    <div className="page-shell">
      <header className="page-title">
        <h1>Archive</h1>
        <p>
          Everything published, in one quiet index. The dense view is built for speed:
          small responsive thumbnails first, larger frames only when opened.
        </p>
      </header>

      <PhotoLightbox photos={photos} dense />
    </div>
  );
}
