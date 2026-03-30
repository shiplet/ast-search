import { describe, expect, test } from "@jest/globals";
import { getAst, getAstFromPath, parseVueSFC } from "../file";
import {
  DefaultExport,
  defaultExport,
  fsMock,
  fullVueSFC,
  reactComponent,
  vue3SFC,
} from "./setup";

jest.mock("node:fs/promises", () => ({
  ...jest.requireActual("node:fs/promises"),
  open: jest.fn().mockImplementation((path, flags) => {
    return fsMock.promises.open(path, flags);
  }),
}));

describe("file", () => {
  test("it creates an ast", () => {
    const ast = getAst(DefaultExport);
    expect(ast).toBeTruthy();
  });

  test("it parses a Vue SFC component", async () => {
    const { open } = fsMock.promises;
    const file = await open(fullVueSFC);
    const lines = await file.readFile();
    const contents = parseVueSFC(lines as unknown as Buffer);
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

  test("it parses a Vue 3 SFC with <script setup lang='ts'>", async () => {
    const { open } = fsMock.promises;
    const file = await open(vue3SFC);
    const lines = await file.readFile();
    const contents = parseVueSFC(lines as unknown as Buffer);
    ["<script setup lang=\"ts\">", "</script>", "<template>", "<style"].forEach(
      (v) => {
        expect(contents.indexOf(v)).toBe(-1);
      },
    );
    expect(contents).toContain("greet");
  });

  test("it parses a Vue 3 SFC from path", async () => {
    const { ast, file } = await getAstFromPath(vue3SFC);
    expect(ast).toBeTruthy();
    expect(file).not.toBeNull();
    await file.close();
  });

  test("it parses a React component", async () => {
    const { ast, file } = await getAstFromPath(reactComponent);
    expect(ast).toBeTruthy();
    expect(file).not.toBeNull();
    await file.close();
  });

  test("it opens a file from path", async () => {
    const { ast, file } = await getAstFromPath(defaultExport);
    expect(ast).toBeTruthy();
    expect(file).not.toBeNull();
    await file.close();
  });
});
