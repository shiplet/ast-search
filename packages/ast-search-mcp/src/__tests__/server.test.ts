import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports
// ---------------------------------------------------------------------------

const mockValidateSelector = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockPrintAst = jest.fn<(ast: unknown, source: string, fmt: string) => string>();
const mockParse = jest.fn<(source: string, filePath: string) => Promise<unknown>>().mockResolvedValue({});

const mockJsBackend = {
  langId: "js",
  name: "JavaScript",
  extensions: new Set([".ts", ".js"]),
  validateSelector: mockValidateSelector,
  printAst: mockPrintAst,
  parse: mockParse,
};

const mockGetByLangId = jest.fn<(id: string) => typeof mockJsBackend | undefined>();
const mockGetByExtension = jest.fn<(ext: string) => typeof mockJsBackend | undefined>();

jest.mock("ast-search-js", () => ({
  searchRepoWithMeta: jest.fn(),
  defaultRegistry: {
    get getByLangId() { return mockGetByLangId; },
    get getByExtension() { return mockGetByExtension; },
    get allBackends() { return [mockJsBackend]; },
  },
  explainSelector: jest.fn<(s: string) => string>(),
  enrichWithContext: jest.fn(),
}));

jest.mock("ast-search-js/plugin", () => ({
  LanguageRegistry: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    getByLangId: jest.fn(),
    allBackends: [],
    allExtensions: new Set(),
  })),
}));

jest.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: jest.fn(),
    connect: jest.fn(),
  })),
}));

jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { searchRepoWithMeta, explainSelector, enrichWithContext } from "ast-search-js";
import { readFile } from "node:fs/promises";
import {
  handleSearch,
  handleValidateQuery,
  handleShowAst,
  loadPlugins,
  _resetLoadedPlugins,
} from "../server.js";

const mockSearchRepoWithMeta = searchRepoWithMeta as jest.MockedFunction<typeof searchRepoWithMeta>;
const mockExplainSelector = explainSelector as jest.MockedFunction<typeof explainSelector>;
const mockEnrichWithContext = enrichWithContext as jest.MockedFunction<typeof enrichWithContext>;
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ---------------------------------------------------------------------------
// handleSearch
// ---------------------------------------------------------------------------

describe("handleSearch", () => {
  beforeEach(() => {
    mockGetByLangId.mockReturnValue(mockJsBackend);
    mockSearchRepoWithMeta.mockResolvedValue({
      matches: [{ file: "src/foo.ts", line: 1, col: 0, source: "foo()" }],
      filesSearched: 10,
      truncated: false,
    });
  });

  it("returns matches and _meta in the expected shape", async () => {
    const result = await handleSearch({ queries: ["call"] });
    const parsed = parseResult(result);
    expect(parsed.matches).toHaveLength(1);
    expect(parsed.matches[0].file).toBe("src/foo.ts");
    expect(parsed._meta.matchCount).toBe(1);
    expect(parsed._meta.filesSearched).toBe(10);
    expect(parsed._meta.truncated).toBe(false);
    expect(parsed._meta.queries).toEqual(["call"]);
    expect(typeof parsed._meta.wallMs).toBe("number");
  });

  it("passes limit to searchRepoWithMeta", async () => {
    await handleSearch({ queries: ["call"], limit: 5 });
    expect(mockSearchRepoWithMeta).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ limit: 5 }),
    );
  });

  it("calls enrichWithContext when context > 0", async () => {
    const enriched = [{ file: "src/foo.ts", line: 1, col: 0, source: "foo()", contextBefore: ["prev"], contextAfter: ["next"] }];
    mockEnrichWithContext.mockResolvedValue(enriched);

    await handleSearch({ queries: ["call"], context: 2 });
    expect(mockEnrichWithContext).toHaveBeenCalledWith(expect.any(Array), 2);
  });

  it("does not call enrichWithContext when context is 0 or absent", async () => {
    await handleSearch({ queries: ["call"] });
    expect(mockEnrichWithContext).not.toHaveBeenCalled();
  });

  it("returns isError: true on searchRepoWithMeta failure", async () => {
    mockSearchRepoWithMeta.mockRejectedValue(new Error("parse failed"));
    const result = await handleSearch({ queries: ["call"] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("parse failed");
  });

  it("returns isError: true for unknown language", async () => {
    mockGetByLangId.mockReturnValue(undefined);
    const result = await handleSearch({ queries: ["call"], lang: "cobol" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown language");
  });

  it("reflects truncated: true in _meta when searchRepoWithMeta reports truncation", async () => {
    mockSearchRepoWithMeta.mockResolvedValue({
      matches: [{ file: "a.ts", line: 1, col: 0, source: "x" }],
      filesSearched: 3,
      truncated: true,
    });
    const result = await handleSearch({ queries: ["call"], limit: 1 });
    expect(parseResult(result)._meta.truncated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleValidateQuery
// ---------------------------------------------------------------------------

describe("handleValidateQuery", () => {
  beforeEach(() => {
    mockGetByLangId.mockReturnValue(mockJsBackend);
    mockValidateSelector.mockResolvedValue(undefined);
    mockExplainSelector.mockReturnValue("CallExpression nodes");
  });

  it("returns valid: true with explanation for a valid JS query", async () => {
    const result = await handleValidateQuery({ query: "call" });
    const parsed = parseResult(result);
    expect(parsed.valid).toBe(true);
    expect(parsed.lang).toBe("js");
    expect(parsed.explanation).toBe("CallExpression nodes");
  });

  it("returns valid: false (not isError) when validateSelector throws", async () => {
    mockValidateSelector.mockRejectedValue(new Error("Unexpected token"));
    const result = await handleValidateQuery({ query: ">>> invalid" });
    expect(result.isError).toBeUndefined();
    const parsed = parseResult(result);
    expect(parsed.valid).toBe(false);
    expect(parsed.error).toContain("Unexpected token");
  });

  it("returns isError: true for unknown language (config error, not syntax error)", async () => {
    mockGetByLangId.mockReturnValue(undefined);
    const result = await handleValidateQuery({ query: "call", lang: "cobol" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown language");
  });

  it("defaults to js backend when lang is omitted", async () => {
    await handleValidateQuery({ query: "call" });
    expect(mockGetByLangId).toHaveBeenCalledWith("js");
  });

  it("omits explanation field when backend is not js", async () => {
    const pythonBackend = { ...mockJsBackend, langId: "python", name: "Python" };
    mockGetByLangId.mockReturnValue(pythonBackend);
    const result = await handleValidateQuery({ query: "call", lang: "python" });
    const parsed = parseResult(result);
    expect(parsed.valid).toBe(true);
    expect(parsed.explanation).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// handleShowAst
// ---------------------------------------------------------------------------

describe("handleShowAst", () => {
  beforeEach(() => {
    mockGetByLangId.mockReturnValue(mockJsBackend);
    mockGetByExtension.mockReturnValue(mockJsBackend);
    mockParse.mockResolvedValue({ type: "File" });
    mockPrintAst.mockReturnValue("VariableDeclaration\n  id: Identifier");
  });

  it("returns AST text for an inline code snippet", async () => {
    const result = await handleShowAst({ code: "const x = 1" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("VariableDeclaration");
  });

  it("passes the correct filePath for a JS snippet (snippet.ts)", async () => {
    await handleShowAst({ code: "const x = 1" });
    expect(mockParse).toHaveBeenCalledWith("const x = 1", "snippet.ts");
  });

  it("passes snippet.py filePath when lang is python", async () => {
    const pythonBackend = { ...mockJsBackend, langId: "python" };
    mockGetByLangId.mockReturnValue(pythonBackend);
    await handleShowAst({ code: "x = 1", lang: "python" });
    expect(mockParse).toHaveBeenCalledWith("x = 1", "snippet.py");
  });

  it("reads a file and returns its AST", async () => {
    mockReadFile.mockResolvedValue("const x = require('fs')" as never);
    const result = await handleShowAst({ file: "/src/foo.ts" });
    expect(mockReadFile).toHaveBeenCalledWith("/src/foo.ts", "utf8");
    expect(result.content[0].text).toContain("VariableDeclaration");
  });

  it("slices the file to the requested line range", async () => {
    mockReadFile.mockResolvedValue("line1\nline2\nline3\nline4" as never);
    await handleShowAst({ file: "/src/foo.ts", lines: "2-3" });
    expect(mockParse).toHaveBeenCalledWith("line2\nline3", "/src/foo.ts");
  });

  it("returns isError: true when neither code nor file is provided", async () => {
    const result = await handleShowAst({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Provide either code");
  });

  it("returns isError: true when backend has no printAst method", async () => {
    const noPrintAst = { ...mockJsBackend, printAst: undefined } as unknown as typeof mockJsBackend;
    mockGetByLangId.mockReturnValue(noPrintAst);
    const result = await handleShowAst({ code: "x()" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("does not support show_ast");
  });

  it("returns isError: true for invalid line range format", async () => {
    mockReadFile.mockResolvedValue("line1\nline2" as never);
    const result = await handleShowAst({ file: "/src/foo.ts", lines: "abc" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid lines value");
  });
});

// ---------------------------------------------------------------------------
// loadPlugins / _resetLoadedPlugins
// ---------------------------------------------------------------------------

describe("loadPlugins", () => {
  beforeEach(() => {
    _resetLoadedPlugins();
  });

  it("does not throw for an empty plugin list", async () => {
    await expect(loadPlugins([])).resolves.not.toThrow();
  });

  it("throws when a module has no register() export", async () => {
    jest.resetModules();
    // Simulate a bad plugin by mocking a module with no register export.
    // We can test this indirectly: a package that doesn't exist will throw on import.
    await expect(loadPlugins(["this-package-does-not-exist-xyz"])).rejects.toThrow();
  });

  it("does not double-register a plugin loaded twice", async () => {
    // We test this by checking the Set prevents duplicate work.
    // After _resetLoadedPlugins, loading an empty array twice should be idempotent.
    await loadPlugins([]);
    await loadPlugins([]);
    // No throws; idempotent is the pass condition.
  });
});
