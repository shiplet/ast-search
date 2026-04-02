#!/usr/bin/env node
import yargs from "yargs/yargs";
import { readFile } from "node:fs/promises";
import { createRequire } from "module";
import { resolve, dirname, extname } from "node:path";
import { walkRepoFiles } from "./walk.js";
import { parseFile } from "./file.js";
import type { Match } from "./types.js";
import { formatMatches, type OutputFormat, type SearchMeta } from "./output.js";
import { explainSelector } from "./search.js";
import { enrichWithContext } from "./context.js";
import { defaultRegistry, type LanguageRegistry } from "./registry.js";
import { JSLanguageBackend } from "./backends/js/index.js";
import { VERSION } from "./version.js";


// Register built-in JS/TS/Vue backend
defaultRegistry.register(new JSLanguageBackend());

export interface SearchRepoResult {
  matches: Match[];
  filesSearched: number;
  truncated: boolean;
}

async function searchRepoFull(
  selectors: string[],
  dir: string,
  registry: LanguageRegistry,
  exclude: string[],
  options: { showAst?: boolean; limit?: number } = {},
): Promise<SearchRepoResult> {
  // Early validation when only one backend is registered (common JS-only case)
  if (registry.allBackends.length === 1) {
    for (const selector of selectors) {
      await registry.allBackends[0].validateSelector(selector);
    }
  }

  const multiQuery = selectors.length > 1;
  const results: Match[] = [];
  let filesSearched = 0;
  let truncated = false;
  const { limit, ...queryOptions } = options;

  for await (const filePath of walkRepoFiles(dir, registry.allExtensions, exclude)) {
    filesSearched++;
    try {
      const { ast, source, backend } = await parseFile(filePath, registry);
      for (const selector of selectors) {
        const matches = await backend.query(ast, selector, source, filePath, queryOptions);
        if (multiQuery) {
          results.push(...matches.map((m) => ({ ...m, query: selector })));
        } else {
          results.push(...matches);
        }
      }
    } catch {
      // skip unparseable files / unsupported extensions
    }

    if (limit !== undefined && results.length >= limit) {
      truncated = true;
      break;
    }
  }

  const matches = limit !== undefined ? results.slice(0, limit) : results;
  return { matches, filesSearched, truncated };
}

export async function searchRepoWithMeta(
  selectors: string[],
  dir: string,
  registry = defaultRegistry,
  exclude: string[] = [],
  options: { showAst?: boolean; limit?: number } = {},
): Promise<SearchRepoResult> {
  return searchRepoFull(selectors, dir, registry, exclude, options);
}

export async function searchRepo(
  selectors: string[],
  dir: string,
  registry = defaultRegistry,
  exclude: string[] = [],
  options: { showAst?: boolean } = {},
): Promise<Match[]> {
  const { matches } = await searchRepoFull(selectors, dir, registry, exclude, options);
  return matches;
}

async function runAstMode(opts: {
  query?: string;
  file?: string;
  lines?: string;
  format: string;
  lang?: string;
  plugin?: string[];
}): Promise<void> {
  const { query, file, lines, format, lang, plugin } = opts;

  for (const pkg of plugin ?? []) {
    const mod = await import(pkg) as { register?: (r: typeof defaultRegistry) => void; default?: { register?: (r: typeof defaultRegistry) => void } };
    const reg = mod.register ?? mod.default?.register;
    if (typeof reg !== "function") {
      throw new Error(`Plugin "${pkg}" does not export a register() function`);
    }
    reg(defaultRegistry);
  }

  let source: string;
  let filePath: string;

  if (file) {
    source = await readFile(file, "utf8");
    if (lines) {
      const [startStr, endStr] = lines.split("-");
      const start = parseInt(startStr, 10) - 1;
      const end = endStr ? parseInt(endStr, 10) : start + 1;
      if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
        throw new Error(`Invalid --lines value "${lines}". Expected format: N or N-M (e.g. 10-20)`);
      }
      source = source.split("\n").slice(start, end).join("\n");
    }
    filePath = file;
  } else if (query) {
    source = query;
    // Infer a plausible file extension for the backend to key on
    filePath = lang === "python" ? "snippet.py" : "snippet.ts";
  } else {
    throw new Error("--ast requires a code snippet (positional arg) or --file <path>");
  }

  let backend = lang
    ? defaultRegistry.getByLangId(lang)
    : file
      ? defaultRegistry.getByExtension(extname(file))
      : defaultRegistry.getByLangId("js");

  if (!backend) {
    const available = defaultRegistry.allBackends.map((b) => b.langId).join(", ");
    const hint = lang ? ` Did you forget --plugin?` : "";
    throw new Error(`No backend found for "${lang ?? extname(file ?? "")}"${hint} Available: ${available}`);
  }

  if (!backend.printAst) {
    throw new Error(`Backend "${backend.langId}" does not support --ast mode`);
  }

  const ast = await backend.parse(source, filePath);
  const fmt = format === "json" ? "json" : "text";
  process.stdout.write(backend.printAst(ast, source, fmt) + "\n");
  process.exit(0);
}

const y = yargs(process.argv.slice(2))
  .scriptName("ast-search")
  .usage("$0 <query> [query2 ...] [--dir <path>] [--format <fmt>]")
  .command(
    "$0 [queries..]",
    "Search a repo for AST patterns using CSS selector syntax",
    (yargs) =>
      yargs
        .positional("queries", {
          type: "string",
          array: true,
          describe: "One or more query strings (esquery CSS selector for JS/TS; tree-sitter S-expression for Python)",
        })
        .option("agent-help", {
          type: "boolean",
          describe: "print AGENTS.md guidance for AI coding agents and exit (combine with --plugin to include plugin docs)",
          default: false,
        })
        .option("dir", {
          alias: "d",
          type: "string",
          describe: "root directory to search",
          default: process.cwd(),
        })
        .option("format", {
          alias: "f",
          type: "string",
          describe: "output format: text (default), json, files",
          default: "text",
          choices: ["text", "json", "files", "count"],
        })
        .option("lang", {
          alias: "l",
          type: "string",
          describe: "restrict search to a specific language backend by langId (e.g. js, python)",
        })
        .option("plugin", {
          alias: "p",
          type: "string",
          array: true,
          describe: "load a language plugin package (e.g. ast-search-python)",
        })
        .option("context", {
          alias: "C",
          type: "number",
          describe: "show N lines of context around each match (like grep -C)",
          default: 0,
        })
        .option("ast", {
          type: "boolean",
          describe: "print AST structure for a code snippet (positional arg) or --file; useful for writing queries",
          default: false,
        })
        .option("file", {
          type: "string",
          describe: "source file to parse in --ast mode",
        })
        .option("lines", {
          type: "string",
          describe: "line range to extract in --ast --file mode, e.g. 10-20 (1-indexed, inclusive)",
        })
        .option("show-ast", {
          type: "boolean",
          describe: "print the AST subtree of each matched node below the match line (useful when writing queries)",
          default: false,
        })
        .option("exclude", {
          alias: "x",
          type: "string",
          array: true,
          describe: 'glob patterns to exclude from search (e.g. "**/*.test.ts", "dist/**")',
          default: [] as string[],
        })
        .option("validate", {
          type: "boolean",
          description: "Check query syntax without running a search. Exits 0 if valid, 2 if invalid.",
          default: false,
        })
        .option("limit", {
          alias: "n",
          type: "number",
          describe: "stop after N matches (useful for exploratory queries on large repos)",
        }),
    async (argv) => {
      const { queries, dir, format, lang, plugin, agentHelp, ast, file, lines, context, validate, exclude, showAst, limit } = argv as {
        queries?: string[];
        dir: string;
        format: OutputFormat;
        lang?: string;
        plugin?: string[];
        agentHelp: boolean;
        ast: boolean;
        file?: string;
        lines?: string;
        context: number;
        validate: boolean;
        exclude: string[];
        showAst: boolean;
        limit?: number;
      };
      const query = queries?.[0];

      if (agentHelp) {
        const scriptDir = dirname(resolve(process.argv[1] ?? ""));
        const coreAgentsPath = resolve(scriptDir, "..", "AGENTS.md");
        const coreContent = await readFile(coreAgentsPath, "utf8");
        process.stdout.write(coreContent);
        const _require = createRequire(resolve(process.argv[1] ?? ""));
        for (const pkg of plugin ?? []) {
          try {
            const pluginMain = _require.resolve(pkg);
            const pluginAgentsPath = resolve(dirname(pluginMain), "..", "AGENTS.md");
            const pluginContent = await readFile(pluginAgentsPath, "utf8");
            process.stdout.write("\n---\n\n" + pluginContent);
          } catch {
            // plugin has no AGENTS.md or couldn't be resolved
          }
        }
        process.exit(0);
      }

      if (ast) {
        try {
          await runAstMode({ query, file, lines, format, lang, plugin });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(`Error: ${msg}\n`);
          process.exit(2);
        }
        return;
      }

      if (validate) {
        if (!queries?.length) {
          process.stderr.write("Error: --validate requires a query\n");
          process.exit(2);
        }
        try {
          for (const pkg of plugin ?? []) {
            const mod = await import(pkg) as { register?: (r: typeof defaultRegistry) => void; default?: { register?: (r: typeof defaultRegistry) => void } };
            const reg = mod.register ?? mod.default?.register;
            if (typeof reg !== "function") {
              throw new Error(`Plugin "${pkg}" does not export a register() function`);
            }
            reg(defaultRegistry);
          }

          const multiQuery = queries.length > 1;

          if (lang) {
            const backend = defaultRegistry.getByLangId(lang);
            if (!backend) {
              const available = defaultRegistry.allBackends.map((b) => b.langId).join(", ");
              throw new Error(`Unknown language "${lang}". Available: ${available}`);
            }
            if (!multiQuery) {
              await backend.validateSelector(queries[0]);
              const isJs = backend.langId === "js";
              if (format === "json") {
                const out: Record<string, unknown> = { valid: true, lang: backend.langId };
                if (isJs) out.explanation = explainSelector(queries[0]);
                process.stdout.write(JSON.stringify(out) + "\n");
              } else {
                process.stdout.write(`Query syntax is valid (${backend.name}).\n`);
                if (isJs) process.stdout.write(`  Matches: ${explainSelector(queries[0])}\n`);
              }
              process.exit(0);
            }
            // multi-query with --lang
            const isJs = backend.langId === "js";
            const queryResults: Array<{ query: string; valid: boolean; explanation?: string; error?: string }> = [];
            for (const q of queries) {
              try {
                await backend.validateSelector(q);
                queryResults.push({ query: q, valid: true, ...(isJs ? { explanation: explainSelector(q) } : {}) });
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                queryResults.push({ query: q, valid: false, error: msg });
              }
            }
            const allValid = queryResults.every((r) => r.valid);
            if (format === "json") {
              process.stdout.write(JSON.stringify({ valid: allValid, lang: backend.langId, queries: queryResults }, null, 2) + "\n");
            } else {
              for (const r of queryResults) {
                if (r.valid) {
                  process.stdout.write(`[${backend.langId}] "${r.query}" is valid.\n`);
                  if (r.explanation) process.stdout.write(`  Matches: ${r.explanation}\n`);
                } else {
                  process.stdout.write(`[${backend.langId}] "${r.query}" is invalid: ${r.error}\n`);
                }
              }
            }
            process.exit(allValid ? 0 : 2);
          }

          if (!multiQuery) {
            // Single query, all backends — original behavior
            const validateResults: Array<{ langId: string; name: string; valid: boolean; explanation?: string; error?: string }> = [];
            for (const backend of defaultRegistry.allBackends) {
              try {
                await backend.validateSelector(queries[0]);
                const explanation = backend.langId === "js" ? explainSelector(queries[0]) : undefined;
                validateResults.push({ langId: backend.langId, name: backend.name, valid: true, ...(explanation ? { explanation } : {}) });
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                validateResults.push({ langId: backend.langId, name: backend.name, valid: false, error: msg });
              }
            }
            const allValid = validateResults.every((r) => r.valid);
            if (format === "json") {
              process.stdout.write(JSON.stringify({ valid: allValid, results: validateResults }, null, 2) + "\n");
            } else {
              for (const r of validateResults) {
                if (r.valid) {
                  process.stdout.write(`[${r.langId}] Query syntax is valid.\n`);
                  if (r.explanation) process.stdout.write(`  Matches: ${r.explanation}\n`);
                } else {
                  process.stdout.write(`[${r.langId}] Invalid query: ${r.error}\n`);
                }
              }
            }
            process.exit(allValid ? 0 : 2);
          }

          // Multi-query, all backends
          type LangResult = { langId: string; name: string; valid: boolean; explanation?: string; error?: string };
          type QueryResult = { query: string; valid: boolean; results: LangResult[] };
          const perQueryResults: QueryResult[] = [];
          for (const q of queries) {
            const langResults: LangResult[] = [];
            for (const backend of defaultRegistry.allBackends) {
              try {
                await backend.validateSelector(q);
                const explanation = backend.langId === "js" ? explainSelector(q) : undefined;
                langResults.push({ langId: backend.langId, name: backend.name, valid: true, ...(explanation ? { explanation } : {}) });
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                langResults.push({ langId: backend.langId, name: backend.name, valid: false, error: msg });
              }
            }
            perQueryResults.push({ query: q, valid: langResults.every((r) => r.valid), results: langResults });
          }
          const allValid = perQueryResults.every((r) => r.valid);
          if (format === "json") {
            process.stdout.write(JSON.stringify({ valid: allValid, queries: perQueryResults }, null, 2) + "\n");
          } else {
            for (const qr of perQueryResults) {
              for (const r of qr.results) {
                if (r.valid) {
                  process.stdout.write(`[${r.langId}] "${qr.query}" is valid.\n`);
                  if (r.explanation) process.stdout.write(`  Matches: ${r.explanation}\n`);
                } else {
                  process.stdout.write(`[${r.langId}] "${qr.query}" is invalid: ${r.error}\n`);
                }
              }
            }
          }
          process.exit(allValid ? 0 : 2);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(`Error: ${msg}\n`);
          process.exit(2);
        }
      }

      if (!queries?.length) {
        process.stderr.write("Error: query is required\n");
        process.exit(2);
      }

      try {
        // Load plugins before searching
        for (const pkg of plugin ?? []) {
          const mod = await import(pkg) as { register?: (r: typeof defaultRegistry) => void; default?: { register?: (r: typeof defaultRegistry) => void } };
          const reg = mod.register ?? mod.default?.register;
          if (typeof reg !== "function") {
            throw new Error(`Plugin "${pkg}" does not export a register() function`);
          }
          reg(defaultRegistry);
        }

        // Build a scoped registry if --lang is specified
        let registry = defaultRegistry;
        if (lang) {
          const backend = defaultRegistry.getByLangId(lang);
          if (!backend) {
            const available = defaultRegistry.allBackends.map((b) => b.langId).join(", ");
            throw new Error(`Unknown language "${lang}". Available: ${available}`);
          }
          const { LanguageRegistry } = await import("./registry.js");
          const scoped = new LanguageRegistry();
          scoped.register(backend);
          registry = scoped;
          // Always validate early when --lang restricts to a single backend
          for (const q of queries) {
            await backend.validateSelector(q);
          }
        }

        const startMs = Date.now();
        const { matches: rawMatches, filesSearched, truncated } = await searchRepoFull(queries, dir, registry, exclude, { showAst, limit });
        let matches = rawMatches;
        const wallMs = Date.now() - startMs;
        if (context > 0) matches = await enrichWithContext(matches, context);
        const meta: SearchMeta = {
          matchCount: matches.length,
          filesSearched,
          wallMs,
          queries,
          truncated,
        };
        const isTTY = process.stdout.isTTY ?? false;
        for (const line of formatMatches(matches, isTTY, format, meta)) {
          console.log(line);
        }
        process.exit(matches.length > 0 ? 0 : 1);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error: ${msg}\n`);
        process.exit(2);
      }
    },
  )
  .example([
    [
      '$0 \'ObjectMethod[key.name="setup"] this\'',
      "Vue: find setup() methods that use this",
    ],
    [
      "$0 'await' --format files",
      "list files containing await expressions",
    ],
    [
      "$0 'call[callee.name=\"myFn\"]' --dir src",
      "find all calls to myFn under src/",
    ],
    [
      "$0 'VariableDeclarator:has(call[callee.property.name=\"map\"]):not(:has(JSXAttribute[name.name=\"key\"]))' --format json",
      "React: .map() calls missing a key attribute, as JSON",
    ],
    [
      "$0 'FunctionDeclaration[async=true]' --format files | xargs prettier --write",
      "reformat all files containing async functions",
    ],
    [
      "$0 'fn' --dir src --plugin ast-search-python",
      "find all function definitions in Python files",
    ],
    [
      "$0 '(class_definition)' --lang python --plugin ast-search-python",
      "find all Python classes (tree-sitter S-expression syntax)",
    ],
  ])
  .version(VERSION)
  .alias("version", "V")
  .help();

export function runCli(): void {
  y.parse();
}

export { defaultRegistry } from "./registry.js";
export { explainSelector } from "./search.js";
export { enrichWithContext } from "./context.js";
