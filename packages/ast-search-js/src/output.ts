import type { Match } from "./search.js";

const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

export type OutputFormat = "text" | "json" | "files" | "count";

export interface SearchMeta {
  matchCount: number;
  filesSearched: number;
  wallMs: number;
  queries: string[];
  truncated: boolean;
}

export function formatMatches(
  matches: Match[],
  isTTY: boolean,
  format: OutputFormat = "text",
  meta?: SearchMeta,
): string[] {
  if (format === "json") {
    if (meta) {
      return [JSON.stringify({ matches, _meta: meta }, null, 2)];
    }
    return [JSON.stringify(matches, null, 2)];
  }
  if (format === "files") {
    const seen = new Set<string>();
    const lines = matches.map((m) => m.file).filter((f) => !seen.has(f) && !!seen.add(f));
    if (meta?.truncated) lines.push(`(truncated: showing first ${meta.matchCount} of more matches)`);
    return lines;
  }
  if (format === "count") {
    if (matches.length === 0) return [];
    const counts = new Map<string, number>();
    for (const m of matches) counts.set(m.file, (counts.get(m.file) ?? 0) + 1);
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const lines = sorted.map(([file, n]) => `${file}: ${n}`);
    const totalMatches = matches.length;
    const totalFiles = counts.size;
    const mWord = totalMatches === 1 ? "match" : "matches";
    const fWord = totalFiles === 1 ? "file" : "files";
    const summary = `${totalMatches} ${mWord} across ${totalFiles} ${fWord}`;
    lines.push("", meta?.truncated ? `${summary} (truncated)` : summary);
    return lines;
  }

  const hasContext = matches.some((m) => m.contextBefore !== undefined || m.contextAfter !== undefined);
  const out: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    if (hasContext && i > 0) out.push("--");
    for (const line of formatMatchLines(matches[i], isTTY)) {
      out.push(line);
    }
  }
  if (meta?.truncated) out.push(`(truncated: showing first ${meta.matchCount} of more matches)`);
  return out;
}

function formatMatchLines(match: Match, isTTY: boolean): string[] {
  const lines: string[] = [];

  for (const [idx, content] of (match.contextBefore ?? []).entries()) {
    const lineNum = match.line - (match.contextBefore!.length - idx);
    lines.push(`${match.file}:${lineNum}- ${content}`);
  }

  const loc = `${match.file}:${match.line}:${match.col}`;
  if (!match.source) {
    lines.push(loc);
  } else {
    const src = isTTY ? `${BOLD}${CYAN}${match.source}${RESET}` : match.source;
    let matchLine = `${loc}: ${src}`;
    if (match.captures && Object.keys(match.captures).length > 0) {
      const capStr = Object.entries(match.captures)
        .map(([k, v]) => `${k}=${/\s/.test(v) ? `"${v}"` : v}`)
        .join(" ");
      matchLine += ` | ${capStr}`;
    }
    lines.push(matchLine);
  }

  for (const [idx, content] of (match.contextAfter ?? []).entries()) {
    const lineNum = match.line + 1 + idx;
    lines.push(`${match.file}:${lineNum}- ${content}`);
  }

  if (match.astSubtree) {
    for (const astLine of match.astSubtree.split("\n")) {
      lines.push(`  ${astLine}`);
    }
  }

  return lines;
}
