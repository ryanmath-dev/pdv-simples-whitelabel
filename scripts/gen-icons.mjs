// Gera ícones PNG do PWA (sem dependências externas) usando zlib.
// Fundo teal da marca + um "cupom" branco central (seguro para maskable).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = [15, 118, 110, 255]; // #0f766e
const FG = [204, 251, 241, 255]; // #ccfbf1

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  // "cupom" central: retângulo arredondado ocupando ~56% (zona segura maskable).
  const m = Math.floor(size * 0.22);
  const inner = { x0: m, y0: m, x1: size - m, y1: size - m };
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtro 0
    for (let x = 0; x < size; x++) {
      const inRect =
        x >= inner.x0 && x < inner.x1 && y >= inner.y0 && y < inner.y1;
      // listras do cupom (linhas de texto)
      const stripe =
        inRect &&
        ((y - inner.y0) % Math.max(6, Math.floor(size * 0.07)) <
          Math.max(2, Math.floor(size * 0.025))) &&
        x > inner.x0 + size * 0.04 &&
        x < inner.x1 - size * 0.04;
      const color = inRect ? (stripe ? BG : FG) : BG;
      const off = y * (size * 4 + 1) + 1 + x * 4;
      raw[off] = color[0];
      raw[off + 1] = color[1];
      raw[off + 2] = color[2];
      raw[off + 3] = color[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
]) {
  writeFileSync(join(outDir, name), makePng(size));
  console.log('gerado', name);
}
