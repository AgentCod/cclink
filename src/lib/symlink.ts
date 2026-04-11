import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { basename, join } from 'node:path';

export type PathStatus = 'missing' | 'symlink' | 'real';

export function getPathStatus(p: string): PathStatus {
  try {
    const stat = lstatSync(p);
    return stat.isSymbolicLink() ? 'symlink' : 'real';
  } catch {
    return 'missing';
  }
}

/** Remove a symlink at path. */
export function removeSymlink(p: string): void {
  rmSync(p);
}

/** Create a symlink: linkPath → target */
export function createSymlink(target: string, linkPath: string): void {
  symlinkSync(target, linkPath);
}

/** Count total files recursively (for progress display) */
export function countFiles(src: string): number {
  try {
    const stat = statSync(src);
    if (!stat.isDirectory()) return 1;
    let count = 0;
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      count += countFiles(join(src, entry.name));
    }
    return count;
  } catch {
    return 0;
  }
}

/** Move src to destDir/basename(src) with optional progress callback.
 *  Falls back to copy+delete if rename fails across filesystems (EXDEV). */
export function moveToDirWithProgress(
  src: string,
  destDir: string,
  onProgress?: (copied: number, total: number) => void
): void {
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, basename(src));
  try {
    renameSync(src, dest);
    // rename is atomic — report complete immediately
    if (onProgress) {
      const total = 1;
      onProgress(total, total);
    }
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'EXDEV') {
      // Cross-device: copy with progress then delete source
      const total = countFiles(src);
      let copied = 0;
      cpSync(src, dest, {
        recursive: true,
        filter: (srcPath: string) => {
          try {
            if (!statSync(srcPath).isDirectory()) {
              copied++;
              if (onProgress) onProgress(copied, total);
            }
          } catch { /* skip */ }
          return true;
        },
      });
      rmSync(src, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}

/** Convenience wrapper without progress */
export function moveToDir(src: string, destDir: string): void {
  moveToDirWithProgress(src, destDir);
}

export function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true });
}

export function dirExists(p: string): boolean {
  return existsSync(p) && lstatSync(p).isDirectory();
}
