import { SanityStudio } from "@/components/SanityStudio";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ tool: [] }];
}

export default function StudioPage() {
  return <SanityStudio />;
}
