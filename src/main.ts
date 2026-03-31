#!/usr/bin/env node
import yargs from "yargs/yargs";
import { walkRepoFiles } from "./walk.js";
import { getAstFromPath } from "./file.js";
import { runQuery, validateSelector, Match } from "./search.js";
import { formatMatches, OutputFormat } from "./output.js";

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
  .help();

if (process.env.NODE_ENV !== "test") {
  y.parse();
}
