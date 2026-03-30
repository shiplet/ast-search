import type { Match } from "./search.js";

const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

export function formatMatch(match: Match, isTTY: boolean): string {
  const prefix = `${match.file}:${match.line}:${match.col}: `;
  const text = isTTY ? `${BOLD}${CYAN}${match.text}${RESET}` : match.text;
  return prefix + text;
}

export function formatMatches(matches: Match[], isTTY: boolean): string[] {
  return matches.map((m) => formatMatch(m, isTTY));
}
