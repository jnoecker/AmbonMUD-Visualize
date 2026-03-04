import { mkdirSync, writeFileSync, existsSync, readdirSync } from "fs";
import { dirname, basename, extname, join } from "path";

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

/**
 * Given a desired file path like `dir/dalle3.png`, returns a versioned path
 * that won't overwrite existing files:
 *   - If `dalle3.png` doesn't exist → `dalle3.png`
 *   - If `dalle3.png` exists → `dalle3_v2.png`
 *   - If `dalle3_v2.png` also exists → `dalle3_v3.png`
 */
export function versionedPath(filePath: string): string {
  if (!existsSync(filePath)) return filePath;

  const dir = dirname(filePath);
  const ext = extname(filePath);
  const base = basename(filePath, ext);

  // Strip any existing _vN suffix to find the root name
  const rootBase = base.replace(/_v\d+$/, "");

  // Scan directory for existing versions
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const pattern = new RegExp(`^${escapeRegex(rootBase)}(?:_v(\\d+))?${escapeRegex(ext)}$`);

  let maxVersion = 1; // the original file counts as v1
  for (const f of files) {
    const match = f.match(pattern);
    if (match) {
      const ver = match[1] ? parseInt(match[1], 10) : 1;
      if (ver > maxVersion) maxVersion = ver;
    }
  }

  return join(dir, `${rootBase}_v${maxVersion + 1}${ext}`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Save image buffer, auto-versioning if file exists. Returns actual path written. */
export function saveImage(buffer: Buffer, path: string): string {
  ensureDir(dirname(path));
  const dest = versionedPath(path);
  writeFileSync(dest, buffer);
  return dest;
}

/** Save text, auto-versioning if file exists. Returns actual path written. */
export function saveText(text: string, path: string): string {
  ensureDir(dirname(path));
  const dest = versionedPath(path);
  writeFileSync(dest, text, "utf-8");
  return dest;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
