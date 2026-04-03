import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  searchRepoWithMeta,
  defaultRegistry,
  explainSelector,
  enrichWithContext,
} from "ast-search-js";
import { LanguageRegistry } from "ast-search-js/plugin";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

// ---------------------------------------------------------------------------
// Plugin management
// ---------------------------------------------------------------------------

// Track loaded plugins so we never double-register.
// Node.js module caching makes re-imports free; the Set prevents duplicate register() calls.
const loadedPlugins = new Set<string>();

export async function loadPlugins(plugins: string[]): Promise<void> {
  for (const pkg of plugins) {
    if (loadedPlugins.has(pkg)) continue;
    const mod = (await import(pkg)) as {
      register?: (r: unknown) => void;
      default?: { register?: (r: unknown) => void };
    };
    const reg = mod.register ?? mod.default?.register;
    if (typeof reg !== "function") {
      throw new Error(`Plugin "${pkg}" has no register() export`);
    }
    reg(defaultRegistry);
    loadedPlugins.add(pkg);
  }
}

/** Reset plugin tracking — for testing only. */
export function _resetLoadedPlugins(): void {
  loadedPlugins.clear();
}

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

// ---------------------------------------------------------------------------
// Input schemas (exported so tests can inspect them)
// ---------------------------------------------------------------------------

export const searchSchema = z.object({
  queries: z.array(z.string()).min(1).describe(
    "One or more AST selector queries. CSS selectors for JS/TS/Vue; S-expressions for Python.",
  ),
  dir: z.string().optional().describe(
    "Root directory to search (default: current working directory)",
  ),
  lang: z.string().optional().describe(
    'Restrict search to one language backend, e.g. "js" or "python"',
  ),
  exclude: z.array(z.string()).optional().describe(
    'Glob patterns to exclude, e.g. ["**/*.test.ts", "dist/**"]',
  ),
  profile: z.enum(["all", "production"]).optional().describe(
    'Exclude preset: "production" skips test/spec/stories/mock/fixture files. "all" (default) applies no extra exclusions.',
  ),
  limit: z.number().int().positive().optional().describe(
    "Stop after N matches. Use for exploratory scope checks on large repos.",
  ),
  context: z.number().int().nonnegative().optional().describe(
    "Number of lines of source context to include above and below each match",
  ),
  showAst: z.boolean().optional().describe(
    "Include the AST subtree of each matched node. Useful when writing or debugging queries.",
  ),
  outputMode: z.enum(["matches", "files", "count"]).optional().describe(
    '"matches" (default) returns full match objects. "files" returns unique file paths only. "count" returns per-file match counts sorted descending.',
  ),
  compact: z.boolean().optional().describe(
    "Omit source_full, astSubtree, contextBefore, and contextAfter from match objects to reduce response size.",
  ),
  plugins: z.array(z.string()).optional().describe(
    'Language plugin packages to load, e.g. ["ast-search-python"]. Loaded once per session.',
  ),
});

export const validateSchema = z.object({
  query: z.string().describe("AST selector to validate"),
  lang: z.string().optional().describe(
    'Language backend to validate against: "js" (default) or "python"',
  ),
  plugins: z.array(z.string()).optional().describe(
    "Language plugin packages required for the target language",
  ),
});

export const showAstSchema = z.object({
  code: z.string().optional().describe("Inline code snippet to parse and print"),
  file: z.string().optional().describe("Path to a source file to parse"),
  lines: z.string().optional().describe(
    'Line range when using file, e.g. "10-20" (1-indexed, inclusive)',
  ),
  lang: z.string().optional().describe(
    'Language to use for parsing: "js" (default) or "python". Inferred from file extension when using file.',
  ),
  plugins: z.array(z.string()).optional().describe(
    "Language plugin packages required for the target language",
  ),
});

// ---------------------------------------------------------------------------
// Handler: search
// ---------------------------------------------------------------------------

// Glob patterns excluded when profile: "production"
const PRODUCTION_EXCLUDE = [
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.stories.*",
  "**/*.d.ts",
  "**/mocks/**",
  "**/fixtures/**",
  "**/__tests__/**",
  "**/__mocks__/**",
];

export async function handleSearch(args: z.infer<typeof searchSchema>): Promise<ToolResult> {
  const { queries, dir, lang, exclude, profile, limit, context, showAst, outputMode, compact, plugins } = args;
  try {
    await loadPlugins(plugins ?? []);

    let registry: LanguageRegistry = defaultRegistry;
    if (lang) {
      const backend = defaultRegistry.getByLangId(lang);
      if (!backend) {
        const available = defaultRegistry.allBackends.map((b) => b.langId).join(", ");
        throw new Error(`Unknown language "${lang}". Available: ${available}`);
      }
      registry = new LanguageRegistry();
      registry.register(backend);
    }

    // Merge user-supplied excludes with profile presets and env-level defaults
    const profileExcludes = profile === "production" ? PRODUCTION_EXCLUDE : [];
    const envExcludes = process.env.AST_SEARCH_EXCLUDE
      ? process.env.AST_SEARCH_EXCLUDE.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const effectiveExclude = [...(exclude ?? []), ...profileExcludes, ...envExcludes];

    const startMs = Date.now();
    const { matches: rawMatches, filesSearched, truncated } = await searchRepoWithMeta(
      queries,
      dir ?? process.cwd(),
      registry,
      effectiveExclude,
      { showAst, limit },
    );
    const wallMs = Date.now() - startMs;

    const enriched = (context ?? 0) > 0
      ? await enrichWithContext(rawMatches, context!)
      : rawMatches;

    const meta = { matchCount: enriched.length, filesSearched, wallMs, queries, truncated };

    // Apply outputMode shaping
    const mode = outputMode ?? "matches";
    let output: unknown;

    if (mode === "files") {
      const files = [...new Set(enriched.map((m) => m.file))];
      output = { files, _meta: { ...meta, matchCount: files.length } };
    } else if (mode === "count") {
      const counts = new Map<string, number>();
      for (const m of enriched) counts.set(m.file, (counts.get(m.file) ?? 0) + 1);
      const sorted = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([file, count]) => ({ file, count }));
      output = { files: sorted, _meta: meta };
    } else {
      // Apply compact: strip verbose fields
      const matches = compact
        ? enriched.map(({ source_full: _sf, astSubtree: _ast, contextBefore: _cb, contextAfter: _ca, ...rest }) => rest)
        : enriched;
      output = { matches, _meta: meta };
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
  }
}

// ---------------------------------------------------------------------------
// Handler: validate_query
// ---------------------------------------------------------------------------

export async function handleValidateQuery(
  args: z.infer<typeof validateSchema>,
): Promise<ToolResult> {
  const { query, lang, plugins } = args;
  try {
    await loadPlugins(plugins ?? []);

    const backend = lang
      ? defaultRegistry.getByLangId(lang)
      : defaultRegistry.getByLangId("js");

    if (!backend) {
      const available = defaultRegistry.allBackends.map((b) => b.langId).join(", ");
      throw new Error(`Unknown language "${lang}". Available: ${available}`);
    }

    await backend.validateSelector(query);

    const result: Record<string, unknown> = { valid: true, lang: backend.langId };

    if (backend.langId === "js") {
      const explanation = explainSelector(query);
      if (explanation) result.explanation = explanation;
    } else if (backend.langId === "python") {
      result.hint =
        "Query syntax is valid. To verify it matches real code, use show_ast on a .py file " +
        "(pass file + optional lines) to inspect node types, then re-run your query. " +
        "If the query returns 0 results, the node type or field name may not match — " +
        "check the AST output and adjust accordingly.";
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConfigError = msg.startsWith("Unknown language");
    if (isConfigError) {
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
    }
    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ valid: false, error: msg }, null, 2) },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// Handler: show_ast
// ---------------------------------------------------------------------------

export async function handleShowAst(args: z.infer<typeof showAstSchema>): Promise<ToolResult> {
  const { code, file, lines, lang, plugins } = args;
  try {
    await loadPlugins(plugins ?? []);

    let source: string;
    let filePath: string;

    if (file) {
      source = await readFile(file, "utf8");
      if (lines) {
        const parts = lines.split("-").map(Number);
        const start = parts[0];
        const end = parts[1] ?? start;
        if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
          throw new Error(
            `Invalid lines value "${lines}". Expected format: N or N-M (e.g. "10-20")`,
          );
        }
        source = source.split("\n").slice(start - 1, end).join("\n");
      }
      filePath = file;
    } else if (code) {
      source = code;
      filePath = lang === "python" ? "snippet.py" : "snippet.ts";
    } else {
      throw new Error("Provide either code (inline snippet) or file (path to source file)");
    }

    const backend = lang
      ? defaultRegistry.getByLangId(lang)
      : file
        ? defaultRegistry.getByExtension(extname(file))
        : defaultRegistry.getByLangId("js");

    if (!backend) {
      const available = defaultRegistry.allBackends.map((b) => b.langId).join(", ");
      const hint = lang ? ` Did you forget to include it in plugins?` : "";
      throw new Error(
        `No backend for "${lang ?? extname(file ?? "")}".${hint} Available: ${available}`,
      );
    }
    if (!backend.printAst) {
      throw new Error(`Backend "${backend.langId}" does not support show_ast`);
    }

    const ast = await backend.parse(source, filePath);
    const text = backend.printAst(ast, source, "text");

    return { content: [{ type: "text" as const, text }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
  }
}

// ---------------------------------------------------------------------------
// Server (configured but not connected — connection happens in index.ts)
// ---------------------------------------------------------------------------

export const server = new McpServer({ name: "ast-search", version: "0.1.0" });

server.registerTool(
  "search",
  {
    title: "Search code by AST pattern",
    description: `Search source code using AST structural patterns (CSS selectors for JS/TS/Vue; S-expressions for Python).
Returns precise match locations with file path, line, column, source snippet, and scope metadata.
Prefer this over grep/ripgrep when the query is about code structure rather than text.

Query examples:
  ["FunctionDeclaration[async=true]"]                                 — async function declarations
  ["call[callee.property.name='log']"]                                — calls to any .log() method
  ["ImportDeclaration[source.value=/\\.tsx$/]:not([source.value=/graphql/])"]  — .tsx imports excluding graphql
  ["await"]                                                           — all await expressions

Workflow tips:
- Use outputMode: "files" or "count" for audits — avoids shipping source snippets you don't need.
- Use profile: "production" to skip test/stories/mock files without specifying them manually each time.
- Set AST_SEARCH_EXCLUDE env var for project-level default exclusions (comma-separated glob patterns).
- Use compact: true to strip source_full/context fields when you only need match locations.
- Use limit (e.g. 10) for scope checks before committing to a large refactor.
- Pass multiple queries to search for several patterns in a single repo walk.
- Use showAst: true when you need to refine a query — it prints the AST subtree of each match.
- Regex in :not() works: [attr=/pattern/]:not([attr=/other/]) is valid syntax.
- For Python files, pass plugins: ["ast-search-python"] and use tree-sitter S-expressions.`,
    inputSchema: searchSchema,
  },
  handleSearch,
);

server.registerTool(
  "validate_query",
  {
    title: "Validate an AST query",
    description:
      "Validate an AST selector without running a search. Returns whether the syntax is valid and, for JS queries, a plain-English explanation of what nodes the query matches. For Python queries, returns a hint pointing to the show_ast workflow for discovering correct node types. Use this before running an unfamiliar query on a large repo.",
    inputSchema: validateSchema,
  },
  handleValidateQuery,
);

server.registerTool(
  "show_ast",
  {
    title: "Show AST structure for code",
    description:
      "Print the AST structure of a code snippet or file. Use this to discover node types and property paths when writing queries. Pass a short code snippet to see its structure, or specify a file with an optional line range.",
    inputSchema: showAstSchema,
  },
  handleShowAst,
);
