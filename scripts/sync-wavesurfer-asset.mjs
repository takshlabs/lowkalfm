import { copyFile } from "node:fs/promises";

await copyFile("node_modules/wavesurfer.js/dist/wavesurfer.min.js", "public/soundroom/wavesurfer.min.js");
await copyFile("node_modules/wavesurfer.js/LICENSE", "public/soundroom/wavesurfer.LICENSE");
