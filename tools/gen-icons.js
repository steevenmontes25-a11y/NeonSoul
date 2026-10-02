/* ============================================================
   NEON SOUL - tools/gen-icons.js
   Generates the PWA / Android icons procedurally (no binary
   assets committed). Run:  node tools/gen-icons.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ---------- PNG encoder ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- drawing helpers ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

function blend(dst, i, r, g, b, a) {
  dst[i] = clamp(dst[i] * (1 - a) + r * a, 0, 255);
  dst[i + 1] = clamp(dst[i + 1] * (1 - a) + g * a, 0, 255);
  dst[i + 2] = clamp(dst[i + 2] * (1 - a) + b * a, 0, 255);
  dst[i + 3] = 255;
}
function add(dst, i, r, g, b, a) {
  dst[i] = clamp(dst[i] + r * a, 0, 255);
  dst[i + 1] = clamp(dst[i + 1] + g * a, 0, 255);
  dst[i + 2] = clamp(dst[i + 2] + b * a, 0, 255);
  dst[i + 3] = 255;
}

function makeIcon(size, inset) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const S = size * inset;          // content scale

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = (x - c) / c, dy = (y - c) / c;
      const d = Math.hypot(dx, dy);
      // background: deep violet core -> near black
      const bg = 1 - smooth(0.1, 1.15, d);
      blend(buf, i, 10 + 30 * bg, 5 + 10 * bg, 20 + 46 * bg, 1);
      // diagonal scanlines
      if (((x + y) % 14) < 1) add(buf, i, 60, 20, 90, 0.25);
    }
  }

  // neon rhombus (soul sigil) + inner core
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = (x - c) / S, py = (y - c) / S;

      // outer rhombus ring
      const rh = Math.abs(px) / 0.62 + Math.abs(py) / 0.86;
      const ring = 1 - smooth(0.0, 0.085, Math.abs(rh - 1));
      if (ring > 0.001) add(buf, i, 255, 47, 185, ring * 0.95);
      const glow = 1 - smooth(0.0, 0.42, Math.abs(rh - 1));
      if (glow > 0.001) add(buf, i, 150, 30, 120, glow * 0.38);

      // inner rhombus (cyan)
      const rh2 = Math.abs(px) / 0.36 + Math.abs(py) / 0.52;
      const ring2 = 1 - smooth(0.0, 0.07, Math.abs(rh2 - 1));
      if (ring2 > 0.001) add(buf, i, 37, 224, 255, ring2 * 0.9);

      // vertical soul slash
      const slash = (1 - smooth(0.0, 0.035, Math.abs(px))) * (1 - smooth(0.34, 0.62, Math.abs(py)));
      if (slash > 0.001) add(buf, i, 255, 255, 255, slash * 0.85);

      // core
      const core = 1 - smooth(0.0, 0.14, Math.hypot(px, py));
      if (core > 0.001) add(buf, i, 255, 255, 255, core * 0.95);
      const coreGlow = 1 - smooth(0.05, 0.5, Math.hypot(px, py));
      if (coreGlow > 0.001) add(buf, i, 155, 92, 255, coreGlow * 0.3);
    }
  }
  return encodePNG(size, size, buf);
}

const outDir = path.join(__dirname, "..", "assets", "icons");
fs.mkdirSync(outDir, { recursive: true });

const jobs = [
  ["icon-192.png", 192, 0.42],
  ["icon-512.png", 512, 0.42],
  ["icon-maskable-512.png", 512, 0.30]
];
jobs.forEach(([name, size, inset]) => {
  const png = makeIcon(size, inset);
  fs.writeFileSync(path.join(outDir, name), png);
  console.log("wrote", name, size + "x" + size, (png.length / 1024).toFixed(1) + " KB");
});
