"use client";

import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();

  if (pathname.startsWith(sitePath("/studio"))) return null;

  return (
    <footer className="site-footer">
      <div>
        <span className="footer-mark">LOWKAL.FM</span>
        <p>Independent community radio, stories and city culture from Bengaluru.</p>
      </div>
      <nav aria-label="Footer navigation">
        <SiteLink href={sitePath("/listen")}>Soundroom</SiteLink>
        <SiteLink href={sitePath("/read")}>Journal</SiteLink>
        <SiteLink href={sitePath("/go-out")}>City guide</SiteLink>
        <a href="mailto:hello@lowkal.fm">Contact</a>
      </nav>
    </footer>
  );
}
