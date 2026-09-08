import { sitePath } from "@/lib/site-path";

const UNLISTED_PREFIXES = ["/studio", "/desk"];
const UNLISTED_ROUTES = ["/listen"];

export function isUnlistedPath(pathname: string | null) {
  if (!pathname) return false;
  if (UNLISTED_ROUTES.some((route) => pathname === sitePath(route))) return true;
  return UNLISTED_PREFIXES.some((prefix) => {
    const href = sitePath(prefix);
    return pathname === href || pathname.startsWith(`${href}/`);
  });
}
