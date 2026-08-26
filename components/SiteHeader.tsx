"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";
import { usePathname } from "next/navigation";

const links = [
  { href: "/listen", label: "Soundroom" },
  { href: "/listen/archive", label: "Archive" },
  { href: "/read", label: "Read" },
  { href: "/go-out", label: "Go out" }
];

export function SiteHeader() {
  const pathname = usePathname();
  const [isStuck, setStuck] = useState(false);
  const [progress, setProgress] = useState(0);

  /**
   * One passive scroll listener drives both the stuck state and the reading
   * progress rule. The work is done inside a frame callback so a fast scroll
   * cannot queue more style writes than the browser can paint.
   */
  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const scrolled = window.scrollY;
      const range = document.documentElement.scrollHeight - window.innerHeight;
      setStuck(scrolled > 8);
      setProgress(range > 0 ? Math.min(1, scrolled / range) : 0);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (pathname.startsWith(sitePath("/studio"))) return null;

  const headerStyle = { "--scroll-progress": progress } as CSSProperties;

  return (
    <header className={`site-header${isStuck ? " is-stuck" : ""}`} style={headerStyle}>
      <SiteLink className="brand-lockup" href={sitePath("/")} aria-label="Lowkal FM home">
        <MediaFrame variant="mark" src={sitePath("/lowkal-logo.jpg")} alt="" width={38} height={38} priority />
        <span className="brand-name">LOWKAL.FM</span>
      </SiteLink>

      <span className="brand-scripts" aria-hidden="true">लोकल / ಲೋಕಲ್ / লোকাল</span>

      <nav className="header-nav" aria-label="Primary navigation">
        {links.map((link) => {
          const href = sitePath(link.href);
          const active = link.href === "/listen"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <SiteLink href={href} aria-current={active ? "page" : undefined} key={link.href}>
              {link.label}
            </SiteLink>
          );
        })}
      </nav>

      <span className="site-header__progress" aria-hidden="true" />
    </header>
  );
}
