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

describe("formatMatches — captures in text format", () => {
  it("appends captures after source with | separator", () => {
    const match: Match = {
      file: "src/app.ts",
      line: 10,
      col: 0,
      source: 'logger.info("hello")',
      captures: { "callee.property.name": "info" },
    };
    const [out] = formatMatches([match], false);
    expect(out).toContain("| callee.property.name=info");
  });

  it("double-quotes capture values that contain spaces", () => {
    const match: Match = {
      file: "src/app.ts",
      line: 1,
      col: 0,
      source: 'log("hello world")',
      captures: { "arguments.0.value": "hello world" },
    };
    const [out] = formatMatches([match], false);
    expect(out).toContain('arguments.0.value="hello world"');
  });

  it("does not quote capture values without spaces", () => {
    const match: Match = {
      file: "src/app.ts",
      line: 1,
      col: 0,
      source: "log()",
      captures: { "callee.name": "log" },
    };
    const [out] = formatMatches([match], false);
    expect(out).toContain("callee.name=log");
    expect(out).not.toContain('callee.name="log"');
  });

  it("shows multiple captures separated by spaces", () => {
    const match: Match = {
      file: "f.ts",
      line: 1,
      col: 0,
      source: "x",
      captures: { a: "foo", b: "bar" },
    };
    const [out] = formatMatches([match], false);
    expect(out).toContain("a=foo b=bar");
  });

  it("text format unchanged when captures is absent", () => {
    const [out] = formatMatches([m], false);
    expect(out).not.toContain("|");
  });

  it("text format unchanged when captures is empty (omit field)", () => {
    const match: Match = { file: "x.ts", line: 1, col: 0, source: "x()" };
    const [out] = formatMatches([match], false);
    expect(out).not.toContain("|");
  });

  it("json format includes captures field when present", () => {
    const match: Match = {
      file: "f.ts",
      line: 1,
      col: 0,
      source: "x()",
      captures: { name: "foo" },
    };
    const lines = formatMatches([match], false, "json");
    const parsed = JSON.parse(lines[0]);
    expect(parsed[0].captures).toEqual({ name: "foo" });
  });

  it("json format omits captures field when absent", () => {
    const lines = formatMatches([m], false, "json");
    const parsed = JSON.parse(lines[0]);
    expect(parsed[0].captures).toBeUndefined();
  });
});

describe("formatMatches — context lines in text format", () => {
  const withContext: Match = {
    file: "src/foo.ts",
    line: 5,
    col: 3,
    source: "foo()",
    contextBefore: ["const x = 1", ""],
    contextAfter: ["return x", ""],
  };

  it("context lines use file:N- format (dash, no col)", () => {
    const lines = formatMatches([withContext], false);
    expect(lines.some((l) => /src\/foo\.ts:\d+- /.test(l))).toBe(true);
  });

  it("match line retains file:line:col: format", () => {
    const lines = formatMatches([withContext], false);
    expect(lines.some((l) => l.startsWith("src/foo.ts:5:3: "))).toBe(true);
  });

  it("contextBefore lines appear before match with correct line numbers", () => {
    const lines = formatMatches([withContext], false);
    expect(lines[0]).toBe("src/foo.ts:3- const x = 1");
    expect(lines[1]).toBe("src/foo.ts:4- ");
    expect(lines[2]).toContain("src/foo.ts:5:3:");
  });

  it("contextAfter lines appear after match with correct line numbers", () => {
    const lines = formatMatches([withContext], false);
    expect(lines[3]).toBe("src/foo.ts:6- return x");
    expect(lines[4]).toBe("src/foo.ts:7- ");
  });

  it("inserts -- separator between multiple matches that have context", () => {
    const m2: Match = { ...withContext, file: "src/bar.ts", line: 2 };
    const lines = formatMatches([withContext, m2], false);
    expect(lines).toContain("--");
  });

  it("-- separator appears between groups, not at start or end", () => {
    const m2: Match = { ...withContext, file: "src/bar.ts", line: 2 };
    const lines = formatMatches([withContext, m2], false);
    const sepIdx = lines.indexOf("--");
    expect(sepIdx).toBeGreaterThan(0);
    expect(sepIdx).toBeLessThan(lines.length - 1);
  });

  it("no -- separator for a single match", () => {
    const lines = formatMatches([withContext], false);
    expect(lines).not.toContain("--");
  });

  it("no -- separator when no match has context", () => {
    const lines = formatMatches([m, m], false);
    expect(lines).not.toContain("--");
  });
});

describe("formatMatches — context in json format", () => {
  it("includes contextBefore and contextAfter in JSON when present", () => {
    const withContext: Match = {
      file: "f.ts",
      line: 3,
      col: 0,
      source: "x()",
      contextBefore: ["before"],
      contextAfter: ["after"],
    };
    const [json] = formatMatches([withContext], false, "json");
    const parsed = JSON.parse(json);
    expect(parsed[0].contextBefore).toEqual(["before"]);
    expect(parsed[0].contextAfter).toEqual(["after"]);
  });

  it("omits contextBefore/contextAfter from JSON when absent", () => {
    const [json] = formatMatches([m], false, "json");
    const parsed = JSON.parse(json);
    expect(parsed[0].contextBefore).toBeUndefined();
    expect(parsed[0].contextAfter).toBeUndefined();
  });
});

describe("formatMatches — files format unaffected by context", () => {
  it("returns only file paths even when matches have context fields", () => {
    const withContext: Match = {
      file: "src/foo.ts",
      line: 5,
      col: 3,
      source: "foo()",
      contextBefore: ["before"],
      contextAfter: ["after"],
    };
    const lines = formatMatches([withContext], false, "files");
    expect(lines).toEqual(["src/foo.ts"]);
  });
});
