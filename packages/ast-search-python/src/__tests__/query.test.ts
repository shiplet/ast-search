import { describe, expect, test, beforeAll } from "@jest/globals";
import { createRequire } from "module";
import path from "path";
import { runTreeSitterQuery, validateTreeSitterQuery } from "../query.js";

const _require = createRequire(import.meta.url);

let language: unknown;
let simpleAst: unknown;
let simpleParser: { parse(s: string): unknown };

const SIMPLE_SOURCE = "def hello(): pass\nclass Foo: pass\nx = 1\n";

beforeAll(async () => {
  const { default: Parser } = await import("web-tree-sitter");
  const wasmDir = path.dirname(_require.resolve("web-tree-sitter"));
  await Parser.init({
    locateFile: (_name: string) => path.join(wasmDir, "tree-sitter.wasm"),
  });
  const wasmPath = path.join(
    path.dirname(_require.resolve("tree-sitter-wasms/package.json")),
    "out",
    "tree-sitter-python.wasm",
  );
  const Python = await Parser.Language.load(wasmPath);
  const parser = new Parser();
  parser.setLanguage(Python);
  language = Python;
  simpleParser = parser as unknown as { parse(s: string): unknown };
  simpleAst = simpleParser.parse(SIMPLE_SOURCE);
});

describe("validateTreeSitterQuery", () => {
  test("accepts a valid S-expression pattern", () => {
    expect(() =>
      validateTreeSitterQuery("(function_definition) @fn", language),
    ).not.toThrow();
  });

  test("accepts a pattern with captures and predicates", () => {
    expect(() =>
      validateTreeSitterQuery(
        "(identifier) @n (#eq? @n \"hello\")",
        language,
      ),
    ).not.toThrow();
  });

  test("throws on a bare word (guard catches before tree-sitter)", () => {
    expect(() =>
      validateTreeSitterQuery("notapattern", language),
    ).toThrow(/Invalid tree-sitter query/);
  });

  test("throws on a pattern with an unknown node type", () => {
    expect(() =>
      validateTreeSitterQuery("(totally_nonexistent_node_type) @x", language),
    ).toThrow(/Invalid tree-sitter query/);
  });

  test("throws on a malformed S-expression", () => {
    expect(() =>
      validateTreeSitterQuery("(((unclosed", language),
    ).toThrow(/Invalid tree-sitter query/);
  });

  test("error for unknown node type includes show_ast hint", () => {
    let msg = "";
    try {
      validateTreeSitterQuery("(totally_nonexistent_node_type) @x", language);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain("show_ast");
  });

  test("error message includes the original tree-sitter error", () => {
    let msg = "";
    try {
      validateTreeSitterQuery("(totally_nonexistent_node_type) @x", language);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain("Invalid tree-sitter query");
  });
});

describe("runTreeSitterQuery", () => {
  test("returns matches for a valid pattern", () => {
    const matches = runTreeSitterQuery(
      simpleAst,
      "(function_definition) @fn",
      SIMPLE_SOURCE,
      "test.py",
      language,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].file).toBe("test.py");
    expect(matches[0].line).toBe(1);
    expect(matches[0].col).toBe(0);
    expect(matches[0].source).toBe("def hello(): pass");
  });

  test("returns correct line numbers (1-indexed)", () => {
    const matches = runTreeSitterQuery(
      simpleAst,
      "(class_definition) @cls",
      SIMPLE_SOURCE,
      "test.py",
      language,
    );
    expect(matches[0].line).toBe(2);
  });

  test("returns multiple matches", () => {
    const source = "def a(): pass\ndef b(): pass\ndef c(): pass\n";
    const ast = simpleParser.parse(source);
    const matches = runTreeSitterQuery(
      ast,
      "(function_definition) @fn",
      source,
      "multi.py",
      language,
    );
    expect(matches).toHaveLength(3);
    expect(matches.map((m) => m.source)).toEqual([
      "def a(): pass",
      "def b(): pass",
      "def c(): pass",
    ]);
  });

  test("returns empty array when nothing matches", () => {
    const matches = runTreeSitterQuery(
      simpleAst,
      "(import_statement) @i",
      SIMPLE_SOURCE,
      "test.py",
      language,
    );
    expect(matches).toHaveLength(0);
  });

  test("source field contains only the first line of a multi-line node", () => {
    const source = "def long(\n    a,\n    b\n):\n    pass\n";
    const ast = simpleParser.parse(source);
    const matches = runTreeSitterQuery(
      ast,
      "(function_definition) @fn",
      source,
      "long.py",
      language,
    );
    expect(matches[0].source).toBe("def long(");
    expect(matches[0].source).not.toContain("\n");
  });

  test("deduplicates nodes captured by multiple capture names", () => {
    const matches = runTreeSitterQuery(
      simpleAst,
      "(function_definition) @a (function_definition) @b",
      SIMPLE_SOURCE,
      "test.py",
      language,
    );
    expect(matches).toHaveLength(1);
  });

  test("returns matches for an S-expression without a capture name", () => {
    // (function_definition) has no @capture — should still return results
    const matches = runTreeSitterQuery(
      simpleAst,
      "(function_definition)",
      SIMPLE_SOURCE,
      "test.py",
      language,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toBe("def hello(): pass");
  });

  test("throws on a bare word before reaching tree-sitter", () => {
    expect(() =>
      runTreeSitterQuery(simpleAst, "bareword", SIMPLE_SOURCE, "test.py", language),
    ).toThrow(/Invalid tree-sitter query/);
  });

  test("match file field reflects the provided filePath", () => {
    const matches = runTreeSitterQuery(
      simpleAst,
      "(function_definition) @fn",
      SIMPLE_SOURCE,
      "path/to/my_file.py",
      language,
    );
    expect(matches[0].file).toBe("path/to/my_file.py");
  });
});

describe("runTreeSitterQuery — #match? predicate (regex filtering)", () => {
  test("#match? filters functions by regex on their name", () => {
    const source = "def log_event(): pass\ndef process(): pass\n";
    const ast = simpleParser.parse(source);
    const matches = runTreeSitterQuery(
      ast,
      '(function_definition name: (identifier) @name (#match? @name "^log")) @fn',
      source,
      "test.py",
      language,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toContain("log_event");
  });

  test("#match? with alternation matches multiple variants", () => {
    const source = "def log_it(): pass\ndef info_it(): pass\ndef debug_it(): pass\n";
    const ast = simpleParser.parse(source);
    const matches = runTreeSitterQuery(
      ast,
      '(function_definition name: (identifier) @name (#match? @name "^(log|info)")) @fn',
      source,
      "test.py",
      language,
    );
    expect(matches).toHaveLength(2);
    const sources = matches.map((m) => m.source);
    expect(sources.some((s) => s.includes("log_it"))).toBe(true);
    expect(sources.some((s) => s.includes("info_it"))).toBe(true);
  });
});

describe("runTreeSitterQuery — named captures in output", () => {
  test("named @captures appear in match.captures", () => {
    const source = "def greet(): pass\n";
    const ast = simpleParser.parse(source);
    const matches = runTreeSitterQuery(
      ast,
      "(function_definition name: (identifier) @name) @fn",
      source,
      "test.py",
      language,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].captures?.["name"]).toBe("greet");
    expect(matches[0].captures?.["fn"]).toContain("def greet");
  });

  test("@_ auto-capture is excluded from captures output", () => {
    // When user writes bare (function_definition), @_ is auto-appended
    const matches = runTreeSitterQuery(
      simpleAst,
      "(function_definition)",
      SIMPLE_SOURCE,
      "test.py",
      language,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].captures).toBeUndefined();
  });

  test("captures is absent when only @_ is present", () => {
    const matches = runTreeSitterQuery(
      simpleAst,
      "(function_definition) @_myinternal",
      SIMPLE_SOURCE,
      "test.py",
      language,
    );
    // @_myinternal starts with _ so should be excluded
    expect(matches[0].captures).toBeUndefined();
  });

  test("multiple captures from same pattern match grouped on one Match", () => {
    const source = 'import logging\nlogging.info("user logged in")\n';
    const ast = simpleParser.parse(source);
    const matches = runTreeSitterQuery(
      ast,
      "(call function: (attribute) @fn arguments: (argument_list (string) @msg)) @call",
      source,
      "test.py",
      language,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].captures?.["fn"]).toBe("logging.info");
    expect(matches[0].captures?.["msg"]).toBe('"user logged in"');
    expect(matches[0].captures?.["call"]).toContain("logging.info");
  });

  test("deduplication still works — same anchor position yields one result", () => {
    // Two patterns both match the same function_definition node
    const matches = runTreeSitterQuery(
      simpleAst,
      "(function_definition) @a (function_definition) @b",
      SIMPLE_SOURCE,
      "test.py",
      language,
    );
    expect(matches).toHaveLength(1);
  });
});
