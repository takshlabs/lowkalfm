import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { isProjectDeployment } from "@/lib/site-path";

type SiteLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
};

export function SiteLink({ children, href, ...props }: SiteLinkProps) {
  if (isProjectDeployment) {
    return <a href={href} {...props}>{children}</a>;
  }

  return <Link href={href} {...props}>{children}</Link>;
}
