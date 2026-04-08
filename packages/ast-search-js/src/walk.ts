import { readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import micromatch from "micromatch";

export async function* walkRepoFiles(
  dir: string,
  extensions: ReadonlySet<string>,
  exclude: string[] = [],
  rootDir?: string,
): AsyncGenerator<string> {
  // Support single-file paths in addition to directories
  const st = await stat(dir).catch(() => null);
  if (st?.isFile()) {
    if (extensions.has(extname(dir))) yield dir;
    return;
  }

  const root = rootDir ?? dir;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules") continue;

    const fullPath = join(dir, entry.name);
    if (exclude.length > 0 && micromatch.isMatch(relative(root, fullPath), exclude, { matchBase: true })) continue;

    if (entry.isDirectory()) {
      yield* walkRepoFiles(fullPath, extensions, exclude, root);
    } else if (entry.isFile() && extensions.has(extname(entry.name))) {
      yield fullPath;
    }
  }
}
