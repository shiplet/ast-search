#! /usr/bin/env node

const yargs = require("yargs/yargs");
const { Parser } = require("acorn");
const { open, writeFile } = require("node:fs/promises");

const NodeType = {
  ArrowFunctionExpression: "ArrowFunctionExpression",
  CallExpression: "CallExpression",
  ExportDefaultDeclaration: "ExportDefaultDeclaration",
  FunctionDeclaration: "FunctionDeclaration",
  FunctionExpression: "FunctionExpression",
  ObjectExpression: "ObjectExpression",
  Property: "Property",
  VariableDeclarator: "VariableDeclarator",
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
  .option("property", {
    alias: "p",
    describe: "the property to search",
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
  .option('multiple', {
    alias: "m",
    describe: "search for multiple instances of function call in same file"
  })
  .demandOption(
    ["file", "exp"],
    "Please provide values for all three arguments: file, function, and search"
  )
  .check((argv) => {
    if ((argv.fn && !argv.p) || (!argv.fv && argv.p)) {
      return true;
    } else if (argv.fn && argv.p) {
      console.error(
        "can only search within either a function or a property, but not both"
      );
      process.exit(1);
    } else {
      console.error("must provide either a function or a property to search");
      process.exist(1);
    }
  })
  .help();

const { f, fn, e, d, p, m } = y.argv;

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

  if (d) {
    await writeFile("./output.json", JSON.stringify(ast, null, 2));
    process.exit(0);
  }

  if (fn) searchFnForExp(ast, fn, e, m);
  if (p) searchPropertyForExp(ast, p, e);

  await file.close();
})();

function searchFnForExp(ast, fn, e, m) {
  if (m) {
    const fNodes = depthFirstSearchMultiple(ast, fn, searchForFunctionLike)
    if (fNodes.length === 0) process.exit(0);

    const fileNames = new Set();
    for (const fNode of fNodes) {
      fileNames.add(searchForExpMultiple(fNode, e))
    }

    for (const fileName of fileNames) {
      fileName && console.log(fileName)
    }
  } else {
    const fnNode = depthFirstSearch(ast, fn, searchForFunctionLike);
    if (!fnNode) process.exit(0);

    searchForExp(fnNode, e);
  }

}

function searchPropertyForExp(ast, prop, e) {
  const propNode = breadthFirstSearch(ast, prop, searchForProperty);
  if (!propNode) process.exit(0);
  searchForExp(propNode, e);
}

function searchForExp(node, search) {
  if (breadthFirstSearch(node, search, searchForExpression)) console.log(f);
}

function searchForExpMultiple(node, search) {
  if (breadthFirstSearch(node, search, searchForExpression)) return f;
}

function breadthFirstSearch(ast, search, visitFn) {
  const bfsQueue = [ast];
  const visitedNodes = new Set();

  visitedNodes.add(bfsQueue[0]);

  while (bfsQueue.length > 0) {
    const currentNode = bfsQueue.pop();

    const fnNode = visitFn(currentNode, search);

    if (fnNode) {
      return fnNode;
    }

    currentNode.edges &&
      currentNode.edges.forEach((childNode) => {
        if (!visitedNodes.has(childNode)) {
          bfsQueue.unshift(childNode);
          visitedNodes.add(childNode);
        }
      });
  }

  return null;
}

function depthFirstSearch(ast, search, visitFn) {
  const dfsStack = [ast];
  const visitedNodes = new Set();

  visitedNodes.add(dfsStack[0]);

  while (dfsStack.length > 0) {
    const currentNode = dfsStack.pop();

    const expNode = visitFn(currentNode, search);

    if (expNode) {
      return expNode;
    }

    currentNode.edges &&
      currentNode.edges.forEach((childNode) => {
        if (!visitedNodes.has(childNode)) {
          dfsStack.push(childNode);
          visitedNodes.add(childNode);
        }
      });
  }

  return null;
}

function depthFirstSearchMultiple(ast, search, visitFn) {
  const dfsStack = [ast];
  const visitedNodes = new Set();
  const foundNodes = new Set();

  visitedNodes.add(dfsStack[0]);

  while (dfsStack.length > 0) {
    const currentNode = dfsStack.pop();

    const expNode = visitFn(currentNode, search);

    if (expNode) {
      foundNodes.add(expNode)
    }

    currentNode.edges &&
    currentNode.edges.forEach((childNode) => {
      if (!visitedNodes.has(childNode)) {
        dfsStack.push(childNode);
        visitedNodes.add(childNode);
      }
    });
  }

  return foundNodes;
}

function searchForExpression(node, exp) {
  if (node.type && node.type === exp) {
    return node;
  }

  visit(node);

  return null;
}

function searchForProperty(node, prop) {
  if (node.type === NodeType.Property && node.key.name === prop) {
    return node;
  }

  visit(node);

  return null;
}

function searchForFunctionLike(node, fn) {
  // method on an object
  if (node.type === NodeType.Property && node.method && node.key.name === fn) {
    return node;
  }

  // named variable assignment with standard or arrow expression
  else if (
    node.type === NodeType.VariableDeclarator &&
    (node.init.type === NodeType.FunctionExpression ||
      node.init.type === NodeType.ArrowFunctionExpression) &&
    node.id?.name === fn
  ) {
    return node;
  }

  // named function declaration
  else if (node.type === NodeType.FunctionDeclaration && node.id.name === fn) {
    return node;
  }

  // inline arrow expressions
  else if (node.type === NodeType.CallExpression && node.callee.name === fn) {
    return node;
  }

  visit(node);

  return null;
}

function visit(node) {
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
