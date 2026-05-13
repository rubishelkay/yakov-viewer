import Link from "next/link";

import { getPhotoById, getPhotosForFilm } from "@/content";
import type { Film } from "@/content/schema";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";

type FilmCardProps = {
  film: Film;
};

export function FilmCard({ film }: FilmCardProps) {
  const cover = getPhotoById(film.coverImageId);
  const frameCount = getPhotosForFilm(film.id).length;

  return (
    <Link className="film-card" href={`/films/${film.slug}`}>
      {cover ? (
        <div className="film-card__media">
          <ResponsiveImage
            photo={cover}
            preset="grid"
            sizes="(min-width: 1100px) 31vw, (min-width: 720px) 48vw, 100vw"
          />
        </div>
      ) : null}
      <div className="film-card__body">
        <div>
          <h3>{film.title}</h3>
          <p>
            {film.location.city}, {film.year} / {film.filmStock}
          </p>
        </div>
        <span className="tag">{frameCount} frames</span>
      </div>
    </Link>
  );
}
