import { describe, it, expect } from "@jest/globals";
import { formatMatch, formatMatches } from "../output.js";
import type { Match } from "../search.js";

const m: Match = { file: "src/foo.ts", line: 42, col: 7, text: "ArrowFunctionExpression" };

describe("formatMatch", () => {
  it("produces file:line:col: text prefix", () => {
    const out = formatMatch(m, false);
    expect(out).toMatch(/^src\/foo\.ts:42:7: /);
  });

  it("includes source text in output", () => {
    const out = formatMatch(m, false);
    expect(out).toContain("ArrowFunctionExpression");
  });

  it("no ANSI codes when isTTY=false", () => {
    const out = formatMatch(m, false);
    // no ESC character
    expect(out).not.toContain("\x1b");
  });

  it("includes ANSI codes when isTTY=true", () => {
    const out = formatMatch(m, true);
    expect(out).toContain("\x1b[");
  });

  it("ANSI output still contains the text", () => {
    const out = formatMatch(m, true);
    expect(out).toContain("ArrowFunctionExpression");
  });

  it("ANSI output still has correct prefix", () => {
    const out = formatMatch(m, true);
    expect(out).toMatch(/src\/foo\.ts:42:7:/);
  });
});

describe("formatMatches", () => {
  it("returns one line per match", () => {
    const matches: Match[] = [
      { file: "a.ts", line: 1, col: 0, text: "Identifier" },
      { file: "b.ts", line: 2, col: 3, text: "CallExpression" },
    ];
    const lines = formatMatches(matches, false);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("a.ts:1:0:");
    expect(lines[1]).toContain("b.ts:2:3:");
  });

  it("returns empty array for no matches", () => {
    expect(formatMatches([], false)).toEqual([]);
  });
});
