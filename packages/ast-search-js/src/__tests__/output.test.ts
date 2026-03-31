import { describe, it, expect } from "@jest/globals";
import { formatMatches } from "../output.js";
import type { Match } from "../search.js";

const m: Match = { file: "src/foo.ts", line: 42, col: 7, source: "const x = () => {}" };

describe("formatMatches — text format (default)", () => {
  it("produces file:line:col: source prefix", () => {
    const [out] = formatMatches([m], false);
    expect(out).toMatch(/^src\/foo\.ts:42:7: /);
  });

  it("includes source text in output", () => {
    const [out] = formatMatches([m], false);
    expect(out).toContain("const x = () => {}");
  });

  it("no ANSI codes when isTTY=false", () => {
    const [out] = formatMatches([m], false);
    expect(out).not.toContain("\x1b");
  });

  it("includes ANSI codes when isTTY=true", () => {
    const [out] = formatMatches([m], true);
    expect(out).toContain("\x1b[");
  });

  it("ANSI output still contains the source text", () => {
    const [out] = formatMatches([m], true);
    expect(out).toContain("const x = () => {}");
  });

  it("ANSI output still has correct prefix", () => {
    const [out] = formatMatches([m], true);
    expect(out).toMatch(/src\/foo\.ts:42:7:/);
  });

  it("returns one line per match", () => {
    const matches: Match[] = [
      { file: "a.ts", line: 1, col: 0, source: "foo()" },
      { file: "b.ts", line: 2, col: 3, source: "bar()" },
    ];
    const lines = formatMatches(matches, false);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("a.ts:1:0:");
    expect(lines[1]).toContain("b.ts:2:3:");
  });

  it("returns empty array for no matches", () => {
    expect(formatMatches([], false)).toEqual([]);
  });

  it("shows only location when source is empty", () => {
    const noSource: Match = { file: "x.ts", line: 1, col: 0, source: "" };
    const [out] = formatMatches([noSource], false);
    expect(out).toBe("x.ts:1:0");
  });
});

describe("formatMatches — json format", () => {
  it("returns a single JSON string", () => {
    const lines = formatMatches([m], false, "json");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].file).toBe("src/foo.ts");
  });

  it("returns empty JSON array for no matches", () => {
    const lines = formatMatches([], false, "json");
    expect(JSON.parse(lines[0])).toEqual([]);
  });
});

describe("formatMatches — files format", () => {
  it("returns deduplicated file paths", () => {
    const matches: Match[] = [
      { file: "a.ts", line: 1, col: 0, source: "x" },
      { file: "a.ts", line: 5, col: 0, source: "y" },
      { file: "b.ts", line: 2, col: 0, source: "z" },
    ];
    const lines = formatMatches(matches, false, "files");
    expect(lines).toEqual(["a.ts", "b.ts"]);
  });

  it("returns empty array for no matches", () => {
    expect(formatMatches([], false, "files")).toEqual([]);
  });
});
