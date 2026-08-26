import type { Metadata, Viewport } from "next";
import { AudioProvider } from "@/components/AudioProvider";
import { PersistentPlayer } from "@/components/PersistentPlayer";
import { SiteChrome } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { sitePath } from "@/lib/site-path";
import "./globals.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  metadataBase: new URL("https://lowkal.fm"),
  title: {
    default: "Lowkal.fm — Multi-genre. Low-end focused. From Bengaluru.",
    template: "%s · Lowkal.fm"
  },
  description: "Multi-genre, low-end-focused sessions and programmes from Bengaluru.",
  openGraph: {
    type: "website",
    siteName: "Lowkal.fm",
    title: "Lowkal.fm — Multi-genre. Low-end focused.",
    description: "Sessions, programmes, and gatherings from Bengaluru.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Lowkal.fm — Multi-genre. Low-end focused. From Bengaluru." }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Lowkal.fm — Multi-genre. Low-end focused.",
    description: "Sessions, programmes, and gatherings from Bengaluru.",
    images: ["/og.png"]
  },
  icons: {
    icon: sitePath("/lowkal-logo.jpg"),
    shortcut: sitePath("/lowkal-logo.jpg")
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e0e0d"
};

/**
 * The two faces that draw first paint. Preloading them removes the flash of
 * fallback type on the stage headline and the wordmark.
 */
const criticalFonts = ["/fonts/lancelot-400-latin.woff2", "/fonts/philosopher-400-latin.woff2"];

const organisation = {
  "@context": "https://schema.org",
  "@type": "MusicGroup",
  name: "Lowkal.fm",
  url: "https://lowkal.fm",
  description: "Multi-genre, low-end-focused sessions and programmes from Bengaluru.",
  foundingLocation: { "@type": "Place", name: "Bengaluru, India" },
  genre: ["Multi-genre", "Bass", "Drum and bass", "Breaks", "Footwork"],
  sameAs: ["https://www.instagram.com/lowkal.fm/", "https://www.youtube.com/@takezodj"]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {criticalFonts.map((font) => (
          <link
            key={font}
            rel="preload"
            as="font"
            type="font/woff2"
            href={sitePath(font)}
            crossOrigin="anonymous"
          />
        ))}
        <script
          type="application/ld+json"
          // The payload is a fixed object defined in this file, not user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organisation) }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <AudioProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
          <PersistentPlayer />
        </AudioProvider>
        <SiteChrome />
      </body>
    </html>
  );
}
