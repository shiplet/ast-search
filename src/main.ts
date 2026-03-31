#!/usr/bin/env node
import yargs from "yargs/yargs";
import { createRequire } from "module";
import { walkRepoFiles } from "./walk.js";
import { getAstFromPath } from "./file.js";
import { runQuery, validateSelector, Match } from "./search.js";
import { formatMatches, OutputFormat } from "./output.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export async function searchRepo(
  selector: string,
  dir: string,
): Promise<Match[]> {
  validateSelector(selector); // throws early on invalid selector syntax
  const results: Match[] = [];

  for await (const filePath of walkRepoFiles(dir)) {
    let file: Awaited<ReturnType<typeof getAstFromPath>>["file"] | undefined;
    try {
      const result = await getAstFromPath(filePath);
      file = result.file;
      const matches = runQuery(selector, result.ast, result.source, filePath);
      results.push(...matches);
    } catch {
      // skip unparseable files
    } finally {
      await file?.close();
    }
  }

  return results;
}

const y = yargs(process.argv.slice(2))
  .scriptName("ast-search")
  .usage("$0 <query> [--dir <path>] [--format <fmt>]")
  .command(
    "$0 <query>",
    "Search a repo for AST patterns using CSS selector syntax",
    (yargs) =>
      yargs
        .positional("query", {
          type: "string",
          describe: "esquery CSS selector string",
          demandOption: true,
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
        }),
    async (argv) => {
      const { query, dir, format } = argv as {
        query: string;
        dir: string;
        format: OutputFormat;
      };
      try {
        const matches = await searchRepo(query, dir);
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
  ])
  .version(version)
  .alias("version", "V")
  .help();

if (process.env.NODE_ENV !== "test") {
  y.parse();
}
