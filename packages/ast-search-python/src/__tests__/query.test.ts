import { describe, expect, test } from "@jest/globals";
import { createRequire } from "module";
import { runTreeSitterQuery, validateTreeSitterQuery } from "../query.js";

const _require = createRequire(import.meta.url);
const Parser = _require("tree-sitter") as {
  new (): { setLanguage(lang: unknown): void; parse(source: string): unknown };
  Query: unknown;
};
const pythonModule = _require("tree-sitter-python") as { language: unknown };

const parser = new Parser();
parser.setLanguage(pythonModule);
const language = pythonModule.language;
// Cast to never to pass through the opaque TSQueryConstructor interface
const QueryClass = Parser.Query as never;

const SIMPLE_SOURCE = "def hello(): pass\nclass Foo: pass\nx = 1\n";
const simpleAst = parser.parse(SIMPLE_SOURCE);

describe("validateTreeSitterQuery", () => {
  test("accepts a valid S-expression pattern", () => {
    expect(() =>
      validateTreeSitterQuery("(function_definition) @fn", language, QueryClass),
    ).not.toThrow();
  });

  test("accepts a pattern with captures and predicates", () => {
    expect(() =>
      validateTreeSitterQuery(
        "(identifier) @n (#eq? @n \"hello\")",
        language,
        QueryClass,
      ),
    ).not.toThrow();
  });

  test("throws on a bare word (guard catches before tree-sitter)", () => {
    expect(() =>
      validateTreeSitterQuery("notapattern", language, QueryClass),
    ).toThrow(/Invalid tree-sitter query/);
  });

  test("throws on a pattern with an unknown node type", () => {
    expect(() =>
      validateTreeSitterQuery("(totally_nonexistent_node_type) @x", language, QueryClass),
    ).toThrow(/Invalid tree-sitter query/);
  });

  test("throws on a malformed S-expression", () => {
    expect(() =>
      validateTreeSitterQuery("(((unclosed", language, QueryClass),
    ).toThrow(/Invalid tree-sitter query/);
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
      QueryClass,
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
      QueryClass,
    );
    expect(matches[0].line).toBe(2);
  });

  test("returns multiple matches", () => {
    const source = "def a(): pass\ndef b(): pass\ndef c(): pass\n";
    const ast = parser.parse(source);
    const matches = runTreeSitterQuery(
      ast,
      "(function_definition) @fn",
      source,
      "multi.py",
      language,
      QueryClass,
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
      QueryClass,
    );
    expect(matches).toHaveLength(0);
  });

  test("source field contains only the first line of a multi-line node", () => {
    const source = "def long(\n    a,\n    b\n):\n    pass\n";
    const ast = parser.parse(source);
    const matches = runTreeSitterQuery(
      ast,
      "(function_definition) @fn",
      source,
      "long.py",
      language,
      QueryClass,
    );
    expect(matches[0].source).toBe("def long(");
    expect(matches[0].source).not.toContain("\n");
  });

  test("deduplicates nodes captured by multiple capture names", () => {
    // A pattern that captures the same node under two names
    const matches = runTreeSitterQuery(
      simpleAst,
      "(function_definition) @a (function_definition) @b",
      SIMPLE_SOURCE,
      "test.py",
      language,
      QueryClass,
    );
    // Should report the function_definition only once
    expect(matches).toHaveLength(1);
  });

  test("throws on a bare word before reaching tree-sitter", () => {
    expect(() =>
      runTreeSitterQuery(simpleAst, "bareword", SIMPLE_SOURCE, "test.py", language, QueryClass),
    ).toThrow(/Invalid tree-sitter query/);
  });

  test("match file field reflects the provided filePath", () => {
    const matches = runTreeSitterQuery(
      simpleAst,
      "(function_definition) @fn",
      SIMPLE_SOURCE,
      "path/to/my_file.py",
      language,
      QueryClass,
    );
    expect(matches[0].file).toBe("path/to/my_file.py");
  });
});
