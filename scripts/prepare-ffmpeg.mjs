import { mkdir, copyFile } from "node:fs/promises";

const files = ["ffmpeg-core.js", "ffmpeg-core.wasm"];
const sourceDir = new URL("../node_modules/@ffmpeg/core/dist/esm/", import.meta.url);
const targetDir = new URL("../public/ffmpeg/", import.meta.url);

await mkdir(targetDir, { recursive: true });

for (const file of files) {
  await copyFile(new URL(file, sourceDir), new URL(file, targetDir));
}

console.log("Prepared local FFmpeg core assets.");
