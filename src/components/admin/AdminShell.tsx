"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  CircleX,
  Database,
  Gauge,
  ImagePlus,
  Images,
  Layers3,
  Settings,
  Tags
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/sets", label: "Sets", icon: Layers3 },
  { href: "/admin/albums", label: "Albums", icon: ImagePlus },
  { href: "/admin/photos", label: "Photos", icon: Images },
  { href: "/admin/tags", label: "Tags", icon: Tags },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/bin", label: "Bin", icon: CircleX }
];

export function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="admin-shell">
      <div className="admin-mobile-warning" role="status">
        Admin MVP is desktop-first. Scroll sideways on narrow screens.
      </div>
      <aside className="admin-rail" aria-label="Admin navigation">
        <Link className="admin-rail__brand" href="/admin" aria-label="Yakov admin dashboard">
          <Archive aria-hidden />
          <span>
            Yakov
            <small>Archive</small>
          </span>
        </Link>

        <nav className="admin-rail__nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className="admin-rail__link"
                data-active={active ? "true" : undefined}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-rail__status">
          <Database aria-hidden />
          <span>Cloudflare-ready</span>
        </div>
      </aside>

      <div className="admin-stage">{children}</div>
    </div>
  );
}
