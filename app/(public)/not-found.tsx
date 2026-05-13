import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="text-shell">
      <header className="page-title">
        <h1>Not found</h1>
        <p>This frame is not part of the public archive.</p>
        <Link className="plain-link" href="/archive">
          Return to archive
        </Link>
      </header>
    </div>
  );
}
