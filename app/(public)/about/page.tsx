import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "About Yakov Shmol's photographic archive."
};

export default function AboutPage() {
  return (
    <div className="text-shell">
      <header className="page-title">
        <h1>About</h1>
        <p>
          Yakov Shmol&apos;s public photographic archive brings together film rolls and
          digital series with enough quiet for the photographs to stay in front.
        </p>
      </header>

      <section className="section">
        <p className="meta-line">
          The portfolio is managed through a private archive. Logjamming remains a
          future backstage workflow built on the same photo library.
        </p>
      </section>
    </div>
  );
}
