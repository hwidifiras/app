import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractRuntime } from './remote-runtime-zip.mjs';

export const MONGODB_VERSION = '8.0.32';
export const runtimeDir = path.resolve('desktop/vendor/mongodb');
export async function downloadMongoDB() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Build the Windows x64 installer on Windows x64.');
  try {
    const manifest = JSON.parse(await readFile(path.join(runtimeDir, 'runtime.json'), 'utf8'));
    if (manifest.version === MONGODB_VERSION && manifest.files) {
      for (const [name, hash] of Object.entries(manifest.files)) if (createHash('sha256').update(await readFile(path.join(runtimeDir, name))).digest('hex') !== hash) throw new Error('Runtime cache changed.');
      return;
    }
  } catch { /* rebuild the verified runtime cache */ }
  const source = `https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-${MONGODB_VERSION}.zip`;
  // Retrieve the official executable and notices, omitting hundreds of MB of PDB
  // debug symbols. ZIP entry CRCs, SHA-256 file hashes and a pinned executable digest
  // validate the selected files; no claim is made of hashing the whole archive.
  const files = await extractRuntime(source, runtimeDir);
  if (files[path.join('bin', 'mongod.exe')] !== '38f8e6dfbc496ae4089f15b8235f15287adfbd8c09eafa4f384a2e5361625522') throw new Error('Pinned MongoDB executable SHA256 mismatch.');
  await writeFile(path.join(runtimeDir, 'runtime.json'), JSON.stringify({ version: MONGODB_VERSION, verification: 'ZIP CRC32 and pinned MongoDB executable SHA256', source, files }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await downloadMongoDB();
