import { describe, expect, test } from "@jest/globals";
import { fsMock, vueSFCOnlyJS, reactListNoKey } from "./setup";
import { searchRepo } from "../main.js";
import { validateSelector } from "../search.js";

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
  test("type selector: finds FunctionDeclaration nodes across files", async () => {
    const matches = await searchRepo(["FunctionDeclaration"], "/");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.file !== "")).toBe(true);
  });

  test("shorthand: 'this' expands to ThisExpression", async () => {
    const matches = await searchRepo(["ThisExpression"], "/");
    const shorthandMatches = await searchRepo(["this"], "/");
    expect(shorthandMatches.length).toBe(matches.length);
  });

  test("descendant combinator: finds this inside methods", async () => {
    const matches = await searchRepo(["ObjectMethod ThisExpression"], "/");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.file === vueSFCOnlyJS)).toBe(true);
  });

  test("returns empty array when nothing matches", async () => {
    const matches = await searchRepo(["DebuggerStatement"], "/");
    expect(matches).toHaveLength(0);
  });

  test("each match has file, line, col, and source fields", async () => {
    const matches = await searchRepo(["FunctionDeclaration"], "/");
    const m = matches[0];
    expect(typeof m.file).toBe("string");
    expect(typeof m.line).toBe("number");
    expect(typeof m.col).toBe("number");
    expect(typeof m.source).toBe("string");
  });

  test("match source contains the first line of the matched node", async () => {
    const matches = await searchRepo(["FunctionDeclaration"], "/");
    expect(matches[0].source).toBeTruthy();
    expect(matches[0].source).not.toContain("\n");
  });

  test("skips files that fail to parse without throwing", async () => {
    const matches = await searchRepo(["ThisExpression"], "/");
    expect(Array.isArray(matches)).toBe(true);
  });

  test("match file paths are limited to the given dir", async () => {
    const matches = await searchRepo(["FunctionDeclaration"], "/");
    expect(matches.every((m) => m.file.startsWith("/"))).toBe(true);
  });

  test("attribute selector: finds .map() calls", async () => {
    const matches = await searchRepo(
      ['CallExpression[callee.property.name="map"]'],
      "/",
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.file === reactListNoKey)).toBe(true);
  });

  test(":has() + :not(): target query finds map-without-key components", async () => {
    const matches = await searchRepo(
      ['VariableDeclarator:has(CallExpression[callee.property.name="map"]):not(:has(JSXAttribute[name.name="key"]))'],
      "/",
    );
    expect(matches.some((m) => m.file === reactListNoKey)).toBe(true);
    expect(matches.every((m) => !m.source.includes("ListWithKey"))).toBe(true);
  });

  test("throws on invalid selector syntax", async () => {
    await expect(searchRepo([">>> invalid ::::"], "/")).rejects.toThrow();
  });

  test("single query: matches have no query field", async () => {
    const matches = await searchRepo(["FunctionDeclaration"], "/");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.query === undefined)).toBe(true);
  });

  test("multi-query: returns matches for all queries combined", async () => {
    const single1 = await searchRepo(["FunctionDeclaration"], "/");
    const single2 = await searchRepo(['CallExpression[callee.property.name="map"]'], "/");
    const multi = await searchRepo(["FunctionDeclaration", 'CallExpression[callee.property.name="map"]'], "/");
    expect(multi.length).toBe(single1.length + single2.length);
  });

  test("multi-query: each match has a query field identifying its selector", async () => {
    const matches = await searchRepo(["FunctionDeclaration", "ThisExpression"], "/");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.query !== undefined)).toBe(true);
    const fnMatches = matches.filter((m) => m.query === "FunctionDeclaration");
    const thisMatches = matches.filter((m) => m.query === "ThisExpression");
    expect(fnMatches.length).toBeGreaterThan(0);
    expect(thisMatches.length).toBeGreaterThan(0);
  });

  test("multi-query: throws if any query is invalid", async () => {
    await expect(
      searchRepo(["FunctionDeclaration", ">>> invalid ::::"], "/"),
    ).rejects.toThrow();
  });

  test("multi-query: returns empty array when no query matches", async () => {
    const matches = await searchRepo(["DebuggerStatement", "LabeledStatement"], "/");
    expect(matches).toHaveLength(0);
  });
});

describe("validateSelector (--validate flag logic)", () => {
  test("valid type selector does not throw", () => {
    expect(() => validateSelector("CallExpression")).not.toThrow();
  });

  test("invalid selector throws", () => {
    expect(() => validateSelector(">>> invalid ::::")).toThrow();
  });

  test("JS shorthands are valid", () => {
    expect(() => validateSelector("call")).not.toThrow();
    expect(() => validateSelector("fn")).not.toThrow();
    expect(() => validateSelector("arrow")).not.toThrow();
  });

  test("compound selector is valid", () => {
    expect(() => validateSelector("FunctionDeclaration:has(AwaitExpression)")).not.toThrow();
  });
});
