import type { ComponentPropsWithoutRef } from "react";

type SiteLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
};

export function SiteLink({ children, href, ...props }: SiteLinkProps) {
  return <a href={href} {...props}>{children}</a>;
}
