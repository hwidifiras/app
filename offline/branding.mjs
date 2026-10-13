import { readdir, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

// Keep customer branding in the profile; rehydrate it after app updates.
export async function syncProfileBranding(dataDir, publicDir) {
  const source = path.join(dataDir, 'branding');
  let files;
  try { files = await readdir(source, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
  const images = files.filter((file) => file.isFile() && /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(file.name));
  if (!images.length) return 0;
  const destination = path.join(publicDir, 'branding');
  await mkdir(destination, { recursive: true });
  for (const file of images) await copyFile(path.join(source, file.name), path.join(destination, file.name));
  return images.length;
}
