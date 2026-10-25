import { mkdir, copyFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
await mkdir(path.join(root, 'public/mediapipe'), { recursive: true });
await mkdir(path.join(root, 'public/models'), { recursive: true });
const wasmRoot = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
for (const file of await readdir(wasmRoot))
  if (/\.(wasm|js)$/.test(file))
    await copyFile(path.join(wasmRoot, file), path.join(root, 'public/mediapipe', file));
const modelUrl =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const response = await fetch(modelUrl);
if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
const model = new Uint8Array(await response.arrayBuffer());
if (model.byteLength < 1000000) throw new Error('Downloaded model is unexpectedly small.');
await writeFile(path.join(root, 'public/models/pose_landmarker_lite.task'), model);
console.log(`MediaPipe WASM copied; official pose model downloaded (${model.byteLength} bytes).`);
