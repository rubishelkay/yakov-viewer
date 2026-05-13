import { getPublishedFilms, getPublishedPhotos } from "@/content";

export function Footer() {
  const filmCount = getPublishedFilms().length;
  const photoCount = getPublishedPhotos().length;

  return (
    <footer className="site-footer">
      <div className="page-shell site-footer__inner">
        <span>Yakov Shmol</span>
        <span>
          {filmCount} film roll{filmCount === 1 ? "" : "s"} / {photoCount} published frames
        </span>
      </div>
    </footer>
  );
}
