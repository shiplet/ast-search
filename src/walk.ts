import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const SUPPORTED_EXTENSIONS = new Set([
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",
  ".vue",
]);

export async function* walkRepoFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules") continue;

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkRepoFiles(fullPath);
    } else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry.name))) {
      yield fullPath;
    }
  }
}
