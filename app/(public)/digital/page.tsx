import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Digital",
  description: "Future digital series for Yakov Shmol's archive."
};

export default function DigitalPage() {
  return (
    <div className="text-shell">
      <header className="page-title">
        <h1>Digital</h1>
        <p>
          Digital series will live here after the first public film archive is stable.
          The data model already supports digital photographs as first-class entries.
        </p>
      </header>
    </div>
  );
}
