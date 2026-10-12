import { build } from "esbuild";

// One renderer for React and the standalone Soundroom.
await build({ entryPoints: ["lib/waveform-renderer.ts"], outfile: "public/soundroom/waveform-renderer.js", bundle: true, format: "iife", globalName: "LowkalWaveform", target: "es2020", minify: true });
