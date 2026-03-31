#!/usr/bin/env node
import yargs from "yargs/yargs";
import { readFile } from "node:fs/promises";
import { createRequire } from "module";
import { resolve, dirname } from "node:path";
import { walkRepoFiles } from "./walk.js";
import { parseFile } from "./file.js";
import type { Match } from "./types.js";
import { formatMatches, OutputFormat } from "./output.js";
import { defaultRegistry } from "./registry.js";
import { JSLanguageBackend } from "./backends/js/index.js";
import { VERSION } from "./version.js";


// Register built-in JS/TS/Vue backend
defaultRegistry.register(new JSLanguageBackend());

export async function searchRepo(
  selector: string,
  dir: string,
  registry = defaultRegistry,
): Promise<Match[]> {
  // Early validation when only one backend is registered (common JS-only case)
  if (registry.allBackends.length === 1) {
    await registry.allBackends[0].validateSelector(selector);
  }

  const results: Match[] = [];
  for await (const filePath of walkRepoFiles(dir, registry.allExtensions)) {
    try {
      const { ast, source, backend } = await parseFile(filePath, registry);
      const matches = await backend.query(ast, selector, source, filePath);
      results.push(...matches);
    } catch {
      // skip unparseable files / unsupported extensions
    }
  }

  return results;
}

const y = yargs(process.argv.slice(2))
  .scriptName("ast-search")
  .usage("$0 <query> [--dir <path>] [--format <fmt>]")
  .command(
    "$0 [query]",
    "Search a repo for AST patterns using CSS selector syntax",
    (yargs) =>
      yargs
        .positional("query", {
          type: "string",
          describe: "Query string (esquery CSS selector for JS/TS; tree-sitter S-expression for Python)",
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
          choices: ["text", "json", "files"],
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
        }),
    async (argv) => {
      const { query, dir, format, lang, plugin, agentHelp } = argv as {
        query?: string;
        dir: string;
        format: OutputFormat;
        lang?: string;
        plugin?: string[];
        agentHelp: boolean;
      };

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

      if (!query) {
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
          await backend.validateSelector(query);
        }

        const matches = await searchRepo(query, dir, registry);
        const isTTY = process.stdout.isTTY ?? false;
        for (const line of formatMatches(matches, isTTY, format)) {
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

if (process.env.NODE_ENV !== "test") {
  y.parse();
}
