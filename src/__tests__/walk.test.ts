import { describe, expect, test } from "@jest/globals";
import { Volume, createFsFromVolume } from "memfs";
import { walkRepoFiles } from "../walk.js";

const walkVolume = Volume.fromJSON({
  "/repo/src/index.ts": "const x = 1;",
  "/repo/src/components/Button.tsx": "export const Button = () => null;",
  "/repo/src/styles/main.css": "body {}",
  "/repo/src/utils/helper.js": "export const helper = () => {};",
  "/repo/src/mjs/mod.mjs": "export const mod = 1;",
  "/repo/src/cjs/mod.cjs": "const mod = 1;",
  "/repo/src/views/App.vue": "<template></template>",
  "/repo/node_modules/lodash/index.js": "module.exports = {};",
  "/repo/.hidden/secret.ts": "const secret = 1;",
  "/repo/src/empty/.gitkeep": "",
});
const walkFsMock = createFsFromVolume(walkVolume);

jest.mock("node:fs/promises", () => ({
  ...jest.requireActual("node:fs/promises"),
  readdir: jest.fn().mockImplementation((path: string, options?: unknown) => {
    return walkFsMock.promises.readdir(path, options as never);
  }),
}));

async function collect(gen: AsyncIterable<string>): Promise<string[]> {
  const result: string[] = [];
  for await (const item of gen) {
    result.push(item);
  }
  return result;
}

describe("walkRepoFiles", () => {
  test("yields supported JS/TS/Vue extensions", async () => {
    const files = await collect(walkRepoFiles("/repo/src"));
    expect(files).toContain("/repo/src/index.ts");
    expect(files).toContain("/repo/src/utils/helper.js");
    expect(files).toContain("/repo/src/mjs/mod.mjs");
    expect(files).toContain("/repo/src/cjs/mod.cjs");
    expect(files).toContain("/repo/src/views/App.vue");
    expect(files).toContain("/repo/src/components/Button.tsx");
  });

  test("excludes unsupported extensions", async () => {
    const files = await collect(walkRepoFiles("/repo/src"));
    expect(files).not.toContain("/repo/src/styles/main.css");
  });

  test("recurses into subdirectories", async () => {
    const files = await collect(walkRepoFiles("/repo/src"));
    expect(files).toContain("/repo/src/components/Button.tsx");
  });

  test("excludes node_modules", async () => {
    const files = await collect(walkRepoFiles("/repo"));
    expect(files.some((f) => f.includes("node_modules"))).toBe(false);
  });

  test("excludes hidden directories (dot-prefixed)", async () => {
    const files = await collect(walkRepoFiles("/repo"));
    expect(files.some((f) => f.includes(".hidden"))).toBe(false);
  });

  test("returns no files for directory with only non-matching entries", async () => {
    const files = await collect(walkRepoFiles("/repo/src/empty"));
    expect(files).toHaveLength(0);
  });
});
