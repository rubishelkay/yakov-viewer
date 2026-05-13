import Link from "next/link";

import type { Photo } from "@/content/schema";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";

type HeroGalleryProps = {
  photos: Photo[];
};

export function HeroGallery({ photos }: HeroGalleryProps) {
  return (
    <section className="hero" aria-label="Featured photo albums">
      <div className="page-shell hero-track">
        {photos.map((photo, index) => (
          <Link className="hero-slide" href={`/photos/${photo.slug}`} key={photo.id}>
            <ResponsiveImage
              photo={photo}
              preset="hero"
              sizes="(min-width: 1000px) 88vw, 94vw"
              priority={index === 0}
            />
            <div className="hero-copy">
              {index === 0 ? <h1>Yakov Shmol</h1> : <h2>{photo.title}</h2>}
              <p>
                {index === 0
                  ? "A photographic archive of film rolls, selected frames, and quiet digital notes."
                  : `${photo.location.city} / ${photo.filmStock}`}
              </p>
              <span className="hero-action">View frame</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
