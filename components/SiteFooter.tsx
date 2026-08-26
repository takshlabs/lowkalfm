"use client";

import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";
import { usePathname } from "next/navigation";

const siteLinks = [
  { href: "/listen", label: "Soundroom" },
  { href: "/listen/archive", label: "Archive Room" },
  { href: "/read", label: "Read" },
  { href: "/go-out", label: "Go out" }
];

const elsewhere = [
  { href: "https://www.instagram.com/lowkal.fm/", label: "Instagram" },
  { href: "https://www.youtube.com/@takezodj", label: "YouTube" },
  { href: "mailto:hello@lowkal.fm", label: "Contact" }
];

export function SiteFooter() {
  const pathname = usePathname();

  if (pathname.startsWith(sitePath("/studio"))) return null;

  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div className="site-footer__lead">
          <span className="footer-mark">LOWKAL.FM</span>
          <p>Multi-genre. Low-end focused. From Bengaluru.</p>
        </div>

        <nav className="site-footer__nav" aria-label="Footer navigation">
          {siteLinks.map((link) => (
            <SiteLink className="link-quiet" href={sitePath(link.href)} key={link.href}>
              {link.label}
            </SiteLink>
          ))}
          {elsewhere.map((link) => (
            <a
              className="link-quiet"
              href={link.href}
              key={link.href}
              {...(link.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="site-footer__base label label--sm">
        <span>© 2026 Lowkal.fm</span>
        <span>Bengaluru, India</span>
      </div>
    </footer>
  );
}
