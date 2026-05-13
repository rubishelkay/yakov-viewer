import Link from "next/link";

import { siteConfig } from "@/lib/site";

import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand" aria-label="Yakov Shmol home">
          {siteConfig.name}
        </Link>
        <nav className="nav" aria-label="Primary navigation">
          {siteConfig.nav.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
