// Generates PWA PNG icons (dark barbell mark) with no dependencies:
// draws into an RGBA buffer and encodes PNG via node:zlib.
// Run: node scripts/gen-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// ---- minimal PNG encoder ----

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- drawing ----

const BG = [0x0b, 0x0d, 0x10];
const STEEL = [0x8b, 0x93, 0xa1];
const AMBER = [0xff, 0xc5, 0x3d];

function drawIcon(size, scale) {
  const px = Buffer.alloc(size * size * 4);
  const fill = (x0, y0, x1, y1, [r, g, b]) => {
    x0 = Math.round(x0 * size);
    y0 = Math.round(y0 * size);
    x1 = Math.round(x1 * size);
    y1 = Math.round(y1 * size);
    for (let y = Math.max(0, y0); y < Math.min(size, y1); y++)
      for (let x = Math.max(0, x0); x < Math.min(size, x1); x++) {
        const i = (y * size + x) * 4;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        px[i + 3] = 255;
      }
  };
  fill(0, 0, 1, 1, BG);
  // shapes in unit space, shrunk toward center by `scale` (maskable safe zone)
  const s = (v) => 0.5 + (v - 0.5) * scale;
  const rect = (x0, y0, x1, y1, c) => fill(s(x0), s(y0), s(x1), s(y1), c);
  rect(0.08, 0.472, 0.92, 0.528, STEEL); // bar
  rect(0.175, 0.29, 0.255, 0.71, AMBER); // outer plates
  rect(0.745, 0.29, 0.825, 0.71, AMBER);
  rect(0.28, 0.355, 0.345, 0.645, AMBER); // inner plates
  rect(0.655, 0.355, 0.72, 0.645, AMBER);
  return px;
}

mkdirSync(OUT, { recursive: true });
for (const [name, size, scale] of [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['maskable-512.png', 512, 0.72],
  ['apple-touch-icon.png', 180, 0.9],
]) {
  writeFileSync(join(OUT, name), encodePNG(size, drawIcon(size, scale)));
  console.log('wrote', name);
}
