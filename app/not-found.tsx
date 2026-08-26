import type { Metadata } from "next";
import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Page not found"
};

const routes = [
  { href: "/", label: "Home ↗" },
  { href: "/listen", label: "Soundroom ↗" },
  { href: "/listen/archive", label: "Archive Room ↗" },
  { href: "/read", label: "Read ↗" },
  { href: "/go-out", label: "Go out ↗" }
];

export default function NotFound() {
  return (
    <main className="notfound on-night" id="main">
      <p className="notfound__code" aria-hidden="true">404</p>
      <p className="section-kicker">Page not found</p>
      <h1>This page is not in the record.</h1>
      <p className="notfound__body">
        The link may be old, or the page may not be published yet. Every session and
        programme is kept in the Archive Room.
      </p>
      <div className="notfound__links">
        {routes.map((route) => (
          <SiteLink className="link-quiet" href={sitePath(route.href)} key={route.href}>
            {route.label}
          </SiteLink>
        ))}
      </div>
    </main>
  );
}
