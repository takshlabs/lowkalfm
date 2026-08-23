import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <span className="footer-mark">LOWKAL.FM</span>
        <p>Independent community radio, stories and city culture from Bengaluru.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/listen">Soundroom</Link>
        <Link href="/read">Journal</Link>
        <Link href="/go-out">City guide</Link>
        <a href="mailto:hello@lowkal.fm">Contact</a>
      </nav>
    </footer>
  );
}
