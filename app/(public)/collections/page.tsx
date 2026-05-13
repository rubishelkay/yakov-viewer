import type { Metadata } from "next";

import { getPublishedCollections } from "@/content";

export const metadata: Metadata = {
  title: "Collections",
  description: "Curated selections from Yakov Shmol's archive."
};

export default function CollectionsPage() {
  const collections = getPublishedCollections();

  return (
    <div className="page-shell">
      <header className="page-title">
        <h1>Collections</h1>
        <p>Curated selections will grow as the archive is edited.</p>
      </header>
      <div className="film-grid">
        {collections.map((collection) => (
          <article className="film-card" key={collection.id}>
            <div>
              <h3>{collection.title}</h3>
              <p>{collection.description}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
