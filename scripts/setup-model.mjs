import { mkdir, copyFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
await mkdir(path.join(root, 'public/mediapipe'), { recursive: true });
await mkdir(path.join(root, 'public/models'), { recursive: true });
const wasmRoot = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
for (const file of await readdir(wasmRoot))
  if (/\.(wasm|js)$/.test(file))
    await copyFile(path.join(wasmRoot, file), path.join(root, 'public/mediapipe', file));
const models = [
  {
    file: 'pose_landmarker_lite.task',
    url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  },
  {
    file: 'holistic_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task',
  },
];
for (const item of models) {
  const response = await fetch(item.url);
  if (!response.ok) throw new Error(`${item.file} download failed: ${response.status}`);
  const model = new Uint8Array(await response.arrayBuffer());
  if (model.byteLength < 1000000) throw new Error(`${item.file} download is unexpectedly small.`);
  await writeFile(path.join(root, 'public/models', item.file), model);
  console.log(`Official ${item.file} downloaded (${model.byteLength} bytes).`);
}
console.log('MediaPipe WASM copied.');
