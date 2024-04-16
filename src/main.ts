import yargs from "yargs/yargs";
import { writeFile } from "node:fs/promises";
import { searchFnForExp, searchPropertyForExp } from "./search.js";
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
  f: string;
  fn?: string;
  p?: string;
  e: string;
  m?: boolean;
  d?: boolean;
}

const y = yargs(process.argv.slice(2))
  .scriptName("ast-search")
  .usage("$0 <file> [<function> | <property>] <expression>")
  .options({
    file: {
      alias: "f",
      type: "string",
      describe: "the file to search",
      demandOption: true,
    },
    fn: {
      type: "string",
      describe: "the function body to search",
    },
    property: {
      alias: "p",
      type: "string",
      describe: "the property to search",
    },
    expression: {
      alias: "e",
      describe: "the type of expression",
      choices: expressions,
      demandOption: true,
    },
    multiple: {
      alias: "m",
      type: "boolean",
      describe: "the type of multiple expressions",
    },
    debug: {
      alias: "d",
      describe: "output the nodes",
    },
  })
  .check((argv) => {
    if ((argv.fn && !argv.p) || (!argv.fv && argv.p)) {
      return true;
    } else if (argv.fn && argv.p) {
      console.error(
        "can only search within either a function or a property, but not both",
      );
      process.exit(1);
    } else {
      console.error("must provide either a function or a property to search");
      process.exit(1);
    }
  })
  .help();

/**
 * Top-level main async function
 */
(async () => {
  const argv = await y.parse();
  const { f, fn, e, d, p, m } = argv as unknown as Arguments;
  const { ast, file } = await getAstFromPath(f);

  if (d) {
    await writeFile("./output.json", JSON.stringify(ast, null, 2));
    process.exit(0);
  }

  if (fn) {
    const found = searchFnForExp({ ast, fn, e, m, f });
    found?.forEach((v) => v && console.log("✅", v));
  }
  if (p) {
    searchPropertyForExp({ ast, p, e, f });
  }

  await file.close();
})();
