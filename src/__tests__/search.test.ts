import { afterEach, describe, expect, test } from "@jest/globals";
import {
  fsMock,
  jsBasics,
  emptyFile,
  reactComponent,
  vueSFCOnlyJS,
} from "./setup";
import { searchForRootNodes, runQuery, Match } from "../search";
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

describe("searchForRootNodes", () => {
  let ast: File;
  let file: FileHandle | IFileHandle;

  afterEach(async () => {
    await file.close();
  });

  [
    { root: "yellow", size: 2 },
    { root: "arrowFunction", size: 2 },
    { root: "objectExample", size: 1 },
    { root: "b", size: 2 },
  ].forEach((c) => {
    test(`it finds ${c.size} root node${c.size > 1 ? "s" : ""} named '${c.root}' in jsBasics.js`, async () => {
      ({ ast, file } = await getAstFromPath(jsBasics));

      const found = searchForRootNodes(c.root)(ast.program.body);
      expect(found.size).toEqual(c.size);
    });
  });

  [
    { root: "setup", size: 1 },
    { root: "wackyItemName", size: 1 },
    { root: "finally", size: 2 },
    { root: "catch", size: 2 },
    { root: "specificWorkspaceUsers", size: 3 },
  ].forEach((c) => {
    test(`it finds ${c.size} root node${c.size > 1 ? "s" : ""} named '${c.root}' in hasSetupThisOnlyJs.js`, async () => {
      ({ ast, file } = await getAstFromPath(vueSFCOnlyJS));
      const found = searchForRootNodes(c.root)(ast.program.body);

      expect(found.size).toEqual(c.size);
    });
  });

  test("it searches multiple root nodes", async () => {
    ({ ast, file } = await getAstFromPath(reactComponent));
    const found = searchForRootNodes("useState")(ast.program.body);
    expect(found.size).toEqual(3);
  });

  test("it handles an empty file", async () => {
    ({ ast, file } = await getAstFromPath(emptyFile));
    const found = searchForRootNodes("any")(ast.program.body);
    expect(found.size).toEqual(0);
  });
});

describe("runQuery", () => {
  let file: Awaited<ReturnType<typeof getAstFromPath>>["file"];
  let ast: Awaited<ReturnType<typeof getAstFromPath>>["ast"];

  afterEach(async () => {
    await file.close();
  });

  test("BareIdent returns matches for named nodes", async () => {
    ({ ast, file } = await getAstFromPath(jsBasics));
    const matches = runQuery({ kind: "bare-ident", name: "arrowFunction" }, ast);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]).toHaveProperty("line");
    expect(matches[0]).toHaveProperty("col");
    expect(matches[0]).toHaveProperty("text");
    expect(matches[0]).toHaveProperty("file");
  });

  test("BareIdent on empty file returns empty array", async () => {
    ({ ast, file } = await getAstFromPath(emptyFile));
    const matches = runQuery({ kind: "bare-ident", name: "anything" }, ast);
    expect(matches).toHaveLength(0);
  });

  test("BareIdent includes filename when provided", async () => {
    ({ ast, file } = await getAstFromPath(jsBasics));
    const matches = runQuery({ kind: "bare-ident", name: "arrowFunction" }, ast, jsBasics);
    expect(matches[0].file).toBe(jsBasics);
  });

  test("BareIdent returns correct line numbers", async () => {
    ({ ast, file } = await getAstFromPath(jsBasics));
    const matches = runQuery({ kind: "bare-ident", name: "arrowFunction" }, ast);
    expect(matches[0].line).toBeGreaterThan(0);
  });

  test("BareExpr finds ThisExpression nodes across entire file", async () => {
    ({ ast, file } = await getAstFromPath(vueSFCOnlyJS));
    const matches = runQuery({
      kind: "bare-expr",
      expr: [[{ negated: false, babelType: "ThisExpression" }]],
    }, ast);
    expect(matches.length).toBeGreaterThan(0);
    matches.forEach((m: Match) => expect(m.text).toBe("ThisExpression"));
  });

  test("BareExpr on empty file returns empty array", async () => {
    ({ ast, file } = await getAstFromPath(emptyFile));
    const matches = runQuery({
      kind: "bare-expr",
      expr: [[{ negated: false, babelType: "ThisExpression" }]],
    }, ast);
    expect(matches).toHaveLength(0);
  });

  test("BareExpr with negated predicate excludes the given type", async () => {
    ({ ast, file } = await getAstFromPath(jsBasics));
    const negatedMatches = runQuery({
      kind: "bare-expr",
      expr: [[{ negated: true, babelType: "ArrowFunctionExpression" }]],
    }, ast);
    expect(negatedMatches.every((m: Match) => m.text !== "ArrowFunctionExpression")).toBe(true);
  });

  test("ScopeQuery finds expressions within the named scope's body", async () => {
    ({ ast, file } = await getAstFromPath(vueSFCOnlyJS));
    const matches = runQuery({
      kind: "scope",
      scope: "setup",
      expr: [[{ negated: false, babelType: "ThisExpression" }]],
    }, ast);
    expect(matches.length).toBeGreaterThan(0);
    matches.forEach((m: Match) => expect(m.text).toBe("ThisExpression"));
  });

  test("ScopeQuery returns empty for scope with no matching expressions", async () => {
    ({ ast, file } = await getAstFromPath(jsBasics));
    // arrowFunction = () => {} has no body — no ThisExpression
    const matches = runQuery({
      kind: "scope",
      scope: "arrowFunction",
      expr: [[{ negated: false, babelType: "ThisExpression" }]],
    }, ast);
    expect(matches).toHaveLength(0);
  });

  test("ScopeQuery does not return matches from outside the scope", async () => {
    ({ ast, file } = await getAstFromPath(vueSFCOnlyJS));
    // Count ThisExpression in all setup scopes vs bare-expr total
    const scopeMatches = runQuery({
      kind: "scope",
      scope: "setup",
      expr: [[{ negated: false, babelType: "ThisExpression" }]],
    }, ast);
    const allMatches = runQuery({
      kind: "bare-expr",
      expr: [[{ negated: false, babelType: "ThisExpression" }]],
    }, ast);
    expect(scopeMatches.length).toBeLessThan(allMatches.length);
  });
});
