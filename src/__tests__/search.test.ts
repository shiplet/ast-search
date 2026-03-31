import { afterEach, describe, expect, test } from "@jest/globals";
import {
  fsMock,
  jsBasics,
  emptyFile,
  reactComponent,
  reactListNoKey,
  vueSFCOnlyJS,
} from "./setup";
import { runQuery, expandShorthands, Match } from "../search";
import { getAstFromPath } from "../file";
import { FileHandle } from "node:fs/promises";
import { IFileHandle } from "memfs/lib/node/types/misc";
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
  let file: FileHandle | IFileHandle;
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
  let file: FileHandle | IFileHandle;
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
  let file: FileHandle | IFileHandle;
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
  let file: FileHandle | IFileHandle;
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
