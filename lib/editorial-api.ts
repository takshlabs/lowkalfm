const editorialApiBase = process.env.NEXT_PUBLIC_EDITORIAL_API_URL?.replace(/\/$/, "");

export function editorialApi(path: string) {
  if (!editorialApiBase) return path;
  return `${editorialApiBase}${path.replace(/^\/api/, "")}`;
}
