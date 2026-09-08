import type { Metadata } from "next";
import { LinkDesk } from "@/components/LinkDesk";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Lowkal",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

export default function DeskPage() {
  return <LinkDesk />;
}
