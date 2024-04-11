import { afterEach, describe, expect, test } from "@jest/globals";
import { emptyFile, fsMock, fullVueSFC } from "./setup";
import { searchFnForExp, searchPropertyForExp, NodeType } from "../search";
import { getAstFromPath } from "../file";
import { type Node } from "acorn";
import { FileHandle } from "node:fs/promises";
import { IFileHandle } from "memfs/lib/node/types/misc";

jest.mock("node:fs/promises", () => ({
  ...jest.requireActual("node:fs/promises"),
  open: jest.fn().mockImplementation((path, flags) => {
    return fsMock.promises.open(path, flags);
  }),
}));

describe("search", () => {
  let ast: Node;
  let file: FileHandle | IFileHandle;

  afterEach(async () => {
    await file.close();
  });

  test("it finds a this expression in setup", async () => {
    ({ ast, file } = await getAstFromPath(fullVueSFC));
    const found = searchFnForExp({
      ast,
      f: fullVueSFC,
      fn: "setup",
      e: NodeType.ThisExpression,
    });
    expect(found?.[0]).toBe(fullVueSFC);
  });

  test("it handles 'multiple' flag", async () => {
    ({ ast, file } = await getAstFromPath(fullVueSFC));
    const found = searchFnForExp({
      ast,
      f: fullVueSFC,
      fn: "setup",
      e: NodeType.ThisExpression,
      m: true,
    });
    expect(found?.[0]).toBe(fullVueSFC);
  });

  test("it searches properties", async () => {
    ({ ast, file } = await getAstFromPath(fullVueSFC));
    const found = searchPropertyForExp({
      ast,
      f: fullVueSFC,
      p: "test",
      e: NodeType.FunctionExpression,
    });
    expect(found).toBe(fullVueSFC);
  });

  test("it returns empty if match not found", async () => {
    ({ ast, file } = await getAstFromPath(fullVueSFC));
    const fnFound = searchFnForExp({
      ast,
      f: fullVueSFC,
      fn: "setup",
      e: NodeType.AwaitExpression,
    });
    const propFound = searchPropertyForExp({
      ast,
      f: fullVueSFC,
      p: "test",
      e: NodeType.AwaitExpression,
    });
    fnFound?.forEach((v) => {
      expect(v).toBeFalsy();
    });
    expect(propFound).toBeFalsy();
  });

  test("it fails gracefully if passed an empty file", async () => {
    ({ ast, file } = await getAstFromPath(emptyFile));
    const missing = searchFnForExp({
      ast,
      f: emptyFile,
      fn: "setup",
      e: NodeType.ThisExpression,
    });
    expect(missing).toBeFalsy();
  });

  test("it finds different kinds of functions", async () => {
    ({ ast, file } = await getAstFromPath(fullVueSFC));
    const fnFound = searchFnForExp({
      ast,
      f: fullVueSFC,
      fn: "setup",
      e: NodeType.FunctionExpression,
    });
    fnFound?.forEach((v) => expect(v).toBe(fullVueSFC));
  });
});
