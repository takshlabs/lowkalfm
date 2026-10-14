import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { generateWaveformData } from "../lib/waveform-data.ts";

// Decode only for measurement. The delivery file remains the original FLAC.
// Pipe both the compressed input and decoded samples with bounded buffers.
export async function generateFlacWaveformData(stream, info, count = 2048) {
  if (!info?.totalSamples || !info.channels || !info.sampleRate) {
    await stream.cancel();
    throw new Error("FLAC waveform needs a valid STREAMINFO sample count");
  }
  const decoder = spawn("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-map", "0:a:0", "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1"], { stdio: ["pipe", "pipe", "pipe"] });
  let diagnostic = "";
  decoder.stderr.on("data", chunk => { diagnostic = (diagnostic + chunk.toString()).slice(-4096); });
  const exited = new Promise((resolve, reject) => {
    decoder.once("error", error => reject(new Error(`FLAC decoder could not start: ${error.message}. Install FFmpeg to generate FLAC waveforms.`, { cause: error })));
    decoder.once("exit", code => code === 0 ? resolve() : reject(new Error(`FLAC decoder failed (${code}): ${diagnostic.trim()}`)));
  });
  const input = Readable.fromWeb(stream);
  const copied = pipeline(input, decoder.stdin);
  const measured = generateWaveformData(Readable.toWeb(decoder.stdout), {
    audioFormat: 3, channels: info.channels, sampleRate: info.sampleRate,
    bits: 32, blockAlign: info.channels * 4, dataOffset: 0,
    dataSize: info.totalSamples * info.channels * 4
  }, count);
  try {
    const [data] = await Promise.all([measured, copied, exited]);
    return data;
  } catch (error) {
    input.destroy();
    decoder.kill();
    await Promise.allSettled([measured, copied, exited]);
    throw error;
  }
}
