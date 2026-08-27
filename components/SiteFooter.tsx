"use client";

import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();

  if (pathname.startsWith(sitePath("/studio"))) return null;

  return (
    <footer className="site-footer">
      <div className="site-footer-lead">
        <span className="footer-mark">LOWKAL.FM</span>
        <p>From Bengaluru.</p>
      </div>
      <nav aria-label="Footer navigation">
        <SiteLink href={sitePath("/listen")}>Soundroom</SiteLink>
        <SiteLink href={sitePath("/listen/archive")}>Archive Room</SiteLink>
        <SiteLink href={sitePath("/read")}>Read</SiteLink>
        <SiteLink href={sitePath("/go-out")}>Go out</SiteLink>
        <a href="https://www.instagram.com/lowkal.fm/" target="_blank" rel="noreferrer">Instagram</a>
        <a href="https://www.youtube.com/@takezodj" target="_blank" rel="noreferrer">YouTube</a>
        <a href="mailto:hello@lowkal.fm">Contact</a>
      </nav>
      <small>© 2026 Lowkal.fm</small>
    </footer>
  );
}
