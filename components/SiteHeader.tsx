"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/listen", label: "Listen" },
  { href: "/read", label: "Read" },
  { href: "/go-out", label: "Go out" }
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <Link className="brand-lockup" href="/" aria-label="Lowkal FM home">
        <Image src="/lowkal-logo.jpg" alt="" width={52} height={52} priority />
        <span className="brand-name">LOWKAL.FM</span>
      </Link>
      <span className="brand-scripts" aria-hidden="true">लोकल · ಲೋಕಲ್ · লোকাল</span>
      <nav className="header-nav" aria-label="Primary navigation">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return <Link href={link.href} aria-current={active ? "page" : undefined} key={link.href}>{link.label}</Link>;
        })}
      </nav>
    </header>
  );
}
