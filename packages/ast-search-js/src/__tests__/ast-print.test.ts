import { describe, it, expect } from "@jest/globals";
import { getAst } from "../file.js";
import { printAstText, printAstJson } from "../ast-print.js";

// ---------------------------------------------------------------------------
// printAstText
// ---------------------------------------------------------------------------

describe("printAstText — node types", () => {
  it("shows the top-level node type", () => {
    const text = printAstText(getAst("const x = 1"));
    expect(text).toMatch(/^VariableDeclaration/);
  });

  it("skips the File and Program wrapper nodes", () => {
    const text = printAstText(getAst("const x = 1"));
    expect(text).not.toContain("File");
    expect(text).not.toContain("Program");
  });

  it("shows child node types indented and labeled", () => {
    const text = printAstText(getAst("const x = 1"));
    expect(text).toContain("declarations[0]: VariableDeclarator");
    expect(text).toContain("id: Identifier");
    expect(text).toContain("init: NumericLiteral");
  });

  it("shows all body nodes for multi-statement input", () => {
    const text = printAstText(getAst("const a = 1;\nconst b = 2;"));
    const matches = text.match(/^VariableDeclaration/gm);
    expect(matches).toHaveLength(2);
  });
});

describe("printAstText — inline primitive props", () => {
  it("shows string props as key=\"value\"", () => {
    const text = printAstText(getAst("const x = 1"));
    expect(text).toContain('[kind="const"]');
  });

  it("shows identifier names", () => {
    const text = printAstText(getAst("const myVar = 1"));
    expect(text).toContain('[name="myVar"]');
  });

  it("shows string literal values", () => {
    const text = printAstText(getAst('const s = "hello"'));
    expect(text).toContain('[value="hello"]');
  });

  it("shows numeric literal values without quotes", () => {
    const text = printAstText(getAst("const n = 42"));
    expect(text).toContain("[value=42]");
  });

  it("shows boolean props without quotes", () => {
    const text = printAstText(getAst("async function f() {}"));
    expect(text).toContain("async=true");
    expect(text).not.toContain('async="true"');
  });

  it("shows computed=false on member expressions", () => {
    const text = printAstText(getAst("foo.bar"));
    expect(text).toContain("[computed=false]");
  });
});

describe("printAstText — noisy fields excluded", () => {
  it("does not include start or end character offsets", () => {
    const text = printAstText(getAst("const x = 1"));
    // "start" and "end" as keys in the output (not as part of other words)
    expect(text).not.toMatch(/\bstart=/);
    expect(text).not.toMatch(/\bend=/);
  });

  it("does not include loc", () => {
    const text = printAstText(getAst("const x = 1"));
    expect(text).not.toContain("loc");
  });

  it("does not include extra", () => {
    const text = printAstText(getAst("const x = 1"));
    expect(text).not.toContain("extra");
  });
});

describe("printAstText — structure", () => {
  it("indents child nodes relative to parent", () => {
    const text = printAstText(getAst("const x = 1"));
    const lines = text.split("\n");
    const decl = lines.findIndex((l) => l.startsWith("VariableDeclaration"));
    const declarator = lines.findIndex((l) => l.includes("VariableDeclarator"));
    expect(decl).toBeGreaterThanOrEqual(0);
    expect(declarator).toBeGreaterThan(decl);
    expect(lines[declarator]).toMatch(/^ {2}/); // indented 2 spaces
  });

  it("labels array children with index notation", () => {
    const text = printAstText(getAst("foo(a, b)"));
    expect(text).toContain("arguments[0]");
    expect(text).toContain("arguments[1]");
  });

  it("labels named child properties", () => {
    const text = printAstText(getAst("foo.bar()"));
    expect(text).toContain("callee: MemberExpression");
    expect(text).toContain("object: Identifier");
    expect(text).toContain("property: Identifier");
  });

  it("returns empty string for empty input", () => {
    const text = printAstText(getAst(""));
    expect(text).toBe("");
  });
});

// ---------------------------------------------------------------------------
// printAstJson
// ---------------------------------------------------------------------------

describe("printAstJson — structure", () => {
  it("returns valid JSON", () => {
    expect(() => JSON.parse(printAstJson(getAst("const x = 1")))).not.toThrow();
  });

  it("returns the single statement object directly (not array) for one statement", () => {
    const parsed = JSON.parse(printAstJson(getAst("const x = 1")));
    expect(parsed.type).toBe("VariableDeclaration");
  });

  it("returns an array for multiple statements", () => {
    const parsed = JSON.parse(printAstJson(getAst("const a = 1;\nconst b = 2;")));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it("does not include start or end offsets", () => {
    const parsed = JSON.parse(printAstJson(getAst("const x = 1")));
    expect(parsed.start).toBeUndefined();
    expect(parsed.end).toBeUndefined();
  });

  it("does not include loc", () => {
    const parsed = JSON.parse(printAstJson(getAst("const x = 1")));
    expect(parsed.loc).toBeUndefined();
  });

  it("does not include extra", () => {
    const parsed = JSON.parse(printAstJson(getAst('const s = "hello"')));
    const str = JSON.stringify(parsed);
    expect(str).not.toContain('"extra"');
  });

  it("includes semantic fields: type, kind, name, value", () => {
    const parsed = JSON.parse(printAstJson(getAst("const x = 1")));
    expect(parsed.type).toBe("VariableDeclaration");
    expect(parsed.kind).toBe("const");
    expect(parsed.declarations[0].id.name).toBe("x");
    expect(parsed.declarations[0].init.value).toBe(1);
  });
});
