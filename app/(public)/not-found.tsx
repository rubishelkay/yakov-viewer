export default function NotFoundPage() {
  return (
    <div className="text-shell">
      <header className="page-title">
        <h1>Not found</h1>
        <p>This frame is not part of the public archive.</p>
        {/* A document navigation lets Cloudflare serve the cached public HTML. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="plain-link" href="/albums">Return to albums</a>
      </header>
    </div>
  );
}
