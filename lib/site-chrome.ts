import { sitePath } from "@/lib/site-path";

const UNLISTED_PREFIXES = ["/studio", "/desk"];

export function isUnlistedPath(pathname: string | null) {
  if (!pathname) return false;
  return UNLISTED_PREFIXES.some((prefix) => {
    const href = sitePath(prefix);
    return pathname === href || pathname.startsWith(`${href}/`);
  });
}
