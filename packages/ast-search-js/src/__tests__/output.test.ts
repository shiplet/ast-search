import { describe, it, expect } from "@jest/globals";
import { formatMatches, type SearchMeta } from "../output.js";
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

const baseMeta: SearchMeta = {
  matchCount: 1,
  filesSearched: 10,
  wallMs: 42,
  queries: ["FunctionDeclaration"],
  truncated: false,
};

describe("formatMatches — json format with meta", () => {
  it("wraps matches under 'matches' key when meta is provided", () => {
    const [json] = formatMatches([m], false, "json", baseMeta);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed.matches)).toBe(true);
    expect(parsed.matches[0].file).toBe("src/foo.ts");
  });

  it("includes _meta object at top level", () => {
    const [json] = formatMatches([m], false, "json", baseMeta);
    const parsed = JSON.parse(json);
    expect(parsed._meta).toBeDefined();
    expect(parsed._meta.matchCount).toBe(1);
    expect(parsed._meta.filesSearched).toBe(10);
    expect(parsed._meta.wallMs).toBe(42);
    expect(parsed._meta.queries).toEqual(["FunctionDeclaration"]);
    expect(parsed._meta.truncated).toBe(false);
  });

  it("reflects truncated: true in _meta when limit was reached", () => {
    const [json] = formatMatches([m], false, "json", { ...baseMeta, truncated: true });
    const parsed = JSON.parse(json);
    expect(parsed._meta.truncated).toBe(true);
  });

  it("matches array is empty when no matches but meta is provided", () => {
    const [json] = formatMatches([], false, "json", { ...baseMeta, matchCount: 0 });
    const parsed = JSON.parse(json);
    expect(parsed.matches).toEqual([]);
    expect(parsed._meta.matchCount).toBe(0);
  });
});

describe("formatMatches — truncation notices", () => {
  const truncatedMeta: SearchMeta = { ...baseMeta, truncated: true, matchCount: 5 };

  it("text format appends truncation notice when truncated", () => {
    const lines = formatMatches([m], false, "text", truncatedMeta);
    expect(lines[lines.length - 1]).toContain("truncated");
    expect(lines[lines.length - 1]).toContain("5");
  });

  it("text format has no truncation notice when not truncated", () => {
    const lines = formatMatches([m], false, "text", baseMeta);
    expect(lines.every((l) => !l.includes("truncated"))).toBe(true);
  });

  it("files format appends truncation notice when truncated", () => {
    const lines = formatMatches([m], false, "files", truncatedMeta);
    expect(lines[lines.length - 1]).toContain("truncated");
  });

  it("files format has no truncation notice when not truncated", () => {
    const lines = formatMatches([m], false, "files", baseMeta);
    expect(lines.every((l) => !l.includes("truncated"))).toBe(true);
  });

  it("count format summary includes '(truncated)' when truncated", () => {
    const matches: Match[] = [
      { file: "a.ts", line: 1, col: 0, source: "x" },
      { file: "b.ts", line: 2, col: 0, source: "y" },
    ];
    const lines = formatMatches(matches, false, "count", truncatedMeta);
    expect(lines[lines.length - 1]).toContain("(truncated)");
  });

  it("count format summary has no '(truncated)' when not truncated", () => {
    const matches: Match[] = [{ file: "a.ts", line: 1, col: 0, source: "x" }];
    const lines = formatMatches(matches, false, "count", baseMeta);
    expect(lines[lines.length - 1]).not.toContain("(truncated)");
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

describe("formatMatches — count format", () => {
  it("returns empty array for no matches", () => {
    expect(formatMatches([], false, "count")).toEqual([]);
  });

  it("shows file: N line and summary for a single file", () => {
    const matches: Match[] = [
      { file: "src/foo.ts", line: 1, col: 0, source: "x()" },
      { file: "src/foo.ts", line: 5, col: 0, source: "y()" },
    ];
    const lines = formatMatches(matches, false, "count");
    expect(lines[0]).toBe("src/foo.ts: 2");
    expect(lines[lines.length - 1]).toBe("2 matches across 1 file");
  });

  it("sorts files descending by match count", () => {
    const matches: Match[] = [
      { file: "a.ts", line: 1, col: 0, source: "x" },
      { file: "b.ts", line: 1, col: 0, source: "x" },
      { file: "b.ts", line: 2, col: 0, source: "x" },
      { file: "b.ts", line: 3, col: 0, source: "x" },
    ];
    const lines = formatMatches(matches, false, "count");
    expect(lines[0]).toBe("b.ts: 3");
    expect(lines[1]).toBe("a.ts: 1");
  });

  it("emits a blank line before the summary", () => {
    const matches: Match[] = [{ file: "a.ts", line: 1, col: 0, source: "x" }];
    const lines = formatMatches(matches, false, "count");
    expect(lines[lines.length - 2]).toBe("");
  });

  it("uses singular 'match' and 'file' for a single match in one file", () => {
    const matches: Match[] = [{ file: "a.ts", line: 1, col: 0, source: "x" }];
    const lines = formatMatches(matches, false, "count");
    expect(lines[lines.length - 1]).toBe("1 match across 1 file");
  });

  it("uses plural 'matches' and 'files' for multiple matches across multiple files", () => {
    const matches: Match[] = [
      { file: "a.ts", line: 1, col: 0, source: "x" },
      { file: "b.ts", line: 2, col: 0, source: "y" },
    ];
    const lines = formatMatches(matches, false, "count");
    expect(lines[lines.length - 1]).toBe("2 matches across 2 files");
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

describe("formatMatches — astSubtree in text format (--show-ast)", () => {
  const withSubtree: Match = {
    file: "src/app.ts",
    line: 3,
    col: 0,
    source: "foo(bar)",
    astSubtree: "CallExpression\n  callee: Identifier [name=\"foo\"]\n  arguments[0]: Identifier [name=\"bar\"]",
  };

  it("prints astSubtree lines indented below the match line", () => {
    const lines = formatMatches([withSubtree], false);
    expect(lines[0]).toContain("src/app.ts:3:0: foo(bar)");
    // formatMatchLines prepends two spaces to every astSubtree line;
    // child lines already have two spaces from printMatchNode, so they get four total.
    expect(lines[1]).toBe("  CallExpression");
    expect(lines[2]).toBe('    callee: Identifier [name="foo"]');
    expect(lines[3]).toBe('    arguments[0]: Identifier [name="bar"]');
  });

  it("the first astSubtree line (root node type) is prefixed with exactly two spaces", () => {
    const lines = formatMatches([withSubtree], false);
    expect(lines[1]).toMatch(/^  \S/); // exactly two leading spaces
  });

  it("match without astSubtree produces a single line", () => {
    const lines = formatMatches([m], false);
    expect(lines).toHaveLength(1);
  });

  it("json format includes astSubtree as a string field", () => {
    const [json] = formatMatches([withSubtree], false, "json");
    const parsed = JSON.parse(json);
    expect(typeof parsed[0].astSubtree).toBe("string");
    expect(parsed[0].astSubtree).toContain("CallExpression");
  });

  it("json format omits astSubtree when absent", () => {
    const [json] = formatMatches([m], false, "json");
    const parsed = JSON.parse(json);
    expect(parsed[0].astSubtree).toBeUndefined();
  });

  it("files format is not affected by astSubtree", () => {
    const lines = formatMatches([withSubtree], false, "files");
    expect(lines).toEqual(["src/app.ts"]);
  });
});
