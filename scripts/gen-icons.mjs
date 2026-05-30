// Generates the ApplyPilot extension icons (no deps): a white paper-plane mark on
// a rounded indigo tile, 4x-supersampled for clean edges. Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BG = [79, 70, 229]; // brand indigo #4F46E5 (= token --accent-ish / badge)
const FG = [255, 255, 255]; // white plane
const SIZES = [16, 48, 128, 300]; // 300 = Edge Add-ons store logo
const SS = 4; // supersampling factor for anti-aliasing
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

// --- geometry helpers ---------------------------------------------------------
function inRoundedRect(x, y, size, r) {
  const min = r;
  const max = size - r;
  const cx = Math.min(Math.max(x, min), max);
  const cy = Math.min(Math.max(y, min), max);
  // Inside the straight bands always; only the corner regions use the radius.
  if (x >= min && x <= max) return y >= 0 && y <= size;
  if (y >= min && y <= max) return x >= 0 && x <= size;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function inTriangle(px, py, [a, b, c]) {
  const d = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = d([px, py], a, b);
  const d2 = d([px, py], b, c);
  const d3 = d([px, py], c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// Paper-plane silhouette on a 24-grid (Lucide "send" geometry), split into two
// triangles so the concave quad fills correctly.
function planeTriangles(size) {
  const inset = size * 0.2;
  const span = size - inset * 2;
  const P = (x, y) => [inset + (x / 24) * span, inset + (y / 24) * span];
  return [
    [P(22, 2), P(15, 22), P(11, 13)],
    [P(22, 2), P(11, 13), P(2, 9)],
  ];
}

// --- rasterizer ---------------------------------------------------------------
function renderRGBA(size) {
  const r = size * 0.22;
  const tris = planeTriangles(size);
  const data = Buffer.alloc(size * size * 4);
  const n = SS * SS;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let rS = 0;
      let gS = 0;
      let bS = 0;
      let cover = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          if (!inRoundedRect(x, y, size, r)) continue; // transparent outside tile
          const onPlane = tris.some((t) => inTriangle(x, y, t));
          const c = onPlane ? FG : BG;
          rS += c[0];
          gS += c[1];
          bS += c[2];
          cover += 1;
        }
      }
      const idx = (py * size + px) * 4;
      if (cover === 0) {
        data[idx + 3] = 0; // fully transparent
      } else {
        data[idx] = Math.round(rS / cover);
        data[idx + 1] = Math.round(gS / cover);
        data[idx + 2] = Math.round(bS / cover);
        data[idx + 3] = Math.round((255 * cover) / n);
      }
    }
  }
  return data;
}

// --- PNG encoder (RGBA, no deps) ---------------------------------------------
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
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const rgba = renderRGBA(size);
  // Prefix each row with filter byte 0.
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
for (const s of SIZES) {
  writeFileSync(join(OUT, `icon${s}.png`), png(s));
  console.log(`wrote icons/icon${s}.png`);
}
