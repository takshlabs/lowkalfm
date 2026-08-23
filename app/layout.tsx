import type { Metadata, Viewport } from "next";
import { Lancelot, Marcellus, Notable, Philosopher } from "next/font/google";
import { AudioProvider } from "@/components/AudioProvider";
import { PersistentPlayer } from "@/components/PersistentPlayer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { sitePath } from "@/lib/site-path";
import "./globals.css";

export const dynamic = "force-static";

const display = Lancelot({
  variable: "--font-lowkal-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap"
});

const editorial = Marcellus({
  variable: "--font-lowkal-editorial",
  subsets: ["latin"],
  weight: "400",
  display: "swap"
});

const body = Philosopher({
  variable: "--font-lowkal-body",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap"
});

const accent = Notable({
  variable: "--font-lowkal-accent",
  subsets: ["latin"],
  weight: "400",
  display: "swap"
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
    icon: sitePath("/lowkal-logo.jpg"),
    shortcut: sitePath("/lowkal-logo.jpg")
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
      <body className={`${display.variable} ${editorial.variable} ${body.variable} ${accent.variable}`}>
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
