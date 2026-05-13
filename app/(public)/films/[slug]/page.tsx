import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AlbumViewer } from "@/components/media/AlbumViewer";
import { getFilmBySlug, getPhotoById, getPhotosForFilm, getPublishedFilms } from "@/content";
import { getImageUrl } from "@/lib/images";

export const dynamicParams = false;

type FilmPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getPublishedFilms().map((film) => ({ slug: film.slug }));
}

export async function generateMetadata({ params }: FilmPageProps): Promise<Metadata> {
  const { slug } = await params;
  const film = getFilmBySlug(slug);

  if (!film) {
    return {};
  }
  const cover = getPhotoById(film.coverImageId);

  return {
    title: film.title,
    description: film.description,
    openGraph: {
      title: film.title,
      description: film.description,
      images: cover ? [{ url: getImageUrl(cover, 1200), width: 1200, height: 800 }] : undefined
    }
  };
}

export default async function FilmPage({ params }: FilmPageProps) {
  const { slug } = await params;
  const film = getFilmBySlug(slug);

  if (!film) {
    notFound();
  }

  const photos = getPhotosForFilm(film.id);

  return (
    <div className="page-shell">
      <header className="page-title">
        <h1>{film.title}</h1>
        <p>{film.description}</p>
        <div className="tag-row" aria-label="Film metadata">
          <span className="tag">{film.location.city}</span>
          <span className="tag">{film.year}</span>
          <span className="tag">{film.filmStock}</span>
          <span className="tag">{film.camera}</span>
        </div>
      </header>

      <AlbumViewer photos={photos} />
    </div>
  );
}
