import { afterEach, describe, expect, test } from "@jest/globals";
import {
  fsMock,
  fullVueSFC,
  jsBasics,
  emptyFile,
  reactComponent,
} from "./setup";
import { searchForRootNodes, SearchableNode } from "../search";
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
    { root: "arrowFunction", size: 2 },
    { root: "objectExample", size: 1 },
    { root: "b", size: 2 },
  ].forEach((c) => {
    test(`it finds ${c.size} root node${c.size > 1 ? "s" : ""} named '${c.root}' in jsBasics.js`, async () => {
      ({ ast, file } = await getAstFromPath(jsBasics));

      const found = searchForRootNodes(c.root)(
        ast.program.body as unknown as SearchableNode[],
      );
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
    test(`it finds ${c.size} root node${c.size > 1 ? "s" : ""} named '${c.root}' in handleSetupThisOnlyJs.js`, async () => {
      ({ ast, file } = await getAstFromPath(fullVueSFC));
      const found = searchForRootNodes(c.root)(
        ast.program.body as unknown as SearchableNode[],
      );

      expect(found.size).toEqual(c.size);
    });
  });

  test("it searches multiple root nodes", async () => {
    ({ ast, file } = await getAstFromPath(reactComponent));
    const found = searchForRootNodes("useState")(
      ast.program.body as unknown as SearchableNode[],
    );
    expect(found.size).toEqual(3);
  });

  test("it handles an empty file", async () => {
    ({ ast, file } = await getAstFromPath(emptyFile));
    const found = searchForRootNodes("any")(
      ast.program.body as unknown as SearchableNode[],
    );
    expect(found.size).toEqual(0);
  });
});
