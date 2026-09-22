import { createClient } from "@sanity/client";

const projectId = process.env.SANITY_API_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_API_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = process.env.SANITY_API_WRITE_TOKEN;
const applyChanges = process.argv.includes("--apply");

if (!projectId || !token) throw new Error("Sanity project and write token are required.");

const client = createClient({ projectId, dataset, token, apiVersion: "2026-08-24", useCdn: false });
const query = `*[_type == "mix" && defined(tracks)]{_id, _rev, tracks[]}`;
const mixes = await client.fetch(query, {}, { perspective: "raw" });
const affected = mixes.flatMap((mix) => {
  const tracks = Array.isArray(mix.tracks) ? mix.tracks : [];
  const tracksWithTimes = tracks.filter((track) => track && Object.hasOwn(track, "time"));
  return tracksWithTimes.length ? [{ ...mix, tracks, tracksWithTimes }] : [];
});

console.log(`Found ${affected.length} mix documents with timestamp fields in the ${dataset} dataset.`);
for (const mix of affected) {
  console.log(`${mix._id}: ${mix.tracksWithTimes.length} track timestamps`);
}

if (!applyChanges) {
  console.log("Dry run only. Pass --apply to remove these fields.");
} else if (affected.length > 0) {
  const transaction = client.transaction();
  for (const mix of affected) {
    const tracks = mix.tracks.map((track) => {
      if (!track || !Object.hasOwn(track, "time")) return track;
      const untimedTrack = { ...track };
      delete untimedTrack.time;
      return untimedTrack;
    });
    transaction.patch(mix._id, (patch) => patch.ifRevisionId(mix._rev).set({ tracks }));
  }
  await transaction.commit();

  const updatedMixes = await client.fetch(query, {}, { perspective: "raw" });
  const remaining = updatedMixes.reduce((count, mix) => count + (mix.tracks || []).filter((track) => track && Object.hasOwn(track, "time")).length, 0);
  if (remaining > 0) throw new Error(`${remaining} track timestamps remain after the update.`);
  console.log("Removed all track timestamp fields.");
}
