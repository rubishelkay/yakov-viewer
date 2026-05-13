import type { Metadata } from "next";

import { FilmCard } from "@/components/content/FilmCard";
import { getPublishedFilms } from "@/content";

export const metadata: Metadata = {
  title: "Films",
  description: "Published film rolls from Yakov Shmol's photographic archive."
};

export default function FilmsPage() {
  const films = getPublishedFilms();

  return (
    <div className="page-shell">
      <header className="page-title">
        <h1>Films</h1>
        <p>
          Each roll is treated as a small sequence: metadata, contact sheet, selected
          frames, and a slower vertical reading mode.
        </p>
      </header>

      <div className="film-grid">
        {films.map((film) => (
          <FilmCard film={film} key={film.id} />
        ))}
      </div>
    </div>
  );
}
