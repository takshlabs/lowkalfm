import { handleListenCounts } from "../workers/listen-counts.ts";

const env = {
  SANITY_API_PROJECT_ID: process.env.SANITY_API_PROJECT_ID,
  SANITY_API_DATASET: process.env.SANITY_API_DATASET,
  SANITY_API_WRITE_TOKEN: process.env.SANITY_API_WRITE_TOKEN,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY
};
for (const key of ["SANITY_API_PROJECT_ID", "SANITY_API_DATASET", "SANITY_API_WRITE_TOKEN"]) {
  if (!env[key]) throw new Error(`Missing ${key}`);
}
const url = new URL(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/query/${env.SANITY_API_DATASET}`);
url.searchParams.set("perspective", "published");
url.searchParams.set("query", '*[_type == "mix" && published == true && parked != true]{"slug":slug.current}');
const response = await fetch(url, { headers: { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}` } });
if (!response.ok) throw new Error(`Catalogue query failed: ${response.status}`);
const { result: mixes } = await response.json();
for (const { slug } of mixes) {
  const result = await handleListenCounts(new Request(`https://lowkal-audio-sync.lowkal-audio-737a.workers.dev/listen-counts?mix=${encodeURIComponent(slug)}`), env);
  if (!result.ok) throw new Error(`Count refresh failed for ${slug}: ${result.status}`);
  console.log(JSON.stringify(await result.json()));
}
