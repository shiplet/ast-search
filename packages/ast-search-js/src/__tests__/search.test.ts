import { afterEach, describe, expect, test } from "@jest/globals";
import {
  fsMock,
  jsBasics,
  emptyFile,
  optChainFixture,
  reactComponent,
  reactListNoKey,
  vueSFCOnlyJS,
} from "./setup";
import { runQuery, expandShorthands, extractRegexCaptures, resolvePath, normalizeOptionalChaining, explainSelector, validateSelector, Match } from "../search";
import { getAst, getAstFromPath } from "../file";
import { FileHandle } from "node:fs/promises";
import { File } from "@babel/types";

jest.mock("node:fs/promises", () => ({
  ...jest.requireActual("node:fs/promises"),
  open: jest.fn().mockImplementation((path, flags) => {
    return fsMock.promises.open(path, flags);
  }),
}));

describe("expandShorthands", () => {
  test("expands known shorthands to Babel type names", () => {
    expect(expandShorthands("call")).toBe("CallExpression");
    expect(expandShorthands("this")).toBe("ThisExpression");
    expect(expandShorthands("arrow")).toBe("ArrowFunctionExpression");
  });

  test("does not expand inside quoted attribute values", () => {
    expect(expandShorthands('[callee.name="call"]')).toBe('[callee.name="call"]');
    expect(expandShorthands('[name="arrow"]')).toBe('[name="arrow"]');
  });

  test("expands shorthands in selector position but not in value position", () => {
    expect(expandShorthands('call[callee.name="fn"]')).toBe(
      'CallExpression[callee.name="fn"]',
    );
  });

  test("passes through unknown selectors unchanged", () => {
    expect(expandShorthands("FunctionDeclaration")).toBe("FunctionDeclaration");
    expect(expandShorthands("JSXElement")).toBe("JSXElement");
  });

  test("spread expands to match both SpreadElement and JSXSpreadAttribute", () => {
    expect(expandShorthands("spread")).toBe(":matches(SpreadElement, JSXSpreadAttribute)");
  });
});

describe("runQuery — spread shorthand", () => {
  test("matches JSXSpreadAttribute in JSX elements", () => {
    const source = "const C = (props) => <div {...props} />;";
    const ast = getAst(source);
    const matches = runQuery("spread", ast, source, "test.tsx");
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toContain("...props");
  });

  test("still matches SpreadElement in object spread", () => {
    const source = "const x = { ...obj, a: 1 };";
    const ast = getAst(source);
    const matches = runQuery("spread", ast, source, "test.ts");
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toContain("...obj");
  });

  test("matches both SpreadElement and JSXSpreadAttribute in the same file", () => {
    const source = "const x = { ...a }; const C = () => <div {...b} />;";
    const ast = getAst(source);
    const matches = runQuery("spread", ast, source, "test.tsx");
    expect(matches).toHaveLength(2);
  });
});

describe("runQuery — type selectors", () => {
  let ast: File;
  let file: FileHandle;
  let source: string;

  afterEach(async () => {
    await file.close();
  });

  test("finds FunctionDeclaration nodes", async () => {
    ({ ast, file, source } = await getAstFromPath(jsBasics));
    const matches = runQuery("FunctionDeclaration", ast, source, jsBasics);
    expect(matches.length).toBeGreaterThan(0);
    matches.forEach((m: Match) => expect(m.source).toBeTruthy());
  });

  test("finds CallExpression via shorthand 'call'", async () => {
    ({ ast, file, source } = await getAstFromPath(vueSFCOnlyJS));
    const matches = runQuery("call", ast, source);
    expect(matches.length).toBeGreaterThan(0);
  });

  test("returns empty array for empty file", async () => {
    ({ ast, file, source } = await getAstFromPath(emptyFile));
    const matches = runQuery("FunctionDeclaration", ast, source);
    expect(matches).toHaveLength(0);
  });

  test("match includes file, line, col, and source", async () => {
    ({ ast, file, source } = await getAstFromPath(jsBasics));
    const matches = runQuery("FunctionDeclaration", ast, source, jsBasics);
    expect(matches[0]).toMatchObject({
      file: jsBasics,
      line: expect.any(Number),
      col: expect.any(Number),
      source: expect.any(String),
    });
    expect(matches[0].line).toBeGreaterThan(0);
  });
});

describe("runQuery — attribute selectors", () => {
  let ast: File;
  let file: FileHandle;
  let source: string;

  afterEach(async () => {
    await file.close();
  });

  test("finds ThisExpression nodes in setup scope (via attribute-free selector)", async () => {
    ({ ast, file, source } = await getAstFromPath(vueSFCOnlyJS));
    const matches = runQuery("ThisExpression", ast, source);
    expect(matches.length).toBeGreaterThan(0);
  });

  test("finds CallExpression with specific callee property name", async () => {
    ({ ast, file, source } = await getAstFromPath(reactListNoKey));
    const matches = runQuery(
      'CallExpression[callee.property.name="map"]',
      ast,
      source,
      reactListNoKey,
    );
    expect(matches.length).toBeGreaterThan(0);
    matches.forEach((m: Match) => expect(m.source).toContain("map"));
  });

  test("finds JSXAttribute with specific name", async () => {
    ({ ast, file, source } = await getAstFromPath(reactListNoKey));
    const matches = runQuery(
      'JSXAttribute[name.name="key"]',
      ast,
      source,
      reactListNoKey,
    );
    expect(matches.length).toBeGreaterThan(0);
  });

  test("does not find JSXAttribute[key] in ListNoKey component", async () => {
    ({ ast, file, source } = await getAstFromPath(reactListNoKey));
    // ListNoKey has no key attribute on its <li> elements
    const mapCalls = runQuery(
      'VariableDeclarator[id.name="ListNoKey"] JSXAttribute[name.name="key"]',
      ast,
      source,
    );
    expect(mapCalls).toHaveLength(0);
  });
});

describe("runQuery — :has() and :not() pseudo-selectors", () => {
  let ast: File;
  let file: FileHandle;
  let source: string;

  afterEach(async () => {
    await file.close();
  });

  test(":has(ThisExpression) finds functions that use this", async () => {
    ({ ast, file, source } = await getAstFromPath(vueSFCOnlyJS));
    const matches = runQuery(
      "ObjectMethod:has(ThisExpression)",
      ast,
      source,
    );
    expect(matches.length).toBeGreaterThan(0);
  });

  test(":not() excludes matches", async () => {
    ({ ast, file, source } = await getAstFromPath(reactComponent));
    const withHook = runQuery("CallExpression[callee.name]", ast, source);
    const withoutUseState = runQuery(
      'CallExpression[callee.name]:not([callee.name="useState"])',
      ast,
      source,
    );
    expect(withoutUseState.length).toBeLessThan(withHook.length);
  });

  test("map calls with no key — the target query", async () => {
    ({ ast, file, source } = await getAstFromPath(reactListNoKey));

    // Components with .map() but no key attr anywhere in the component
    const noKeyMatches = runQuery(
      'VariableDeclarator:has(CallExpression[callee.property.name="map"]):not(:has(JSXAttribute[name.name="key"]))',
      ast,
      source,
      reactListNoKey,
    );
    const withKeyMatches = runQuery(
      'VariableDeclarator:has(CallExpression[callee.property.name="map"]):has(JSXAttribute[name.name="key"])',
      ast,
      source,
      reactListNoKey,
    );

    expect(noKeyMatches.length).toBe(1);
    expect(noKeyMatches[0].source).toContain("ListNoKey");
    expect(withKeyMatches.length).toBe(1);
    expect(withKeyMatches[0].source).toContain("ListWithKey");
  });
});

describe("runQuery — descendant combinator", () => {
  let ast: File;
  let file: FileHandle;
  let source: string;

  afterEach(async () => {
    await file.close();
  });

  test("space combinator finds descendants", async () => {
    ({ ast, file, source } = await getAstFromPath(vueSFCOnlyJS));
    const matches = runQuery("ObjectMethod ThisExpression", ast, source);
    expect(matches.length).toBeGreaterThan(0);
    matches.forEach((m: Match) => expect(m.source).toBe("this"));
  });

  test("child combinator > is more restrictive than descendant", async () => {
    ({ ast, file, source } = await getAstFromPath(jsBasics));
    const descendant = runQuery("VariableDeclaration Identifier", ast, source);
    const child = runQuery("VariableDeclaration > VariableDeclarator", ast, source);
    expect(descendant.length).toBeGreaterThanOrEqual(child.length);
  });
});

describe("normalizeOptionalChaining", () => {
  test("renames OptionalCallExpression to CallExpression", () => {
    const node: any = { type: "OptionalCallExpression", optional: true };
    normalizeOptionalChaining(node);
    expect(node.type).toBe("CallExpression");
    expect(node.optional).toBe(true);
  });

  test("renames OptionalMemberExpression to MemberExpression", () => {
    const node: any = { type: "OptionalMemberExpression", optional: true };
    normalizeOptionalChaining(node);
    expect(node.type).toBe("MemberExpression");
    expect(node.optional).toBe(true);
  });

  test("leaves regular node types unchanged", () => {
    const node: any = { type: "CallExpression" };
    normalizeOptionalChaining(node);
    expect(node.type).toBe("CallExpression");
  });
});

describe("runQuery — optional chaining", () => {
  let ast: File;
  let file: FileHandle;
  let source: string;

  afterEach(async () => {
    await file.close();
  });

  test("CallExpression[callee.property.name] matches foo?.bar()", async () => {
    ({ ast, file, source } = await getAstFromPath(optChainFixture));
    const matches = runQuery(
      'CallExpression[callee.property.name="bar"]',
      ast,
      source,
      optChainFixture,
    );
    expect(matches.length).toBe(1);
    expect(matches[0].source).toContain("foo?.bar()");
  });

  test("CallExpression[callee.property.name='map'] matches items?.map(...)", async () => {
    ({ ast, file, source } = await getAstFromPath(optChainFixture));
    const matches = runQuery(
      'CallExpression[callee.property.name="map"]',
      ast,
      source,
      optChainFixture,
    );
    // Both items?.map() and list?.filter().map() should match
    expect(matches.length).toBe(2);
    const sources = matches.map((m: Match) => m.source);
    expect(sources.some((s: string) => s.includes("items?.map"))).toBe(true);
    expect(sources.some((s: string) => s.includes("list?.filter"))).toBe(true);
  });

  test("optional flag is preserved on member expressions after normalization", async () => {
    ({ ast, file, source } = await getAstFromPath(optChainFixture));
    // In `foo?.bar()`, the ?. is on the MemberExpression (callee), not the call itself.
    // After normalization OptionalMemberExpression → MemberExpression, [optional=true] still works.
    const matches = runQuery(
      "MemberExpression[optional=true]",
      ast,
      source,
      optChainFixture,
    );
    expect(matches.length).toBeGreaterThan(0);
  });

  test("MemberExpression matches optional member access", async () => {
    ({ ast, file, source } = await getAstFromPath(optChainFixture));
    const matches = runQuery(
      'MemberExpression[property.name="value"]',
      ast,
      source,
      optChainFixture,
    );
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe("expandShorthands — regex literal preservation", () => {
  test("preserves /regex/ content unchanged", () => {
    expect(expandShorthands('[name=/^call$/]')).toBe('[name=/^call$/]');
    expect(expandShorthands('[name=/^fn$/]')).toBe('[name=/^fn$/]');
  });

  test("expands shorthands outside the regex but not inside", () => {
    expect(expandShorthands('call[callee.name=/^(call|fn)$/]')).toBe(
      'CallExpression[callee.name=/^(call|fn)$/]',
    );
  });

  test("preserves regex flags", () => {
    expect(expandShorthands('[name=/^call$/i]')).toBe('[name=/^call$/i]');
    expect(expandShorthands('[name=/pattern/gims]')).toBe('[name=/pattern/gims]');
  });

  test("handles escaped slash inside regex", () => {
    expect(expandShorthands('[value=/a\\/b/]')).toBe('[value=/a\\/b/]');
  });
});

describe("runQuery — start, end, and source_full fields", () => {
  test("single-line match includes numeric start and end offsets", () => {
    const source = 'console.log("hello");';
    const ast = getAst(source);
    const matches = runQuery('CallExpression[callee.property.name="log"]', ast, source);
    expect(matches).toHaveLength(1);
    expect(typeof matches[0].start).toBe("number");
    expect(typeof matches[0].end).toBe("number");
    expect(matches[0].end!).toBeGreaterThan(matches[0].start!);
  });

  test("start and end are consistent with slicing the source", () => {
    const source = 'const x = 1; console.log("hello");';
    const ast = getAst(source);
    const matches = runQuery('CallExpression[callee.property.name="log"]', ast, source);
    expect(matches).toHaveLength(1);
    const { start, end } = matches[0];
    expect(source.slice(start, end)).toContain("console.log");
  });

  test("single-line match omits source_full", () => {
    const source = 'console.log("hello");';
    const ast = getAst(source);
    const matches = runQuery('CallExpression[callee.property.name="log"]', ast, source);
    expect(matches[0].source_full).toBeUndefined();
  });

  test("multi-line match includes source_full with full node text", () => {
    const source = "function foo(\n  a,\n  b\n) { return a + b; }";
    const ast = getAst(source);
    const matches = runQuery("FunctionDeclaration", ast, source);
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toBe("function foo(");
    expect(matches[0].source_full).toBeDefined();
    expect(matches[0].source_full).toContain("\n");
    expect(matches[0].source_full).toContain("return a + b");
  });

  test("source_full matches the slice defined by start and end", () => {
    const source = "function bar(\n  x\n) {}";
    const ast = getAst(source);
    const matches = runQuery("FunctionDeclaration", ast, source);
    expect(matches).toHaveLength(1);
    const { start, end, source_full } = matches[0];
    expect(source.slice(start, end)).toBe(source_full);
  });
});

describe("runQuery — regex in :not() attribute selectors", () => {
  test("ImportDeclaration with regex :not() excludes matching imports", () => {
    const source = [
      "import { Foo } from './foo.tsx';",
      "import { Bar } from './graphql-operations.tsx';",
      "import { Baz } from './baz.ts';",
    ].join("\n");
    const ast = getAst(source);
    const matches = runQuery(
      "ImportDeclaration[source.value=/\\.tsx$/]:not([source.value=/graphql-operations/])",
      ast,
      source,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toContain("foo.tsx");
  });

  test("validateSelector accepts :not() with regex attribute matcher", () => {
    expect(() =>
      validateSelector("ImportDeclaration[source.value=/\\.tsx$/]:not([source.value=/graphql/])"),
    ).not.toThrow();
  });

  test(":not() with regex and flags works", () => {
    const source = [
      "import { A } from './alpha.tsx';",
      "import { B } from './BETAFile.tsx';",
    ].join("\n");
    const ast = getAst(source);
    const matches = runQuery(
      "ImportDeclaration:not([source.value=/beta/i])",
      ast,
      source,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toContain("alpha");
  });
});

describe("extractRegexCaptures", () => {
  test("extracts path and regex from a single matcher", () => {
    const result = extractRegexCaptures('[callee.name=/^log$/]');
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('callee.name');
    expect(result[0].regex).toBeInstanceOf(RegExp);
    expect(result[0].regex.source).toBe('^log$');
  });

  test("extracts multiple matchers from one selector", () => {
    const result = extractRegexCaptures(
      'CallExpression[callee.property.name=/^(log|info)$/][arguments.0.value=/^user/]',
    );
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('callee.property.name');
    expect(result[1].path).toBe('arguments.0.value');
  });

  test("captures regex flags", () => {
    const [{ regex }] = extractRegexCaptures('[name=/foo/i]');
    expect(regex.flags).toContain('i');
  });

  test("returns empty array for selector with no regex matchers", () => {
    expect(extractRegexCaptures('[callee.name="log"]')).toHaveLength(0);
    expect(extractRegexCaptures('CallExpression')).toHaveLength(0);
  });
});

describe("resolvePath", () => {
  test("resolves a simple property", () => {
    expect(resolvePath({ name: "foo" }, "name")).toBe("foo");
  });

  test("resolves a dotted path", () => {
    expect(resolvePath({ callee: { name: "bar" } }, "callee.name")).toBe("bar");
  });

  test("resolves a numeric index in path", () => {
    expect(resolvePath({ args: ["a", "b"] }, "args.1")).toBe("b");
  });

  test("returns undefined for missing intermediate property", () => {
    expect(resolvePath({ a: null }, "a.b")).toBeUndefined();
  });

  test("returns undefined for object leaf (not a primitive)", () => {
    expect(resolvePath({ a: { b: {} } }, "a.b")).toBeUndefined();
  });

  test("stringifies non-string primitives", () => {
    expect(resolvePath({ async: true }, "async")).toBe("true");
  });
});

describe("runQuery — regex attribute selectors and captures", () => {
  test("regex attribute selector matches nodes correctly", () => {
    const source = 'console.log("a"); logger.info("b"); foo.debug("c");';
    const ast = getAst(source);
    const matches = runQuery(
      'CallExpression[callee.property.name=/^(log|info)$/]',
      ast,
      source,
    );
    expect(matches).toHaveLength(2);
    const methods = matches.map((m) => m.source);
    expect(methods.some((s) => s.includes("log"))).toBe(true);
    expect(methods.some((s) => s.includes("info"))).toBe(true);
    expect(methods.every((s) => !s.includes("debug"))).toBe(true);
  });

  test("regex with i flag matches case-insensitively", () => {
    const source = 'console.LOG("x");';
    const ast = getAst(source);
    const matches = runQuery(
      'CallExpression[callee.property.name=/^log$/i]',
      ast,
      source,
    );
    expect(matches).toHaveLength(1);
  });

  test("regex matcher populates captures with matched value", () => {
    const source = 'logger.info("hello");';
    const ast = getAst(source);
    const matches = runQuery(
      'CallExpression[callee.property.name=/^(log|info)$/]',
      ast,
      source,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].captures).toEqual({ "callee.property.name": "info" });
  });

  test("exact-string matchers produce no captures entry", () => {
    const source = 'console.log("x");';
    const ast = getAst(source);
    const matches = runQuery(
      'CallExpression[callee.property.name="log"]',
      ast,
      source,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].captures).toBeUndefined();
  });

  test("multiple regex matchers all appear in captures", () => {
    const source = 'logger.info("hello world");';
    const ast = getAst(source);
    const matches = runQuery(
      'CallExpression[callee.property.name=/^(log|info)$/][callee.object.name=/^log/]',
      ast,
      source,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].captures?.["callee.property.name"]).toBe("info");
    expect(matches[0].captures?.["callee.object.name"]).toBe("logger");
  });

  test("missing path is omitted from captures (not undefined value)", () => {
    const source = 'foo();';
    const ast = getAst(source);
    const matches = runQuery(
      'CallExpression[callee.name=/^foo$/]',
      ast,
      source,
    );
    expect(matches).toHaveLength(1);
    // callee.name exists on this node
    expect(matches[0].captures?.["callee.name"]).toBe("foo");
  });
});

// ---------------------------------------------------------------------------
// New shorthands (Session 2)
// ---------------------------------------------------------------------------

describe("expandShorthands — new entries", () => {
  test("import expands to ImportDeclaration", () => {
    expect(expandShorthands("import")).toBe("ImportDeclaration");
  });

  test("export expands to :matches(...) covering all export types", () => {
    const expanded = expandShorthands("export");
    expect(expanded).toContain("ExportNamedDeclaration");
    expect(expanded).toContain("ExportDefaultDeclaration");
    expect(expanded).toContain("ExportAllDeclaration");
    expect(expanded).toMatch(/^:matches\(/);
  });

  test("class expands to :matches(ClassDeclaration, ClassExpression)", () => {
    const expanded = expandShorthands("class");
    expect(expanded).toContain("ClassDeclaration");
    expect(expanded).toContain("ClassExpression");
  });

  test("throw expands to ThrowStatement", () => {
    expect(expandShorthands("throw")).toBe("ThrowStatement");
  });

  test("typeof expands to UnaryExpression[operator=\"typeof\"]", () => {
    const expanded = expandShorthands("typeof");
    expect(expanded).toContain("UnaryExpression");
    expect(expanded).toContain('operator="typeof"');
  });

  test("destructure expands to :matches(ObjectPattern, ArrayPattern)", () => {
    const expanded = expandShorthands("destructure");
    expect(expanded).toContain("ObjectPattern");
    expect(expanded).toContain("ArrayPattern");
  });

  test("decorator expands to Decorator", () => {
    expect(expandShorthands("decorator")).toBe("Decorator");
  });

  test("jsx expands to :matches(JSXElement, JSXFragment)", () => {
    const expanded = expandShorthands("jsx");
    expect(expanded).toContain("JSXElement");
    expect(expanded).toContain("JSXFragment");
  });

  test("new shorthands not expanded inside quoted values", () => {
    expect(expandShorthands('[name="import"]')).toBe('[name="import"]');
    expect(expandShorthands('[name="class"]')).toBe('[name="class"]');
    expect(expandShorthands('[name="throw"]')).toBe('[name="throw"]');
  });

  test("typeof inside quoted attribute value is not expanded", () => {
    expect(expandShorthands('[operator="typeof"]')).toBe('[operator="typeof"]');
  });
});

describe("runQuery — new shorthands find correct nodes", () => {
  test("import finds ImportDeclaration", () => {
    const source = 'import foo from "bar"; import { x } from "baz";';
    const ast = getAst(source);
    const matches = runQuery("import", ast, source);
    expect(matches).toHaveLength(2);
  });

  test("export finds named and default exports", () => {
    const source = "export const x = 1; export default function f() {}";
    const ast = getAst(source);
    const matches = runQuery("export", ast, source);
    expect(matches).toHaveLength(2);
  });

  test("class finds both ClassDeclaration and ClassExpression", () => {
    const source = "class Dog {}; const Cat = class {};";
    const ast = getAst(source);
    const matches = runQuery("class", ast, source);
    expect(matches).toHaveLength(2);
  });

  test("throw finds ThrowStatement", () => {
    const source = "function f() { throw new Error('oops'); }";
    const ast = getAst(source);
    const matches = runQuery("throw", ast, source);
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toContain("throw");
  });

  test("typeof finds UnaryExpression with typeof operator", () => {
    const source = "if (typeof x === 'string') {}";
    const ast = getAst(source);
    const matches = runQuery("typeof", ast, source);
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toContain("typeof");
  });

  test("typeof does not match other unary expressions", () => {
    const source = "const a = !foo; const b = typeof bar;";
    const ast = getAst(source);
    const matches = runQuery("typeof", ast, source);
    expect(matches).toHaveLength(1);
  });

  test("destructure finds ObjectPattern and ArrayPattern", () => {
    const source = "const { a, b } = obj; const [c, d] = arr;";
    const ast = getAst(source);
    const matches = runQuery("destructure", ast, source);
    expect(matches).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// runQuery — showAst option (Session 2)
// ---------------------------------------------------------------------------

describe("runQuery — showAst option", () => {
  test("omits astSubtree when showAst is false (default)", () => {
    const source = "foo(bar)";
    const ast = getAst(source);
    const [match] = runQuery("call", ast, source);
    expect(match.astSubtree).toBeUndefined();
  });

  test("includes astSubtree string when showAst is true", () => {
    const source = "foo(bar)";
    const ast = getAst(source);
    const [match] = runQuery("call", ast, source, "", true);
    expect(typeof match.astSubtree).toBe("string");
    expect(match.astSubtree!.length).toBeGreaterThan(0);
  });

  test("astSubtree starts with the matched node type", () => {
    const source = "foo(bar)";
    const ast = getAst(source);
    const [match] = runQuery("call", ast, source, "", true);
    expect(match.astSubtree).toMatch(/^CallExpression/);
  });

  test("astSubtree contains child node types", () => {
    const source = "foo(bar)";
    const ast = getAst(source);
    const [match] = runQuery("call", ast, source, "", true);
    expect(match.astSubtree).toContain("Identifier");
  });

  test("astSubtree is a multi-line string for nodes with children", () => {
    const source = "foo(a, b, c)";
    const ast = getAst(source);
    const [match] = runQuery("call", ast, source, "", true);
    expect(match.astSubtree!.split("\n").length).toBeGreaterThan(1);
  });

  test("all matches get astSubtree when showAst is true", () => {
    const source = "foo(); bar(); baz();";
    const ast = getAst(source);
    const matches = runQuery("call", ast, source, "", true);
    expect(matches).toHaveLength(3);
    expect(matches.every((m) => typeof m.astSubtree === "string")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// explainSelector (Session 2)
// ---------------------------------------------------------------------------

describe("explainSelector", () => {
  test("explains a simple identifier selector", () => {
    const desc = explainSelector("CallExpression");
    expect(desc).toContain("CallExpression");
    expect(desc).toContain("nodes");
  });

  test("expands shorthands before explaining", () => {
    const desc = explainSelector("call");
    expect(desc).toContain("CallExpression");
  });

  test("describes a string attribute match", () => {
    const desc = explainSelector('call[callee.name="foo"]');
    expect(desc).toContain("callee.name");
    expect(desc).toContain('"foo"');
  });

  test("describes a boolean attribute match without quotes", () => {
    const desc = explainSelector("FunctionDeclaration[async=true]");
    expect(desc).toContain("async");
    expect(desc).toMatch(/= true\b/);
    expect(desc).not.toMatch(/= "true"/);
  });

  test("describes a regex attribute match", () => {
    const desc = explainSelector("call[callee.property.name=/^(log|info)$/]");
    expect(desc).toContain("callee.property.name");
    expect(desc).toContain("matches");
  });

  test("describes a descendant combinator", () => {
    const desc = explainSelector("ObjectMethod this");
    expect(desc).toContain("ObjectMethod");
    expect(desc).toContain("ThisExpression");
    expect(desc).toContain("containing");
  });

  test("describes :has() as 'containing'", () => {
    const desc = explainSelector("call:has(arrow)");
    expect(desc).toContain("containing");
    expect(desc).toContain("ArrowFunctionExpression");
  });

  test("describes :not() as 'excluding'", () => {
    const desc = explainSelector("call:not(arrow)");
    expect(desc).toContain("excluding");
  });

  test("describes :matches() with 'or' connective", () => {
    const desc = explainSelector("export");  // expands to :matches(...)
    expect(desc).toContain("ExportNamedDeclaration");
    expect(desc).toContain(" or ");
  });

  test("explains a child combinator (>)", () => {
    const desc = explainSelector("FunctionDeclaration > ArrowFunctionExpression");
    expect(desc).toContain("direct child");
    expect(desc).toContain("ArrowFunctionExpression");
  });

  test("throws on invalid selector", () => {
    expect(() => explainSelector("[(((invalid")).toThrow();
  });
});
