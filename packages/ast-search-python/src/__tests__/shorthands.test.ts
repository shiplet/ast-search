import { describe, expect, test } from "@jest/globals";
import { PYTHON_SHORTHANDS, expandShorthands } from "../shorthands.js";

describe("PYTHON_SHORTHANDS", () => {
  test("all shorthands expand to valid S-expression patterns starting with (", () => {
    for (const [key, value] of Object.entries(PYTHON_SHORTHANDS)) {
      expect(`${key}: ${value.trimStart()}`).toMatch(/^[^:]+: \(/);
    }
  });

  test("all shorthands include a capture annotation @", () => {
    for (const [key, value] of Object.entries(PYTHON_SHORTHANDS)) {
      expect(`${key}: ${value}`).toMatch(/@/);
    }
  });

  test("covers core cross-language shorthands", () => {
    const required = ["fn", "call", "class", "assign", "return", "await", "import", "if", "for", "while"];
    for (const key of required) {
      expect(PYTHON_SHORTHANDS).toHaveProperty(key);
    }
  });
});

describe("expandShorthands", () => {
  test("expands a bare shorthand", () => {
    expect(expandShorthands("fn")).toBe("(function_definition) @_");
  });

  test("expands multiple shorthands in one string", () => {
    const result = expandShorthands("fn class");
    expect(result).toContain("(function_definition) @_");
    expect(result).toContain("(class_definition) @_");
  });

  test("does not expand shorthands inside double-quoted strings", () => {
    const result = expandShorthands('(identifier) @n (#eq? @n "fn")');
    expect(result).toBe('(identifier) @n (#eq? @n "fn")');
  });

  test("does not expand shorthands inside single-quoted strings", () => {
    const result = expandShorthands("(identifier) @n (#eq? @n 'fn')");
    expect(result).toBe("(identifier) @n (#eq? @n 'fn')");
  });

  test("expands shorthand before a quoted string but not inside it", () => {
    const result = expandShorthands('fn (#eq? @_ "call")');
    expect(result).toContain("(function_definition) @_");
    expect(result).toContain('"call"');
    expect(result).not.toContain('"(call) @_"');
  });

  test("leaves unknown words unchanged", () => {
    expect(expandShorthands("not_a_shorthand")).toBe("not_a_shorthand");
  });

  test("does not partially match inside longer words", () => {
    // "for_loop" should not expand "for" inside it
    expect(expandShorthands("for_loop")).toBe("for_loop");
  });

  test("expands shorthand at word boundary only", () => {
    const result = expandShorthands("for");
    expect(result).toBe("(for_statement) @_");
  });

  test("does not expand shorthand words used as capture names (preceded by @)", () => {
    // @fn should stay @fn, not become @(function_definition) @_
    expect(expandShorthands("(identifier) @fn")).toBe("(identifier) @fn");
    expect(expandShorthands("(node) @call")).toBe("(node) @call");
    expect(expandShorthands("(node) @for")).toBe("(node) @for");
  });

  test("passes through a raw S-expression unchanged", () => {
    const raw = "(function_definition name: (identifier) @name) @fn";
    expect(expandShorthands(raw)).toBe(raw);
  });

  test("does not expand node type names inside S-expressions (preceded by open paren)", () => {
    // call, await, yield, lambda, decorator have shorthand names that are also
    // tree-sitter node types; they must not be expanded when used as type names.
    expect(expandShorthands("(call) @c")).toBe("(call) @c");
    expect(expandShorthands("(await) @a")).toBe("(await) @a");
    expect(expandShorthands("(lambda) @l")).toBe("(lambda) @l");
    expect(expandShorthands("(decorator) @d")).toBe("(decorator) @d");
    // Bare usage should still expand
    expect(expandShorthands("call")).toBe("(call) @_");
    expect(expandShorthands("await")).toBe("(await) @_");
  });

  test("expands all documented shorthands without error", () => {
    for (const key of Object.keys(PYTHON_SHORTHANDS)) {
      expect(() => expandShorthands(key)).not.toThrow();
      expect(expandShorthands(key)).toBe(PYTHON_SHORTHANDS[key]);
    }
  });
});
