import { inflateRawSync } from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
async function range(url, start, end) {
  const response = await fetch(url, { headers: { Range: start < 0 ? `bytes=${start}` : `bytes=${start}-${end}` }, signal: AbortSignal.timeout(120_000) });
  if (response.status !== 206) throw new Error('Official runtime archive does not support verified range retrieval.');
  return Buffer.from(await response.arrayBuffer());
}

export async function extractRuntime(url, destination) {
  const tail = await range(url, -65536);
  let footer = tail.length - 22;
  while (footer >= 0 && tail.readUInt32LE(footer) !== 0x06054b50) footer--;
  if (footer < 0) throw new Error('Invalid runtime ZIP directory.');
  const directory = await range(url, tail.readUInt32LE(footer + 16), tail.readUInt32LE(footer + 16) + tail.readUInt32LE(footer + 12) - 1);
  const files = [];
  for (let offset = 0; offset < directory.length;) {
    if (directory.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid archive directory entry.');
    const nameLength = directory.readUInt16LE(offset + 28);
    const name = directory.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (/\/bin\/(?:mongod\.exe|[^/]+\.dll)$/.test(name) || /\/(?:LICENSE[^/]*|THIRD-PARTY-NOTICES[^/]*|README[^/]*)$/.test(name)) files.push({ name, method: directory.readUInt16LE(offset + 10), crc: directory.readUInt32LE(offset + 16), compressed: directory.readUInt32LE(offset + 20), size: directory.readUInt32LE(offset + 24), localOffset: directory.readUInt32LE(offset + 42) });
    offset += 46 + nameLength + directory.readUInt16LE(offset + 30) + directory.readUInt16LE(offset + 32);
  }
  if (!files.some((file) => file.name.endsWith('/bin/mongod.exe'))) throw new Error('mongod.exe missing from official archive.');
  const hashes = {};
  for (const file of files) {
    const relative = file.name.includes('/bin/') ? path.join('bin', path.basename(file.name)) : path.basename(file.name);
    const target = path.join(destination, relative);
    try {
      const cached = await readFile(target);
      if (cached.length === file.size && crc32(cached) === file.crc) {
        hashes[relative] = createHash('sha256').update(cached).digest('hex');
        continue;
      }
    } catch { /* extract below */ }
    console.log(`Bundling ${path.basename(file.name)} (${Math.ceil(file.compressed / 1048576)} MB download)`);
    const header = await range(url, file.localOffset, file.localOffset + 29);
    if (header.readUInt32LE(0) !== 0x04034b50) throw new Error('Invalid runtime file header.');
    const start = file.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    const packed = await range(url, start, start + file.compressed - 1);
    const bytes = file.method === 8 ? inflateRawSync(packed) : file.method === 0 ? packed : null;
    if (!bytes || bytes.length !== file.size || crc32(bytes) !== file.crc) throw new Error(`Runtime integrity check failed: ${file.name}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    hashes[relative] = createHash('sha256').update(bytes).digest('hex');
  }
  return hashes;
}
