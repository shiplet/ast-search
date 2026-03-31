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
import { runQuery, expandShorthands, normalizeOptionalChaining, Match } from "../search";
import { getAstFromPath } from "../file";
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
