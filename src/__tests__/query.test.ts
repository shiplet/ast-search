import { describe, expect, test } from "@jest/globals";
import { parseQuery, SHORTHANDS, Query } from "../query.js";

describe("SHORTHANDS", () => {
  const expected: Record<string, string> = {
    this: "ThisExpression",
    await: "AwaitExpression",
    yield: "YieldExpression",
    new: "NewExpression",
    call: "CallExpression",
    arrow: "ArrowFunctionExpression",
    fn: "FunctionExpression",
    member: "MemberExpression",
    ternary: "ConditionalExpression",
    template: "TemplateLiteral",
    tagged: "TaggedTemplateExpression",
    "import()": "ImportExpression",
    assign: "AssignmentExpression",
    binary: "BinaryExpression",
    logical: "LogicalExpression",
    spread: "SpreadElement",
  };

  Object.entries(expected).forEach(([shorthand, babelType]) => {
    test(`'${shorthand}' maps to '${babelType}'`, () => {
      expect(SHORTHANDS[shorthand]).toBe(babelType);
    });
  });

  test("has exactly 16 entries", () => {
    expect(Object.keys(SHORTHANDS)).toHaveLength(16);
  });
});

describe("parseQuery — bare identifier", () => {
  test("single lowercase word → bare-ident", () => {
    const result = parseQuery("setup");
    expect(result).toEqual({ kind: "bare-ident", name: "setup" });
  });

  test("camelCase identifier → bare-ident", () => {
    const result = parseQuery("myFunction");
    expect(result).toEqual({ kind: "bare-ident", name: "myFunction" });
  });

  test("identifier with $ → bare-ident", () => {
    const result = parseQuery("$emit");
    expect(result).toEqual({ kind: "bare-ident", name: "$emit" });
  });

  test("identifier with _ → bare-ident", () => {
    const result = parseQuery("_private");
    expect(result).toEqual({ kind: "bare-ident", name: "_private" });
  });

  test("identifier with digits → bare-ident", () => {
    const result = parseQuery("handler2");
    expect(result).toEqual({ kind: "bare-ident", name: "handler2" });
  });

  test("unknown lowercase word (not a shorthand) → bare-ident", () => {
    const result = parseQuery("foo");
    expect(result).toEqual({ kind: "bare-ident", name: "foo" });
  });
});

describe("parseQuery — bare expression (shorthand)", () => {
  test("'this' → bare-expr with ThisExpression", () => {
    const result = parseQuery("this");
    expect(result).toEqual({
      kind: "bare-expr",
      expr: [[{ negated: false, babelType: "ThisExpression" }]],
    });
  });

  test("'await' → bare-expr with AwaitExpression", () => {
    const result = parseQuery("await");
    expect(result).toEqual({
      kind: "bare-expr",
      expr: [[{ negated: false, babelType: "AwaitExpression" }]],
    });
  });

  test("'import()' → bare-expr with ImportExpression", () => {
    const result = parseQuery("import()");
    expect(result).toEqual({
      kind: "bare-expr",
      expr: [[{ negated: false, babelType: "ImportExpression" }]],
    });
  });

  test("known shorthands that collide with JS identifiers → bare-expr not bare-ident", () => {
    const colliding = ["call", "fn", "arrow", "template", "member", "assign", "logical"];
    for (const s of colliding) {
      const result = parseQuery(s);
      expect(result.kind).toBe("bare-expr");
    }
  });
});

describe("parseQuery — bare expression (PascalCase Babel type)", () => {
  test("'ThisExpression' → bare-expr with ThisExpression", () => {
    const result = parseQuery("ThisExpression");
    expect(result).toEqual({
      kind: "bare-expr",
      expr: [[{ negated: false, babelType: "ThisExpression" }]],
    });
  });

  test("'ArrowFunctionExpression' → bare-expr", () => {
    const result = parseQuery("ArrowFunctionExpression");
    expect(result).toEqual({
      kind: "bare-expr",
      expr: [[{ negated: false, babelType: "ArrowFunctionExpression" }]],
    });
  });
});

describe("parseQuery — bare expression with negation", () => {
  test("'!await' → bare-expr with negated AwaitExpression", () => {
    const result = parseQuery("!await");
    expect(result).toEqual({
      kind: "bare-expr",
      expr: [[{ negated: true, babelType: "AwaitExpression" }]],
    });
  });

  test("'!import()' → bare-expr with negated ImportExpression", () => {
    const result = parseQuery("!import()");
    expect(result).toEqual({
      kind: "bare-expr",
      expr: [[{ negated: true, babelType: "ImportExpression" }]],
    });
  });
});

describe("parseQuery — bare expression with boolean operators", () => {
  test("'this && await' → bare-expr AND clause", () => {
    const result = parseQuery("this && await");
    expect(result).toEqual({
      kind: "bare-expr",
      expr: [
        [
          { negated: false, babelType: "ThisExpression" },
          { negated: false, babelType: "AwaitExpression" },
        ],
      ],
    });
  });

  test("'this || await' → bare-expr OR clause", () => {
    const result = parseQuery("this || await");
    expect(result).toEqual({
      kind: "bare-expr",
      expr: [
        [{ negated: false, babelType: "ThisExpression" }],
        [{ negated: false, babelType: "AwaitExpression" }],
      ],
    });
  });

  test("'!import() && arrow' → bare-expr AND clause with negation", () => {
    const result = parseQuery("!import() && arrow");
    expect(result).toEqual({
      kind: "bare-expr",
      expr: [
        [
          { negated: true, babelType: "ImportExpression" },
          { negated: false, babelType: "ArrowFunctionExpression" },
        ],
      ],
    });
  });

  test("&& binds tighter than || — 'this && await || yield'", () => {
    const result = parseQuery("this && await || yield");
    expect(result).toEqual({
      kind: "bare-expr",
      expr: [
        [
          { negated: false, babelType: "ThisExpression" },
          { negated: false, babelType: "AwaitExpression" },
        ],
        [{ negated: false, babelType: "YieldExpression" }],
      ],
    });
  });
});

describe("parseQuery — scope query", () => {
  test("'setup > this' → scope query (example 2)", () => {
    const result = parseQuery("setup > this");
    expect(result).toEqual({
      kind: "scope",
      scope: "setup",
      expr: [[{ negated: false, babelType: "ThisExpression" }]],
    });
  });

  test("'* > this' → wildcard scope (example 3)", () => {
    const result = parseQuery("* > this");
    expect(result).toEqual({
      kind: "scope",
      scope: "*",
      expr: [[{ negated: false, babelType: "ThisExpression" }]],
    });
  });

  test("'setup > !await' → negated predicate (example 4)", () => {
    const result = parseQuery("setup > !await");
    expect(result).toEqual({
      kind: "scope",
      scope: "setup",
      expr: [[{ negated: true, babelType: "AwaitExpression" }]],
    });
  });

  test("'setup > this && await' → AND composition (example 5)", () => {
    const result = parseQuery("setup > this && await");
    expect(result).toEqual({
      kind: "scope",
      scope: "setup",
      expr: [
        [
          { negated: false, babelType: "ThisExpression" },
          { negated: false, babelType: "AwaitExpression" },
        ],
      ],
    });
  });

  test("'render > member || ternary' → OR composition (example 6)", () => {
    const result = parseQuery("render > member || ternary");
    expect(result).toEqual({
      kind: "scope",
      scope: "render",
      expr: [
        [{ negated: false, babelType: "MemberExpression" }],
        [{ negated: false, babelType: "ConditionalExpression" }],
      ],
    });
  });

  test("'useEffect > ArrowFunctionExpression' → PascalCase type (example 9)", () => {
    const result = parseQuery("useEffect > ArrowFunctionExpression");
    expect(result).toEqual({
      kind: "scope",
      scope: "useEffect",
      expr: [[{ negated: false, babelType: "ArrowFunctionExpression" }]],
    });
  });

  test("'* > !call' → wildcard + negation (example 10)", () => {
    const result = parseQuery("* > !call");
    expect(result).toEqual({
      kind: "scope",
      scope: "*",
      expr: [[{ negated: true, babelType: "CallExpression" }]],
    });
  });

  test("'fetchData > await || import()' → complex OR (example 11)", () => {
    const result = parseQuery("fetchData > await || import()");
    expect(result).toEqual({
      kind: "scope",
      scope: "fetchData",
      expr: [
        [{ negated: false, babelType: "AwaitExpression" }],
        [{ negated: false, babelType: "ImportExpression" }],
      ],
    });
  });

  test("scope with $ in name", () => {
    const result = parseQuery("$el > this");
    expect(result).toEqual({
      kind: "scope",
      scope: "$el",
      expr: [[{ negated: false, babelType: "ThisExpression" }]],
    });
  });

  test("scope with _ in name", () => {
    const result = parseQuery("_init > await");
    expect(result).toEqual({
      kind: "scope",
      scope: "_init",
      expr: [[{ negated: false, babelType: "AwaitExpression" }]],
    });
  });

  test("'template' in scope position matches identifier named 'template'", () => {
    const result = parseQuery("template > this");
    expect(result).toEqual({
      kind: "scope",
      scope: "template",
      expr: [[{ negated: false, babelType: "ThisExpression" }]],
    });
  });

  test("'setup > this && await || yield' — complex mixed operators", () => {
    const result = parseQuery("setup > this && await || yield");
    expect(result).toEqual({
      kind: "scope",
      scope: "setup",
      expr: [
        [
          { negated: false, babelType: "ThisExpression" },
          { negated: false, babelType: "AwaitExpression" },
        ],
        [{ negated: false, babelType: "YieldExpression" }],
      ],
    });
  });
});

describe("parseQuery — parse errors", () => {
  test("'setup>this' — missing spaces around > → error", () => {
    expect(() => parseQuery("setup>this")).toThrow(/whitespace required/i);
  });

  test("'setup >this' — missing space after > → error", () => {
    expect(() => parseQuery("setup >this")).toThrow(/whitespace required/i);
  });

  test("'setup> this' — missing space before > → error", () => {
    expect(() => parseQuery("setup> this")).toThrow(/whitespace required/i);
  });

  test("'setup > foo' — unknown token in expression position → error", () => {
    expect(() => parseQuery("setup > foo")).toThrow(/unknown expression atom/i);
  });

  test("'setup > ' — empty expression → error", () => {
    expect(() => parseQuery("setup > ")).toThrow();
  });

  test("empty string → error", () => {
    expect(() => parseQuery("")).toThrow(/empty query/i);
  });

  test("'  ' — whitespace only → error", () => {
    expect(() => parseQuery("  ")).toThrow(/empty query/i);
  });
});

describe("parseQuery — type narrowing", () => {
  test("returns ScopeQuery for scope queries", () => {
    const result = parseQuery("setup > this");
    if (result.kind === "scope") {
      expect(result.scope).toBe("setup");
      expect(result.expr).toBeDefined();
    } else {
      throw new Error("Expected scope query");
    }
  });

  test("returns BareExpr for shorthand queries", () => {
    const result = parseQuery("this");
    if (result.kind === "bare-expr") {
      expect(result.expr).toBeDefined();
    } else {
      throw new Error("Expected bare-expr");
    }
  });

  test("returns BareIdent for identifier queries", () => {
    const result = parseQuery("setup");
    if (result.kind === "bare-ident") {
      expect(result.name).toBe("setup");
    } else {
      throw new Error("Expected bare-ident");
    }
  });
});
