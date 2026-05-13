import Link from "next/link";

import { FilmCard } from "@/components/content/FilmCard";
import { HeroGallery } from "@/components/content/HeroGallery";
import { PhotoLightbox } from "@/components/media/PhotoLightbox";
import { getFeaturedPhotos, getHeroPhotos, getPublishedFilms } from "@/content";

export default function HomePage() {
  const heroPhotos = getHeroPhotos();
  const films = getPublishedFilms();
  const featuredPhotos = getFeaturedPhotos();

  return (
    <>
      <HeroGallery photos={heroPhotos} />

      <section className="section">
        <div className="page-shell">
          <div className="section-header">
            <div>
              <h2>Film rolls</h2>
              <p>
                Contact sheets, selected frames, and full roll pages. The archive starts
                with one seed roll and is structured for hundreds more.
              </p>
            </div>
            <Link className="plain-link" href="/films">
              View all films
            </Link>
          </div>
          <div className="film-grid">
            {films.map((film) => (
              <FilmCard film={film} key={film.id} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page-shell">
          <div className="section-header">
            <div>
              <h2>Selected frames</h2>
              <p>
                A quiet front layer above the full archive. These are the frames allowed
                to lead the public surface.
              </p>
            </div>
            <Link className="plain-link" href="/archive">
              Open archive
            </Link>
          </div>
          <PhotoLightbox photos={featuredPhotos} />
        </div>
      </section>
    </>
  );
}
