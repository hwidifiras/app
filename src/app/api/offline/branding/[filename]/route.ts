import { readFile, lstat } from "node:fs/promises";
import path from "node:path";

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  if (process.env.OFFLINE_DESKTOP !== "1" || !process.env.GYM_DATA_DIR) return new Response(null, { status: 404 });
  const { filename } = await params;
  if (!/^club-logo(?:-[a-z0-9-]+)?\.(png|jpg|jpeg|webp)$/.test(filename)) return new Response(null, { status: 404 });
  const file = path.join(process.env.GYM_DATA_DIR, "branding", filename);
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 5 * 1024 * 1024) return new Response(null, { status: 404 });
    const mime = filename.endsWith(".png") ? "image/png" : filename.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new Response(new Uint8Array(await readFile(file)), { headers: { "Content-Type": mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 404 }); }
}
