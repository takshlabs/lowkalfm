import { createClient } from '@sanity/client';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, stat, readFile, writeFile, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const client = createClient({ projectId: process.env.SANITY_API_PROJECT_ID, dataset: process.env.SANITY_API_DATASET, apiVersion: '2026-08-24', token: process.env.SANITY_API_WRITE_TOKEN, useCdn: false });
const slug = process.argv[2];
if (!slug) throw new Error('Usage: npm run audio:delivery -- <mix-slug>');
const query = '*[_type == "mix" && slug.current == $slug][0]{_id,_rev,"masterUrl":audio.master.asset->url,"masterId":audio.master.asset._ref,"masterBytes":audio.master.asset->size,"deliveryId":audio.delivery.asset._ref,"waveformId":audio.waveform.asset._ref}';
const mix = await client.fetch(query, { slug });
if (!mix?.masterUrl || !mix.masterId) throw new Error('The mix needs a WAV master');
if (mix.deliveryId && mix.waveformId) { console.log(`${slug}: MP3 delivery file already exists`); process.exit(0); }
const directory = await mkdtemp(join(tmpdir(), 'lowkal-delivery-'));
try {
  const output = join(directory, `${slug}.mp3`);
  const input = join(directory, 'master.wav');
  const file = await open(input, 'w');
  let nextOffset = 0;
  let failed = false;
  try {
    const size = Number(mix.masterBytes);
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error('Cannot read the master size');
    const chunkSize = 8 * 1024 * 1024;
    const workers = Array.from({ length: 8 }, async () => {
      while (!failed && nextOffset < size) {
        const start = nextOffset;
        nextOffset += chunkSize;
        const end = Math.min(size - 1, start + chunkSize - 1);
        let lastError;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(mix.masterUrl, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(120000) });
            if (response.status !== 206 || response.headers.get('content-range') !== `bytes ${start}-${end}/${size}`) throw new Error('Invalid source range');
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length !== end - start + 1) throw new Error('Incomplete source range');
            let written = 0;
            while (written < bytes.length) written += (await file.write(bytes, written, bytes.length - written, start + written)).bytesWritten;
            lastError = null;
            break;
          } catch (error) { lastError = error; }
        }
        if (lastError) { failed = true; throw lastError; }
      }
    });
    const results = await Promise.allSettled(workers);
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  } finally { await file.close(); }
  console.log(`${slug}: master downloaded`);
  const probe = await new Promise((resolve, reject) => {
    let output = '';
    const child = spawn('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration,sample_rate', '-of', 'json', input], { stdio: ['ignore', 'pipe', 'inherit'] });
    child.stdout.on('data', (data) => { output += data; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve(JSON.parse(output)) : reject(new Error(`FFprobe failed: ${code}`)));
  });
  const duration = Number(probe.streams?.[0]?.duration);
  const sampleRate = Number(probe.streams?.[0]?.sample_rate);
  if (!duration || !sampleRate) throw new Error('Cannot read the source duration');
  const peakLog = join(directory, 'peaks.txt');
  const blockSize = Math.ceil(duration * sampleRate / 128);
  await new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', input, '-filter_complex', `[0:a:0]asplit=2[encode][scan];[scan]asetnsamples=n=${blockSize}:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level:file=${peakLog}[peaks]`, '-map', '[encode]', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-map_metadata', '-1', output, '-map', '[peaks]', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'inherit'] });
    process.once('error', reject);
    process.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg failed: ${code}`)));
  });
  const values = [...(await readFile(peakLog, 'utf8')).matchAll(/lavfi\.astats\.Overall\.Peak_level=([^\r\n]+)/g)].map((match) => match[1].trim().toLowerCase() === "-inf" ? 0 : Math.round(Math.min(1, Math.pow(10, Number(match[1]) / 20)) * 10000) / 10000);
  if (!values.length || values.some((value) => !Number.isFinite(value))) throw new Error('Cannot read waveform data');
  const peaks = Array.from({ length: 128 }, (_, index) => values[index] ?? 0);
  const waveformPath = join(directory, `${slug}.peaks.json`);
  await writeFile(waveformPath, JSON.stringify({ version: 1, sourceAssetId: mix.masterId, peaks }));
  const waveform = await client.assets.upload('file', createReadStream(waveformPath), { filename: `${slug}.peaks.json`, contentType: 'application/json' });
  const asset = await client.assets.upload('file', createReadStream(output), { filename: `${slug}.mp3`, contentType: 'audio/mpeg' });
  const latest = await client.fetch(query, { slug });
  if (!latest || latest.masterId !== mix.masterId || latest.deliveryId !== mix.deliveryId) throw new Error('The source changed. The delivery file was not applied.');
  await client.patch(mix._id).ifRevisionId(latest._rev).set({ 'audio.delivery': { _type: 'file', asset: { _type: 'reference', _ref: asset._id } }, 'audio.waveform': { _type: 'file', asset: { _type: 'reference', _ref: waveform._id } } }).commit({ returnDocuments: false });
  console.log(JSON.stringify({ slug, deliveryBytes: (await stat(output)).size, assetId: asset._id }));
} finally { await rm(directory, { recursive: true, force: true }); }
