import type { Metadata, Viewport } from "next";
import { AudioProvider } from "@/components/AudioProvider";
import { ListenContentProvider } from "@/components/ListenContentProvider";
import { PersistentPlayer } from "@/components/PersistentPlayer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { sitePath } from "@/lib/site-path";
import "./globals.css";
import "./reimagined.css";
import "./home-transmissions.css";
import "./design-polish.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  metadataBase: new URL("https://lowkalfm.in"),
  title: "Lowkal.fm",
  openGraph: {
    type: "website",
    siteName: "Lowkal.fm",
    title: "Lowkal.fm",
    images: [{ url: "/lowkal-logo.jpg", width: 1000, height: 1000, alt: "Lowkal.fm" }]
  },
  twitter: {
    card: "summary",
    title: "Lowkal.fm",
    images: ["/lowkal-logo.jpg"]
  },
  icons: {
    icon: sitePath("/lowkal-logo.jpg"),
    shortcut: sitePath("/lowkal-logo.jpg")
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
