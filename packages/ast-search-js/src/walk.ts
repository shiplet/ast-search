import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";

export async function* walkRepoFiles(
  dir: string,
  extensions: ReadonlySet<string>,
): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules") continue;

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkRepoFiles(fullPath, extensions);
    } else if (entry.isFile() && extensions.has(extname(entry.name))) {
      yield fullPath;
    }
  }
}
