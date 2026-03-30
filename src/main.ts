import yargs from "yargs/yargs";
import { walkRepoFiles } from "./walk.js";
import { getAstFromPath } from "./file.js";
import { parseQuery } from "./query.js";
import { runQuery, Match } from "./search.js";
import { formatMatches } from "./output.js";

export async function searchRepo(query: string, dir: string): Promise<Match[]> {
  const parsed = parseQuery(query);
  const results: Match[] = [];

  for await (const filePath of walkRepoFiles(dir)) {
    let file: Awaited<ReturnType<typeof getAstFromPath>>["file"] | undefined;
    try {
      const result = await getAstFromPath(filePath);
      file = result.file;
      const matches = runQuery(parsed, result.ast, filePath);
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
  .usage("$0 <query> [--dir <path>]")
  .command(
    "$0 <query>",
    "Search a repo for AST patterns",
    (yargs) =>
      yargs
        .positional("query", {
          type: "string",
          describe: "DSL query string",
          demandOption: true,
        })
        .option("dir", {
          alias: "d",
          type: "string",
          describe: "root directory to search",
          default: process.cwd(),
        }),
    async (argv) => {
      const { query, dir } = argv as { query: string; dir: string };
      try {
        const matches = await searchRepo(query, dir);
        const isTTY = process.stdout.isTTY ?? false;
        for (const line of formatMatches(matches, isTTY)) {
          console.log(line);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Error: ${msg}\n`);
        process.exit(1);
      }
    },
  )
  .help();

if (process.env.NODE_ENV !== "test") {
  y.parse();
}
