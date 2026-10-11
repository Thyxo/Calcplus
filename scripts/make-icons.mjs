// Genererer app-ikoner (PNG) uden afhængigheder: mørk baggrund med grå og orange knapper.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Ikon-design i enhedskoordinater (0..1). pad = ekstra luft til maskable.
function draw(size, pad = 0) {
  const SS = 4; // supersampling
  const px = Buffer.alloc(size * size * 4);
  const circles = [];
  const cols = 3, rows = 3;
  const inner = 1 - 2 * pad;
  const d = 0.205 * inner, gap = 0.045 * inner;
  const gridW = cols * d + (cols - 1) * gap;
  const x0 = 0.5 - gridW / 2 + d / 2, y0 = 0.5 - gridW / 2 + d / 2;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const color = c === cols - 1 ? '#ff9400' : r === 0 ? '#5e5e5e' : '#343434';
    circles.push({ x: x0 + c * (d + gap), y: y0 + r * (d + gap), r: d / 2, col: hex(color) });
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = (x + (sx + 0.5) / SS) / size, v = (y + (sy + 0.5) / SS) / size;
      // baggrund: svag lodret gradient
      const g = 22 - 14 * v;
      let col = [g, g, g + 1];
      for (const ci of circles) {
        if ((u - ci.x) ** 2 + (v - ci.y) ** 2 <= ci.r ** 2) {
          const shade = 1 - 0.07 * Math.max(0, (v - ci.y) / ci.r);
          col = ci.col.map((k) => k * shade);
        }
      }
      acc = acc.map((a, i) => a + col[i]);
    }
    const o = (y * size + x) * 4;
    px[o] = Math.round(acc[0] / (SS * SS)); px[o + 1] = Math.round(acc[1] / (SS * SS)); px[o + 2] = Math.round(acc[2] / (SS * SS)); px[o + 3] = 255;
  }
  return png(size, px);
}

writeFileSync('icons/apple-touch-icon.png', draw(180));
writeFileSync('icons/icon-192.png', draw(192));
writeFileSync('icons/icon-512.png', draw(512));
writeFileSync('icons/maskable-512.png', draw(512, 0.1));
console.log('ikoner skrevet');
