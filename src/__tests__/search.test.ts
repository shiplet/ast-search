import { describe, expect, test } from "@jest/globals";
import { fsMock, vueSFCThisInSetup } from "./setup";
import { searchFnForExp, searchPropertyForExp } from "../search";
import { getAstFromPath } from "../file";

jest.mock("node:fs/promises", () => ({
  ...jest.requireActual("node:fs/promises"),
  open: jest.fn().mockImplementation((path, flags) => {
    return fsMock.promises.open(path, flags);
  }),
}));

describe("search", () => {
  test("it finds a this expression in setup", async () => {
    const { ast, file } = await getAstFromPath(vueSFCThisInSetup);
    const found = searchFnForExp({
      ast,
      f: vueSFCThisInSetup,
      fn: "setup",
      e: "ThisExpression",
    });
    expect(found[0]).toBe(vueSFCThisInSetup);
    await file.close();
  });
  test("it handles 'multiple' flag", async () => {
    const { ast, file } = await getAstFromPath(vueSFCThisInSetup);
    const found = searchFnForExp({
      ast,
      f: vueSFCThisInSetup,
      fn: "setup",
      e: "ThisExpression",
      m: true,
    });
    expect(found[0]).toBe(vueSFCThisInSetup);
    await file.close();
  });
  test("it searches properties", async () => {
    const { ast, file } = await getAstFromPath(vueSFCThisInSetup);
    const found = searchPropertyForExp({
      ast,
      f: vueSFCThisInSetup,
      p: "test",
      e: "FunctionExpression",
    });
    expect(found).toBe(vueSFCThisInSetup);
    await file.close();
  });
  test("it returns empty if match not found", async () => {
    const { ast, file } = await getAstFromPath(vueSFCThisInSetup);
    const fnFound = searchFnForExp({
      ast,
      f: vueSFCThisInSetup,
      fn: "setup",
      e: "AwaitExpression",
    });
    const propFound = searchPropertyForExp({
      ast,
      f: vueSFCThisInSetup,
      p: "test",
      e: "AwaitExpression",
    });
    fnFound.forEach((v) => {
      expect(v).toBeFalsy();
    });
    expect(propFound).toBeFalsy();
    await file.close();
  });
});
