"use client";

import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";
import { usePathname } from "next/navigation";

const links = [
  { href: "/listen", label: "Listen" },
  { href: "/read", label: "Read" },
  { href: "/go-out", label: "Go out" }
];

export function SiteHeader() {
  const pathname = usePathname();

  if (pathname.startsWith(sitePath("/studio"))) return null;

  return (
    <header className="site-header">
      <SiteLink className="brand-lockup" href={sitePath("/")} aria-label="Lowkal FM home">
        <MediaFrame variant="mark" src={sitePath("/lowkal-logo.jpg")} alt="" width={52} height={52} priority />
        <span className="brand-name">LOWKAL.FM</span>
      </SiteLink>
      <span className="brand-scripts" aria-hidden="true">लोकल · ಲೋಕಲ್ · লোকাল</span>
      <nav className="header-nav" aria-label="Primary navigation">
        {links.map((link) => {
          const href = sitePath(link.href);
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return <SiteLink href={href} aria-current={active ? "page" : undefined} key={link.href}>{link.label}</SiteLink>;
        })}
      </nav>
    </header>
  );
}
