import { describe, expect, test } from "@jest/globals";
import { fsMock, jsBasics, vueSFCOnlyJS } from "./setup";
import { searchRepo } from "../main.js";

jest.mock("node:fs/promises", () => ({
  ...jest.requireActual("node:fs/promises"),
  open: jest.fn().mockImplementation((path: string, flags?: unknown) =>
    fsMock.promises.open(path, flags as never),
  ),
  readdir: jest.fn().mockImplementation((path: string, options?: unknown) =>
    fsMock.promises.readdir(path, options as never),
  ),
}));

describe("searchRepo", () => {
  test("bare-ident: finds nodes by name across files", async () => {
    const matches = await searchRepo("arrowFunction", "/");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.file !== "")).toBe(true);
  });

  test("bare-expr: finds ThisExpression nodes", async () => {
    const matches = await searchRepo("this", "/");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.file !== "")).toBe(true);
  });

  test("scope query: finds expression inside named scope", async () => {
    const matches = await searchRepo("setup > this", "/");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.file === vueSFCOnlyJS)).toBe(true);
  });

  test("returns empty array when nothing matches", async () => {
    const matches = await searchRepo("__nonexistent_xyz_9999__", "/");
    expect(matches).toHaveLength(0);
  });

  test("each match has file, line, col, and text fields", async () => {
    const matches = await searchRepo("arrowFunction", "/");
    const m = matches[0];
    expect(typeof m.file).toBe("string");
    expect(typeof m.line).toBe("number");
    expect(typeof m.col).toBe("number");
    expect(typeof m.text).toBe("string");
  });

  test("skips files that fail to parse without throwing", async () => {
    const matches = await searchRepo("this", "/");
    expect(Array.isArray(matches)).toBe(true);
  });

  test("match file paths are limited to the given dir", async () => {
    const matches = await searchRepo("arrowFunction", "/");
    expect(matches.every((m) => m.file.startsWith("/"))).toBe(true);
  });

  test("rejects with Error on invalid query syntax", async () => {
    await expect(searchRepo(">>> invalid", "/")).rejects.toThrow(Error);
  });
});
