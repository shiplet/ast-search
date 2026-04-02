import { readFile } from "node:fs/promises";
import type { Match } from "./types.js";

export async function enrichWithContext(
  matches: Match[],
  contextN: number,
): Promise<Match[]> {
  // Group matches by file, preserving original order via index
  const fileToIndices = new Map<string, number[]>();
  for (let i = 0; i < matches.length; i++) {
    const file = matches[i].file;
    const indices = fileToIndices.get(file) ?? [];
    indices.push(i);
    fileToIndices.set(file, indices);
  }

  const enriched = matches.map((m) => ({ ...m }));

  for (const [file, indices] of fileToIndices) {
    let lines: string[];
    try {
      const source = await readFile(file, "utf8");
      lines = source.split("\n");
    } catch {
      // Can't read file — leave context empty, preserve match
      continue;
    }

    for (const i of indices) {
      const match = enriched[i];
      const matchLine = match.line; // 1-indexed
      const before = lines.slice(Math.max(0, matchLine - 1 - contextN), matchLine - 1);
      const after = lines.slice(matchLine, Math.min(lines.length, matchLine + contextN));
      enriched[i] = { ...match, contextBefore: before, contextAfter: after };
    }
  }

  return enriched;
}
