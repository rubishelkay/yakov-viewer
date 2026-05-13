import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import { getFilmById, getPhotoBySlug, getPublishedPhotos } from "@/content";
import { getImageUrl } from "@/lib/images";

export const dynamicParams = false;

type PhotoPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getPublishedPhotos().map((photo) => ({ slug: photo.slug }));
}

export async function generateMetadata({ params }: PhotoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const photo = getPhotoBySlug(slug);

  if (!photo) {
    return {};
  }

  return {
    title: photo.title,
    description: photo.description || photo.alt,
    openGraph: {
      title: photo.title,
      description: photo.description || photo.alt,
      type: "article",
      images: [{ url: getImageUrl(photo, 1200), width: 1200, height: 800 }]
    }
  };
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { slug } = await params;
  const photo = getPhotoBySlug(slug);

  if (!photo) {
    notFound();
  }

  const film = photo.filmId ? getFilmById(photo.filmId) : undefined;

  return (
    <div className="page-shell photo-page">
      <div className="photo-page__image">
        <ResponsiveImage
          photo={photo}
          preset="detail"
          sizes="(min-width: 1100px) 68vw, 100vw"
          priority
        />
      </div>

      <aside className="photo-page__meta">
        <div>
          <h1>{photo.title}</h1>
          {photo.description ? <p className="meta-line">{photo.description}</p> : null}
        </div>

        <ul className="meta-list">
          <li>
            <span>Date</span>
            <strong>{photo.dateTaken}</strong>
          </li>
          <li>
            <span>Location</span>
            <strong>{photo.location.city}</strong>
          </li>
          <li>
            <span>Camera</span>
            <strong>{photo.camera}</strong>
          </li>
          <li>
            <span>Film</span>
            <strong>{photo.filmStock}</strong>
          </li>
          <li>
            <span>Frame</span>
            <strong>{photo.frameNumber ? String(photo.frameNumber).padStart(2, "0") : "Digital"}</strong>
          </li>
        </ul>

        <div className="tag-row">
          {photo.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        {film ? (
          <Link className="plain-link" href={`/films/${film.slug}`}>
            Back to {film.shortTitle}
          </Link>
        ) : null}

        {photo.rights.downloadAllowed && photo.rights.downloadUrl ? (
          <a className="button-link" href={photo.rights.downloadUrl} download>
            Download large file
          </a>
        ) : null}
      </aside>
    </div>
  );
}
