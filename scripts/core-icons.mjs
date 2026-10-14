import { createDeflate } from "zlib";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { fileURLToPath } from "url";

const BG_COLOUR = 0x1c1f1b;
const CIRCLE_COLOUR = 0xefe3c6;

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 * (crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeArr = Buffer.from(type);
  const combined = Buffer.concat([length, typeArr, data]);
  const crc = crc32(combined.slice(4));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([combined, crcBuf]);
}

async function createPng(size) {
  const width = size;
  const height = size;
  const radius = Math.floor(size * 0.35);
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);

  const raw = Buffer.alloc(height * (width * 4 + 1));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        raw[offset++] = (CIRCLE_COLOUR >> 16) & 0xff;
        raw[offset++] = (CIRCLE_COLOUR >> 8) & 0xff;
        raw[offset++] = CIRCLE_COLOUR & 0xff;
        raw[offset++] = 0xff;
      } else {
        raw[offset++] = (BG_COLOUR >> 16) & 0xff;
        raw[offset++] = (BG_COLOUR >> 8) & 0xff;
        raw[offset++] = BG_COLOUR & 0xff;
        raw[offset++] = 0xff;
      }
    }
  }

  const compressed = await new Promise((resolve, reject) => {
    const chunks = [];
    const deflate = createDeflate({ level: 9 });
    deflate.on("data", (chunk) => chunks.push(chunk));
    deflate.on("end", () => resolve(Buffer.concat(chunks)));
    deflate.on("error", reject);
    deflate.end(raw);
  });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = writeChunk("IHDR", ihdr);
  const idatChunk = writeChunk("IDAT", compressed);
  const iendChunk = writeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

async function main() {
  for (const size of [192, 512]) {
    const png = await createPng(size);
    const path = fileURLToPath(new URL(`../public/icon-${size}.png`, import.meta.url));
    await pipeline(
      async function* () { yield png; },
      createWriteStream(path)
    );
    console.log(`Generated ${path}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });