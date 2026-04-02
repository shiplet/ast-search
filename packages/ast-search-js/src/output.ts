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

  const hasContext = matches.some((m) => m.contextBefore !== undefined || m.contextAfter !== undefined);
  const out: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    if (hasContext && i > 0) out.push("--");
    for (const line of formatMatchLines(matches[i], isTTY)) {
      out.push(line);
    }
  }
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

  return lines;
}
