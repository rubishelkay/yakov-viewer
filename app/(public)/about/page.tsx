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
          Yakov Shmol is building a public photographic archive: film rolls, digital
          notes, selected work, and individual frames presented with enough quiet for
          the photographs to stay in front.
        </p>
      </header>

      <section className="section">
        <p className="meta-line">
          The first release is intentionally simple: no accounts, no comments, no admin
          surface. The structure is ready for a larger archive, future upload tooling,
          and the private Logjamming backstage workflow.
        </p>
      </section>
    </div>
  );
}
