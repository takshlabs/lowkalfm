import type { Metadata, Viewport } from "next";
import { AudioProvider } from "@/components/AudioProvider";
import { ListenContentProvider } from "@/components/ListenContentProvider";
import { PersistentPlayer } from "@/components/PersistentPlayer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { sitePath } from "@/lib/site-path";
import "./globals.css";
import "./reimagined.css";

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ListenContentProvider>
          <AudioProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
            <PersistentPlayer />
          </AudioProvider>
        </ListenContentProvider>
      </body>
    </html>
  );
}
