import { type Node } from "acorn";

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

export interface FNSearchProps {
  ast: Node;
  fn: string;
  e: string;
  m?: boolean;
  f: string;
}

export interface PropertySearchProps {
  ast: Node;
  p: string;
  e: string;
  f: string;
}

export function searchFnForExp({ ast, fn, e, m, f }: FNSearchProps) {
  if (m) {
    const functionLikeNodes = depthFirstSearchMultiple(
      ast,
      fn,
      searchForFunctionLike,
    );
    if (functionLikeNodes.size === 0) process.exit(0);

    const fileNames = new Set();
    for (const fNode of functionLikeNodes) {
      fileNames.add(searchForExp(fNode, e, f));
    }

    return Array.from(fileNames);
  } else {
    const fnNode = depthFirstSearch(ast, fn, searchForFunctionLike);
    if (!fnNode) process.exit(0);

    return [searchForExp(fnNode, e, f)];
  }
}

export function searchPropertyForExp({ ast, p, e, f }: PropertySearchProps) {
  const propNode = breadthFirstSearch(ast, p, searchForProperty);
  if (!propNode) process.exit(0);
  return searchForExp(propNode, e, f);
}

export function searchForExp(node, search, f) {
  if (breadthFirstSearch(node, search, searchForExpression)) return f;
}

export function breadthFirstSearch(ast, search, visitFn) {
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

export function depthFirstSearch(ast, search, visitFn) {
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

export function depthFirstSearchMultiple(ast, search, visitFn) {
  const dfsStack = [ast];
  const visitedNodes: Set<Node> = new Set();
  const foundNodes: Set<Node> = new Set();

  visitedNodes.add(dfsStack[0]);

  while (dfsStack.length > 0) {
    const currentNode = dfsStack.pop();

    const expNode = visitFn(currentNode, search);

    if (expNode) {
      foundNodes.add(expNode);
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

export function searchForExpression(node, exp) {
  if (node.type && node.type === exp) {
    return node;
  }

  visit(node);

  return null;
}

export function searchForProperty(node, prop) {
  if (node.type === NodeType.Property && node.key.name === prop) {
    return node;
  }

  visit(node);

  return null;
}

export function searchForFunctionLike(node, fn) {
  // method on an object
  if (node.type === NodeType.Property && node.method && node.key.name === fn) {
    return node;
  }

  // named variable assignment with standard or arrow expression
  else if (
    node.type === NodeType.VariableDeclarator &&
    (node.init?.type === NodeType.FunctionExpression ||
      node.init?.type === NodeType.ArrowFunctionExpression) &&
    node.id?.name === fn
  ) {
    return node;
  }

  // named fn declaration
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

export function visit(node) {
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

export function isNode(item) {
  return item?.constructor && item.constructor.name === "Node";
}

export function isArray(item) {
  return item?.constructor && item.constructor === Array;
}

export function isObject(item) {
  return item?.constructor && item.constructor === Object;
}
