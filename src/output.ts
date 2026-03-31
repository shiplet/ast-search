import type { Match } from "./search.js";

const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

export type OutputFormat = "text" | "json" | "files";

export function formatMatches(
  matches: Match[],
  isTTY: boolean,
  format: OutputFormat = "text",
): string[] {
  if (format === "json") {
    return [JSON.stringify(matches, null, 2)];
  }
  if (format === "files") {
    const seen = new Set<string>();
    return matches.map((m) => m.file).filter((f) => !seen.has(f) && !!seen.add(f));
  }
  return matches.map((m) => formatMatch(m, isTTY));
}

function formatMatch(match: Match, isTTY: boolean): string {
  const loc = `${match.file}:${match.line}:${match.col}`;
  if (!match.source) return loc;
  const src = isTTY ? `${BOLD}${CYAN}${match.source}${RESET}` : match.source;
  return `${loc}: ${src}`;
}
