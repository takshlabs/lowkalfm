const editorialApiBase = (process.env.NEXT_PUBLIC_EDITORIAL_API_URL ?? "https://klccudkmqqnimlpebmog.supabase.co/functions/v1/lowkal-editorial").replace(/\/$/, "");

export function editorialApi(path: string) {
  return `${editorialApiBase}${path.replace(/^\/api/, "")}`;
}
