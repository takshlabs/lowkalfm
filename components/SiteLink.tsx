import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";

type SiteLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
};

export function SiteLink({ children, href, ...props }: SiteLinkProps) {
  return <Link href={href} {...props}>{children}</Link>;
}
