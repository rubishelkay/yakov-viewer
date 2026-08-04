import type { ReactNode } from "react";

import { Layout } from "./components/Layout";
import { AccountPage } from "./pages/AccountPage";
import { AlbumFeedPage } from "./pages/AlbumFeedPage";
import { CatalogPage } from "./pages/CatalogPage";
import { CurationEditorPage } from "./pages/CurationEditorPage";
import { useRouter } from "./router";

export function App() {
  const { pathname } = useRouter();
  const albumMatch = pathname.match(/^\/albums\/([^/]+)\/?$/);
  const curationMatch = pathname.match(/^\/account\/curations\/([^/]+)\/?$/);
  let page: ReactNode;
  if (albumMatch) page = <AlbumFeedPage slug={decodePathSegment(albumMatch[1])} />;
  else if (curationMatch) page = <CurationEditorPage id={decodePathSegment(curationMatch[1])} />;
  else if (pathname === "/account" || pathname === "/account/") page = <AccountPage />;
  else page = <CatalogPage />;
  return <Layout>{page}</Layout>;
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
