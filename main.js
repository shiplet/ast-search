#! /usr/bin/env node

const yargs = require("yargs/yargs");
const { Parser } = require("acorn");
const { open, writeFile } = require("node:fs/promises");

const NodeType = {
  ExportDefaultDeclaration: "ExportDefaultDeclaration",
  ObjectExpression: "ObjectExpression",
  ArrowFunctionExpression: "ArrowFunctionExpression",
};

const y = yargs(process.argv.slice(2))
  .scriptName("ast-search")
  .usage("$0 <file> <function> <search>")
  .option("file", {
    alias: "f",
    describe: "the file to search",
  })
  .option("function", {
    alias: "fn",
    describe: "the function body to search",
  })
  .option("exp", {
    alias: "e",
    describe: "the type of expression",
    choices: ["ThisExpression"],
  })
  .option("debug", {
    alias: "d",
    describe: "output the setup node",
  })
  .demandOption(
    ["file", "function", "exp"],
    "Please provide values for all three arguments: file, function, and search"
  )
  .help();

const { f, fn, e, d } = y.argv;

const fileContents = [];
let append = false;

(async () => {
  const file = await open(f);
  for await (const line of file.readLines()) {
    if (line === "<script>") {
      append = true;
      continue;
    }

    if (line === "</script>") {
      append = false;
      break;
    }

    if (append) {
      fileContents.push(line);
    }
  }

  const ast = Parser.parse(fileContents.join("\n"), {
    ecmaVersion: 2022,
    sourceType: "module",
  });

  let defaultNode = null;
  for (const node of ast.body) {
    if (node.type === NodeType.ExportDefaultDeclaration) {
      defaultNode = node;
    }
  }

  if (defaultNode.declaration.type !== NodeType.ObjectExpression) {
    console.error(
      `Unexpected non-object expression for default export, got ${defaultNode.declaration.type}`
    );
    process.exit(1);
  }

  let setupNode = null;
  for (const property of defaultNode.declaration.properties) {
    if (property.key.name === fn) {
      setupNode = property;
    }
  }

  if (setupNode === null) {
    console.error(`Unable to find the given property: ${fn}`);
    process.exit(1);
  }

  if (d) {
    await writeFile("./output.json", JSON.stringify(ast, null, 2));
  }

  searchNodes(setupNode, e);

  file.close();
})();

function searchNodes(node, exp) {
  const body = [...node.value.body.body];
  const bfsQueue = [...body];
  const visitedNodes = new Set();
  let found = false;

  visitedNodes.add(body[0]);

  while (bfsQueue.length > 0 && !found) {
    const currentNode = bfsQueue.pop();

    found = visit(currentNode, exp);

    currentNode.edges &&
      currentNode.edges.forEach((childNode) => {
        if (!visitedNodes.has(childNode)) {
          bfsQueue.unshift(childNode);
          visitedNodes.add(childNode);
        }
      });
  }

  if (found) {
    console.log(f);
  }
}

function visit(node, exp) {
  if (node.type === exp) {
    return true;
  }

  if (isNode(node)) {
    node.edges = [];
    for (const prop of Object.keys(node)) {
      if (prop !== "edges") {
        if (isArray(node[prop])) {
          node.edges.push(...node[prop]);
        }
        if (isNode(node[prop])) {
          node.edges.push(node[prop]);
        }
      }
    }
  }

  if (isObject(node)) {
    node.edges = [];
    for (const prop of node) {
      if (prop !== "edges") {
        if (isArray(node[prop])) {
          node.edges.push(...node[prop]);
        }
        if (isNode(node[prop])) {
          node.edges.push(node[prop]);
        }
      }
    }
  }

  if (isArray(node)) {
    for (const prop in node) {
      if (prop !== "edges") {
        if (isNode(node[prop])) {
          console.log(node[prop]);
        }
      }
    }
  }

  return false;
}

function isNode(item) {
  return item?.constructor && item.constructor.name === "Node";
}

function isArray(item) {
  return item?.constructor && item.constructor === Array;
}

function isObject(item) {
  return item?.constructor && item.constructor === Object;
}
