// Draws the toolbar icons (a guitar pick with up/down arrows) without image
// dependencies: signed-distance shapes rasterized into a hand-written PNG.
// Run with `bun run icons`; writes public/icon and public/icon-active.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZES = [16, 32, 48, 128];
const VARIANTS = {
  icon: [107, 114, 128], // idle: neutral grey
  'icon-active': [249, 115, 22], // transposed: orange, matches the badge
} as const;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Isosceles triangle, apex at the origin, base at y = qy (Inigo Quilez). */
function sdTriangle(px: number, py: number, qx: number, qy: number) {
  px = Math.abs(px);
  const t = clamp((px * qx + py * qy) / (qx * qx + qy * qy), 0, 1);
  const ax = px - qx * t;
  const ay = py - qy * t;
  const bx = px - qx * clamp(px / qx, 0, 1);
  const by = py - qy;
  const s = -Math.sign(qy);
  const d = Math.min(ax * ax + ay * ay, bx * bx + by * by);
  const sign = Math.min(s * (px * qy - py * qx), s * (py - qy));
  return -Math.sqrt(d) * Math.sign(sign);
}

// u, v in [-1, 1], v pointing down.
const pick = (u: number, v: number) => sdTriangle(u, 0.6 - v, 0.62, 1.25) - 0.22;
const arrows = (u: number, v: number) =>
  Math.min(
    sdTriangle(u, v + 0.52, 0.27, 0.36) - 0.03, // up
    sdTriangle(u, 0.44 - v, 0.22, 0.32) - 0.03, // down
  );

function render(size: number, [r, g, b]: readonly number[]): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  const coverage = (d: number) => clamp(0.5 - (d * size) / 2, 0, 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1;
      const v = ((y + 0.5) / size) * 2 - 1;
      const fill = coverage(pick(u, v));
      const white = coverage(arrows(u, v));
      const i = (y * size + x) * 4;
      px[i] = Math.round(r + (255 - r) * white);
      px[i + 1] = Math.round(g + (255 - g) * white);
      px[i + 2] = Math.round(b + (255 - b) * white);
      px[i + 3] = Math.round(255 * fill);
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function encodePng(size: number, rgba: Uint8Array) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  ]);
}

for (const [dir, color] of Object.entries(VARIANTS)) {
  const out = new URL(`../public/${dir}/`, import.meta.url);
  mkdirSync(out, { recursive: true });
  for (const size of SIZES) writeFileSync(new URL(`${size}.png`, out), encodePng(size, render(size, color)));
}
console.log('Wrote icons to public/icon and public/icon-active');
