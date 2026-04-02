import { describe, it, expect, jest } from "@jest/globals";
import { enrichWithContext } from "../context.js";
import type { Match } from "../types.js";

jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
}));

import { readFile } from "node:fs/promises";
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

// Five-line file used across most tests
const FIVE_LINES = "line1\nline2\nline3\nline4\nline5";

function match(file: string, line: number): Match {
  return { file, line, col: 0, source: `source at ${line}` };
}

describe("enrichWithContext", () => {
  it("adds contextBefore and contextAfter around a mid-file match", async () => {
    mockReadFile.mockResolvedValue(FIVE_LINES as never);
    const [result] = await enrichWithContext([match("foo.ts", 3)], 1);
    expect(result.contextBefore).toEqual(["line2"]);
    expect(result.contextAfter).toEqual(["line4"]);
  });

  it("returns N lines of context when available", async () => {
    mockReadFile.mockResolvedValue(FIVE_LINES as never);
    const [result] = await enrichWithContext([match("foo.ts", 3)], 2);
    expect(result.contextBefore).toEqual(["line1", "line2"]);
    expect(result.contextAfter).toEqual(["line4", "line5"]);
  });

  it("clamps contextBefore at file start (line 1)", async () => {
    mockReadFile.mockResolvedValue(FIVE_LINES as never);
    const [result] = await enrichWithContext([match("foo.ts", 1)], 3);
    expect(result.contextBefore).toEqual([]);
    expect(result.contextAfter).toEqual(["line2", "line3", "line4"]);
  });

  it("clamps contextAfter at file end", async () => {
    mockReadFile.mockResolvedValue(FIVE_LINES as never);
    const [result] = await enrichWithContext([match("foo.ts", 5)], 3);
    expect(result.contextBefore).toEqual(["line2", "line3", "line4"]);
    expect(result.contextAfter).toEqual([]);
  });

  it("reads each unique file only once for multiple matches", async () => {
    mockReadFile.mockResolvedValue(FIVE_LINES as never);
    await enrichWithContext([match("foo.ts", 2), match("foo.ts", 4)], 1);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it("reads each file separately for matches in different files", async () => {
    mockReadFile.mockResolvedValue(FIVE_LINES as never);
    await enrichWithContext([match("a.ts", 2), match("b.ts", 2)], 1);
    expect(mockReadFile).toHaveBeenCalledTimes(2);
  });

  it("preserves original match fields when enriching", async () => {
    mockReadFile.mockResolvedValue(FIVE_LINES as never);
    const original: Match = { file: "foo.ts", line: 3, col: 7, source: "x()", captures: { name: "x" } };
    const [result] = await enrichWithContext([original], 1);
    expect(result.file).toBe("foo.ts");
    expect(result.line).toBe(3);
    expect(result.col).toBe(7);
    expect(result.source).toBe("x()");
    expect(result.captures).toEqual({ name: "x" });
  });

  it("preserves match and skips context when file cannot be read", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT") as never);
    const original = match("missing.ts", 2);
    const [result] = await enrichWithContext([original], 2);
    expect(result.file).toBe("missing.ts");
    expect(result.source).toBe("source at 2");
    expect(result.contextBefore).toBeUndefined();
    expect(result.contextAfter).toBeUndefined();
  });

  it("preserves order of matches across multiple files", async () => {
    mockReadFile.mockResolvedValue(FIVE_LINES as never);
    const matches = [match("b.ts", 2), match("a.ts", 3), match("b.ts", 4)];
    const results = await enrichWithContext(matches, 1);
    expect(results[0].file).toBe("b.ts");
    expect(results[0].line).toBe(2);
    expect(results[1].file).toBe("a.ts");
    expect(results[2].file).toBe("b.ts");
    expect(results[2].line).toBe(4);
  });
});
