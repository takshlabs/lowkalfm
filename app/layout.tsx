import type { Metadata, Viewport } from "next";
import { Archivo_Narrow, IBM_Plex_Mono, Newsreader } from "next/font/google";
import { AudioProvider } from "@/components/AudioProvider";
import { PersistentPlayer } from "@/components/PersistentPlayer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const display = Archivo_Narrow({
  variable: "--font-lowkal-display",
  subsets: ["latin"],
  weight: ["400", "500"]
});

const editorial = Newsreader({
  variable: "--font-lowkal-editorial",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"]
});

const mono = IBM_Plex_Mono({
  variable: "--font-lowkal-mono",
  subsets: ["latin"],
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lowkal.fm"),
  title: {
    default: "Lowkal.fm — The city has a frequency",
    template: "%s · Lowkal.fm"
  },
  description: "Independent community radio, stories and city culture from Bengaluru.",
  openGraph: {
    type: "website",
    siteName: "Lowkal.fm",
    title: "Lowkal.fm — The city has a frequency",
    description: "Independent community radio, stories and city culture from Bengaluru.",
    images: [{ url: "/og.png", width: 1728, height: 910, alt: "Lowkal.fm — Listen, Read, Go Out" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Lowkal.fm — The city has a frequency",
    description: "Independent community radio, stories and city culture from Bengaluru.",
    images: ["/og.png"]
  },
  icons: {
    icon: "/lowkal-logo.jpg",
    shortcut: "/lowkal-logo.jpg"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f1ece1"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${editorial.variable} ${mono.variable}`}>
        <AudioProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
          <PersistentPlayer />
        </AudioProvider>
      </body>
    </html>
  );
}
