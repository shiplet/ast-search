import yargs from "yargs/yargs";
import { writeFile } from "node:fs/promises";
import { searchForExp } from "./search.js";
import { getAstFromPath } from "./file.js";

const expressions = [
  "ArrayExpression",
  "ArrowFunctionExpression",
  "AssignmentExpression",
  "AwaitExpression",
  "BinaryExpression",
  "CallExpression",
  "ChainExpression",
  "ConditionalExpression",
  "FunctionExpression",
  "ImportExpression",
  "LogicalExpression",
  "MemberExpression",
  "NewExpression",
  "ObjectExpression",
  "ParenthesizedExpression",
  "SequenceExpression",
  "TaggedTemplateExpression",
  "ThisExpression",
  "UnaryExpression",
  "UpdateExpression",
  "YieldExpression",
];

interface Arguments {
  [x: string]: unknown;
  filename: string;
  root: string;
  expression: string;
  debug?: boolean;
}

const y = yargs(process.argv.slice(2))
  .scriptName("ast-search")
  .usage("$0 <file> [<function> | <property>] <expression>")
  .options({
    filename: {
      alias: "f",
      type: "string",
      describe: "the file to search",
      demandOption: true,
    },
    root: {
      type: "string",
      describe: "the function body to search",
      demandOption: true,
    },
    expression: {
      alias: "e",
      describe: "the type of expression",
      choices: expressions,
      demandOption: true,
    },
    debug: {
      alias: "d",
      describe: "output the nodes",
    },
  })
  .help();

/**
 * Top-level main async function
 */
(async () => {
  const argv = await y.parse();
  const { filename, root, expression, debug } = argv as unknown as Arguments;
  const { ast, file } = await getAstFromPath(filename);

  if (debug) {
    await writeFile("./output.json", JSON.stringify(ast, null, 2));
    process.exit(0);
  }

  const found = searchForExp({ ast, root, expression, filename });
  found && console.log("✅", filename);

  await file.close();
})();
