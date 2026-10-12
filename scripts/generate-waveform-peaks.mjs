import { createClient } from "@sanity/client";
import { spawn } from "node:child_process";
import { generateWaveformData, wavInfo } from "../lib/waveform-data.ts";
import { readMasterInRanges } from "../lib/waveform-source.ts";

const workerBase = "https://lowkal-audio-sync.lowkal-audio-737a.workers.dev";
const client = createClient({ projectId: process.env.SANITY_API_PROJECT_ID, dataset: process.env.SANITY_API_DATASET, apiVersion: "2026-08-24", token: process.env.SANITY_API_WRITE_TOKEN, useCdn: false });
const safeSegment = value => value.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 160) || "audio";

async function putObject(key, data) {
  await new Promise((resolve, reject) => {
    const child = spawn("npx", ["wrangler", "r2", "object", "put", `lowkal-audio/${key}`, "--remote", "--pipe", "--force", "--content-type", "application/json", "--cache-control", "public, max-age=31536000, immutable"], { stdio: ["pipe", "inherit", "inherit"] });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`R2 upload failed with ${code}`)));
    child.stdin.on("error", reject);
    child.stdin.end(JSON.stringify(data));
  });
}

const slug = process.argv[2];
if (!slug) throw new Error("Usage: npm run audio:peaks -- <mix-slug|--all>");
const projection = '{_id,_rev,"slug":slug.current,"masterUrl":audio.master.asset->url,"masterSize":audio.master.asset->size,"masterFilename":audio.master.asset->originalFilename,"masterId":audio.master.asset._ref,"deliveryUrl":audio.deliveryUrl,"peaksUrl":audio.peaksUrl}';
const mixes = await client.fetch(`*[_type == "mix" && !(_id in path("drafts.**")) && defined(audio.deliveryUrl) && ($all || slug.current == $slug)]${projection}`, { all: slug === "--all", slug });
if (!mixes.length) throw new Error("No published direct-audio mixes found");
for (const mix of mixes) {
  if (!mix.masterUrl || !mix.masterId) throw new Error(`${mix.slug}: WAV master is missing`);
  if (slug === "--all" && mix.peaksUrl?.includes(".spectrum-v2.json")) { console.log(`${mix.slug}: spectrum data already available`); continue; }
  console.log(`${mix.slug}: scan master`);
  const response = await fetch(mix.masterUrl, { headers: { Range: "bytes=0-131071" } });
  if (response.status !== 206) throw new Error(`${mix.slug}: master header read failed`);
  const info = wavInfo(new Uint8Array(await response.arrayBuffer()));
  if (!info) throw new Error(`${mix.slug}: unsupported WAV header`);
  let progress = 0;
  const stream = readMasterInRanges(mix.masterUrl, mix.masterSize, bytes => {
    const percent = Math.floor(bytes / mix.masterSize * 10) * 10;
    if (percent > progress) { progress = percent; console.log(`${mix.slug}: ${percent}%`); }
  });
  const data = await generateWaveformData(stream, info);
  const filename = safeSegment(mix.masterFilename || `${mix.masterId}.wav`);
  const key = `mixes/${safeSegment(mix._id)}/${safeSegment(mix.masterId)}-${filename}.spectrum-v2.json`;
  await putObject(key, data);
  const peaksUrl = `${workerBase}/audio/${key.split("/").map(encodeURIComponent).join("/")}`;
  const current = await client.fetch('*[_id == $id][0]{_rev,"masterId":audio.master.asset._ref}', { id: mix._id });
  if (current?.masterId !== mix.masterId) { console.log(`${mix.slug}: master changed; skipped publication`); continue; }
  await client.patch(mix._id).ifRevisionId(current._rev).set({ "audio.peaksUrl": peaksUrl }).commit({ returnDocuments: false });
  console.log(JSON.stringify({ slug: mix.slug, peaksUrl, intervals: data.peaks.length, duration: data.duration }));
}
