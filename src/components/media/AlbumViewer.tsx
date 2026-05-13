"use client";

import { Grid2X2, Rows3 } from "lucide-react";
import { useState } from "react";

import type { Photo } from "@/content/schema";

import { PhotoLightbox } from "./PhotoLightbox";
type AlbumViewerProps = {
  photos: Photo[];
};

type ViewMode = "scroll" | "grid";

export function AlbumViewer({ photos }: AlbumViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("scroll");

  return (
    <section>
      <div className="album-toolbar" aria-label="Album display controls">
        <span className="album-toolbar__meta">{photos.length} frames / display</span>
        <div className="segmented" role="group" aria-label="Choose album view">
          <button
            type="button"
            aria-pressed={viewMode === "scroll"}
            onClick={() => setViewMode("scroll")}
          >
            <Rows3 aria-hidden="true" size={16} /> Scroll
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
          >
            <Grid2X2 aria-hidden="true" size={16} /> Contact
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <PhotoLightbox photos={photos} dense />
      ) : (
        <PhotoLightbox photos={photos} layout="scroll" />
      )}
    </section>
  );
}
