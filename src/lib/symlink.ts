import { cpSync, existsSync, lstatSync, mkdirSync, renameSync, rmSync, symlinkSync } from 'node:fs';
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

/** Move a real file or directory from src to destDir/basename(src).
 *  Falls back to copy+delete if rename fails across filesystems (EXDEV). */
export function moveToDir(src: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, basename(src));
  try {
    renameSync(src, dest);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'EXDEV') {
      cpSync(src, dest, { recursive: true });
      rmSync(src, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}

export function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true });
}

export function dirExists(p: string): boolean {
  return existsSync(p) && lstatSync(p).isDirectory();
}
