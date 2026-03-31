import { describe, expect, test } from "@jest/globals";
import { PythonLanguageBackend, register } from "../index.js";
import { LanguageRegistry } from "ast-search-js/plugin";

const backend = new PythonLanguageBackend();

const FIXTURES = {
  functions: `
def greet(name):
    return f"Hello, {name}!"

async def fetch(url):
    pass

class MyService:
    def process(self):
        return None
`.trimStart(),

  imports: `
import os
import sys
from pathlib import Path
from typing import List, Optional
`.trimStart(),

  control: `
x = 1
y = x + 2

for i in range(10):
    pass

while True:
    break

if x > 0:
    pass
`.trimStart(),

  decorators: `
@staticmethod
def helper():
    pass

@property
def value(self):
    return self._value
`.trimStart(),

  comprehensions: `
squares = [x * x for x in range(10)]
evens = {x for x in range(10) if x % 2 == 0}
mapping = {k: v for k, v in items.items()}
gen = (x for x in range(10))
`.trimStart(),

  empty: "",
};

describe("PythonLanguageBackend — identity", () => {
  test("langId is 'python'", () => {
    expect(backend.langId).toBe("python");
  });

  test("name is 'Python'", () => {
    expect(backend.name).toBe("Python");
  });

  test("extensions includes .py and .pyw", () => {
    expect(backend.extensions.has(".py")).toBe(true);
    expect(backend.extensions.has(".pyw")).toBe(true);
  });
});

describe("PythonLanguageBackend.parse", () => {
  test("returns a truthy AST for valid Python source", async () => {
    const ast = await backend.parse(FIXTURES.functions, "test.py");
    expect(ast).toBeTruthy();
  });

  test("returns an AST for an empty file", async () => {
    const ast = await backend.parse(FIXTURES.empty, "empty.py");
    expect(ast).toBeTruthy();
  });

  test("returns an AST for a file with syntax errors (tree-sitter is resilient)", async () => {
    // tree-sitter produces error nodes but does not throw
    const ast = await backend.parse("def (((broken:", "bad.py");
    expect(ast).toBeTruthy();
  });
});

describe("PythonLanguageBackend.query — shorthands", () => {
  test("'fn' matches function definitions", async () => {
    const ast = await backend.parse(FIXTURES.functions, "test.py");
    const matches = await backend.query(ast, "fn", FIXTURES.functions, "test.py");
    expect(matches.length).toBeGreaterThanOrEqual(3); // greet, fetch, process
    expect(matches.every((m) => m.source.startsWith("def ") || m.source.startsWith("async def "))).toBe(true);
  });

  test("'fn' matches async functions (same node type as sync)", async () => {
    const ast = await backend.parse(FIXTURES.functions, "test.py");
    const matches = await backend.query(ast, "fn", FIXTURES.functions, "test.py");
    expect(matches.some((m) => m.source.startsWith("async def "))).toBe(true);
  });

  test("'class' matches class definitions", async () => {
    const ast = await backend.parse(FIXTURES.functions, "test.py");
    const matches = await backend.query(ast, "class", FIXTURES.functions, "test.py");
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toMatch(/^class /);
  });

  test("'import' matches import statements", async () => {
    const ast = await backend.parse(FIXTURES.imports, "test.py");
    const matches = await backend.query(ast, "import", FIXTURES.imports, "test.py");
    expect(matches.length).toBeGreaterThanOrEqual(2); // import os, import sys
  });

  test("'from' matches from-import statements", async () => {
    const ast = await backend.parse(FIXTURES.imports, "test.py");
    const matches = await backend.query(ast, "from", FIXTURES.imports, "test.py");
    expect(matches.length).toBeGreaterThanOrEqual(2); // from pathlib, from typing
  });

  test("'return' matches return statements", async () => {
    const ast = await backend.parse(FIXTURES.functions, "test.py");
    const matches = await backend.query(ast, "return", FIXTURES.functions, "test.py");
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  test("'for' matches for statements", async () => {
    const ast = await backend.parse(FIXTURES.control, "test.py");
    const matches = await backend.query(ast, "for", FIXTURES.control, "test.py");
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toMatch(/^for /);
  });

  test("'while' matches while statements", async () => {
    const ast = await backend.parse(FIXTURES.control, "test.py");
    const matches = await backend.query(ast, "while", FIXTURES.control, "test.py");
    expect(matches).toHaveLength(1);
  });

  test("'if' matches if statements", async () => {
    const ast = await backend.parse(FIXTURES.control, "test.py");
    const matches = await backend.query(ast, "if", FIXTURES.control, "test.py");
    expect(matches).toHaveLength(1);
  });

  test("'assign' matches assignment statements", async () => {
    const ast = await backend.parse(FIXTURES.control, "test.py");
    const matches = await backend.query(ast, "assign", FIXTURES.control, "test.py");
    expect(matches.length).toBeGreaterThanOrEqual(2); // x = 1, y = x + 2
  });

  test("'decorator' matches decorators", async () => {
    const ast = await backend.parse(FIXTURES.decorators, "test.py");
    const matches = await backend.query(ast, "decorator", FIXTURES.decorators, "test.py");
    expect(matches).toHaveLength(2);
  });

  test("'comp' matches list comprehensions", async () => {
    const ast = await backend.parse(FIXTURES.comprehensions, "test.py");
    const matches = await backend.query(ast, "comp", FIXTURES.comprehensions, "test.py");
    expect(matches).toHaveLength(1);
  });

  test("'lambda' matches lambda expressions", async () => {
    const source = "f = lambda x: x * 2\n";
    const ast = await backend.parse(source, "test.py");
    const matches = await backend.query(ast, "lambda", source, "test.py");
    expect(matches).toHaveLength(1);
  });

  test("returns empty array when nothing matches", async () => {
    const ast = await backend.parse(FIXTURES.functions, "test.py");
    const matches = await backend.query(ast, "import", FIXTURES.functions, "test.py");
    expect(matches).toHaveLength(0);
  });
});

describe("PythonLanguageBackend.query — raw S-expressions", () => {
  test("raw pattern with capture returns matches", async () => {
    const ast = await backend.parse(FIXTURES.functions, "test.py");
    const matches = await backend.query(ast, "(function_definition) @fn", FIXTURES.functions, "test.py");
    expect(matches.length).toBeGreaterThan(0);
  });

  test("attribute filter: match function with specific name", async () => {
    const ast = await backend.parse(FIXTURES.functions, "test.py");
    const matches = await backend.query(
      ast,
      "(function_definition name: (identifier) @n (#eq? @n \"greet\")) @fn",
      FIXTURES.functions,
      "test.py",
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.source.includes("greet"))).toBe(true);
  });

  test("attribute filter: no match when name differs", async () => {
    const ast = await backend.parse(FIXTURES.functions, "test.py");
    const matches = await backend.query(
      ast,
      "(function_definition name: (identifier) @n (#eq? @n \"nonexistent\")) @fn",
      FIXTURES.functions,
      "test.py",
    );
    expect(matches).toHaveLength(0);
  });

  test("#eq? filters method calls by object name", async () => {
    // foo.bar() and baz.bar() are both (call (attribute (identifier) ...))
    // #eq? should keep only captures related to foo, not baz
    const source = "foo.bar()\nbaz.bar()\n";
    const ast = await backend.parse(source, "test.py");
    const matches = await backend.query(
      ast,
      "(call function: (attribute object: (identifier) @obj) (#eq? @obj \"foo\")) @call",
      source,
      "test.py",
    );
    // captures() returns all named captures: @call (the whole call) and @obj (the identifier)
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.source === "foo.bar()")).toBe(true);
    expect(matches.every((m) => !m.source.includes("baz"))).toBe(true);
  });

  test("match objects have correct shape", async () => {
    const ast = await backend.parse(FIXTURES.functions, "test.py");
    const [match] = await backend.query(ast, "fn", FIXTURES.functions, "test.py");
    expect(typeof match.file).toBe("string");
    expect(typeof match.line).toBe("number");
    expect(typeof match.col).toBe("number");
    expect(typeof match.source).toBe("string");
  });

  test("line numbers are 1-indexed", async () => {
    const source = "x = 1\ndef second(): pass\n";
    const ast = await backend.parse(source, "test.py");
    const matches = await backend.query(ast, "fn", source, "test.py");
    expect(matches[0].line).toBe(2);
  });

  test("source is trimmed to the first line", async () => {
    const source = "def multi(\n    a,\n    b,\n): pass\n";
    const ast = await backend.parse(source, "test.py");
    const [match] = await backend.query(ast, "fn", source, "test.py");
    expect(match.source).not.toContain("\n");
    expect(match.source).toBe("def multi(");
  });
});

describe("PythonLanguageBackend.validateSelector", () => {
  test("accepts a valid shorthand", async () => {
    await expect(backend.validateSelector("fn")).resolves.not.toThrow();
  });

  test("accepts a valid raw S-expression", async () => {
    await expect(backend.validateSelector("(function_definition) @fn")).resolves.not.toThrow();
  });

  test("accepts a pattern with predicates", async () => {
    await expect(
      backend.validateSelector("(identifier) @n (#eq? @n \"foo\")"),
    ).resolves.not.toThrow();
  });

  test("throws on a bare unknown word", async () => {
    await expect(backend.validateSelector("not_a_shorthand")).rejects.toThrow(/Invalid tree-sitter query/);
  });

  test("throws on an unknown node type", async () => {
    await expect(backend.validateSelector("(nonexistent_type) @x")).rejects.toThrow(/Invalid tree-sitter query/);
  });

  test("throws on a malformed S-expression", async () => {
    await expect(backend.validateSelector("(((unclosed")).rejects.toThrow(/Invalid tree-sitter query/);
  });

  test("error message identifies it as a tree-sitter query error", async () => {
    let message = "";
    try {
      await backend.validateSelector("bad_input");
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toMatch(/Invalid tree-sitter query/);
  });
});

describe("register", () => {
  test("registers the Python backend in a LanguageRegistry", () => {
    const registry = new LanguageRegistry();
    register(registry);
    expect(registry.getByExtension(".py")).toBeTruthy();
    expect(registry.getByExtension(".py")?.langId).toBe("python");
  });

  test("registers .pyw extension as well", () => {
    const registry = new LanguageRegistry();
    register(registry);
    expect(registry.getByExtension(".pyw")).toBeTruthy();
  });

  test("backend is retrievable by langId after registration", () => {
    const registry = new LanguageRegistry();
    register(registry);
    expect(registry.getByLangId("python")).toBeTruthy();
  });

  test("allExtensions includes Python extensions after registration", () => {
    const registry = new LanguageRegistry();
    register(registry);
    expect(registry.allExtensions.has(".py")).toBe(true);
    expect(registry.allExtensions.has(".pyw")).toBe(true);
  });
});
