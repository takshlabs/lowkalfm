import { createClient } from "@sanity/client";
import { spawn } from "node:child_process";

const workerBase = "https://lowkal-audio-sync.lowkal-audio-737a.workers.dev";
const peakCount = 128;
const client = createClient({ projectId: process.env.SANITY_API_PROJECT_ID, dataset: process.env.SANITY_API_DATASET, apiVersion: "2026-08-24", token: process.env.SANITY_API_WRITE_TOKEN, useCdn: false });

function safeSegment(value) { return value.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 160) || "audio"; }
function ascii(bytes, offset, length) { return String.fromCharCode(...bytes.subarray(offset, offset + length)); }

function wavInfo(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4), size = view.getUint32(offset + 4, true), dataStart = offset + 8;
    if (id === "fmt " && size >= 16) {
      const format = view.getUint16(dataStart, true);
      const audioFormat = format === 0xfffe && size >= 40 ? view.getUint16(dataStart + 24, true) : format;
      const channels = view.getUint16(dataStart + 2, true), blockAlign = view.getUint16(dataStart + 12, true), bits = view.getUint16(dataStart + 14, true);
      let next = dataStart + size + (size % 2);
      while (next + 8 <= bytes.length) {
        const nextId = ascii(bytes, next, 4), nextSize = view.getUint32(next + 4, true);
        if (nextId === "data") return { audioFormat, channels, blockAlign, bits, dataOffset: next + 8, dataSize: nextSize };
        next += 8 + nextSize + (nextSize % 2);
      }
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("Unsupported WAV header");
}

function amplitude(bytes, info) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let maximum = 0;
  for (let channel = 0; channel < info.channels; channel += 1) {
    const offset = channel * (info.bits / 8);
    const value = info.bits === 24
      ? (() => { const raw = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16); return Math.abs((raw & 0x800000 ? raw - 0x1000000 : raw) / 8388608); })()
      : info.bits === 16 ? Math.abs(view.getInt16(offset, true) / 32768) : 0;
    maximum = Math.max(maximum, value);
  }
  return Math.round(Math.min(1, maximum) * 10000) / 10000;
}

async function putObject(key, data) {
  await new Promise((resolve, reject) => {
    const child = spawn("npx", ["wrangler", "r2", "object", "put", `lowkal-audio/${key}`, "--remote", "--pipe", "--force", "--content-type", "application/json", "--cache-control", "public, max-age=31536000, immutable"], { stdio: ["pipe", "inherit", "inherit"] });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`R2 upload failed with ${code}`)));
    child.stdin.end(JSON.stringify(data));
  });
}

async function readPeakSample(url, position, info) {
  let failure;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Range: `bytes=${position}-${position + info.blockAlign - 1}` } });
      if (response.status !== 206) throw new Error(`Peak sample failed with ${response.status}`);
      return amplitude(new Uint8Array(await response.arrayBuffer()), info);
    } catch (error) {
      failure = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw failure;
}

const slug = process.argv[2];
if (!slug) throw new Error("Usage: node --env-file=.env.local scripts/generate-waveform-peaks.mjs <mix-slug>");
const mix = await client.fetch(`*[_type == "mix" && slug.current == $slug][0]{_id,"slug":slug.current,"masterUrl":audio.master.asset->url,"masterFilename":audio.master.asset->originalFilename,"masterId":audio.master.asset._ref,"deliveryUrl":audio.deliveryUrl}`, { slug });
if (!mix?.masterUrl || !mix.masterId || !mix.deliveryUrl) throw new Error("The mix needs a copied WAV master and delivery URL");
const headerResponse = await fetch(mix.masterUrl, { headers: { Range: "bytes=0-131071" } });
const info = wavInfo(new Uint8Array(await headerResponse.arrayBuffer()));
const positions = Array.from({ length: peakCount }, (_, index) => info.dataOffset + Math.floor(index * info.dataSize / peakCount / info.blockAlign) * info.blockAlign);
const peaks = [];
for (let start = 0; start < positions.length; start += 8) {
  peaks.push(...await Promise.all(positions.slice(start, start + 8).map((position) => readPeakSample(mix.masterUrl, position, info))));
}
const filename = safeSegment(mix.masterFilename || `${mix.masterId}.wav`);
const key = `mixes/${safeSegment(mix._id)}/${safeSegment(mix.masterId)}-${filename}.peaks.json`;
await putObject(key, { version: 1, peaks });
const peaksUrl = `${workerBase}/audio/${key.split("/").map(encodeURIComponent).join("/")}`;
await client.patch(mix._id).set({ "audio.peaksUrl": peaksUrl, "audio.syncedAt": new Date().toISOString() }).commit({ returnDocuments: false });
console.log(JSON.stringify({ slug: mix.slug, peaksUrl, peakCount }));
