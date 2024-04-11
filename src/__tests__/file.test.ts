import { describe, expect, test } from "@jest/globals";
import { Node } from "acorn";
import { getAst, getAstFromPath, parseVueSFC } from "../file";
import { type FileHandle } from "node:fs/promises";
import { DefaultExport, defaultExport, fsMock, fullVueSFC } from "./setup";

jest.mock("node:fs/promises", () => ({
  ...jest.requireActual("node:fs/promises"),
  open: jest.fn().mockImplementation((path, flags) => {
    return fsMock.promises.open(path, flags);
  }),
}));

describe("file", () => {
  test("it creates an ast", () => {
    const ast = getAst(DefaultExport);
    expect(ast).toBeInstanceOf(Node);
  });

  test("it parses a Vue SFC component", async () => {
    const { open } = fsMock.promises;
    const file = await open(fullVueSFC);
    const contents = await parseVueSFC(file as unknown as FileHandle);
    [
      "<template>",
      "</template>",
      "<script>",
      "</script>",
      "<style>",
      "</style>",
    ].forEach((v) => {
      expect(contents.indexOf(v)).toBe(-1);
    });
  });

  test("it opens a file from path", async () => {
    const { ast, file } = await getAstFromPath(defaultExport);
    expect(ast).toBeInstanceOf(Node);
    expect(file).not.toBeNull();
    await file.close();
  });
});
