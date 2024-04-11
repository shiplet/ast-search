import { type Node } from "acorn";

export const NodeType = {
  ArrowFunctionExpression: "ArrowFunctionExpression",
  AwaitExpression: "AwaitExpression",
  CallExpression: "CallExpression",
  ExportDefaultDeclaration: "ExportDefaultDeclaration",
  FunctionDeclaration: "FunctionDeclaration",
  FunctionExpression: "FunctionExpression",
  ObjectExpression: "ObjectExpression",
  Property: "Property",
  ThisExpression: "ThisExpression",
  VariableDeclarator: "VariableDeclarator",
};

interface SearchedNode extends Node {
  edges?: Array<SearchedNode>;
  method?: any;
  key?: any;
  init?: any;
  callee?: any;
  id?: any;
}

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

type VisitFn = (prop: string, node?: SearchedNode) => SearchedNode | undefined;

export function searchFnForExp({ ast, fn, e, m, f }: FNSearchProps) {
  if (m) {
    const functionLikeNodes = depthFirstSearchMultiple(
      ast,
      fn,
      searchForFunctionLike,
    );
    if (functionLikeNodes.size === 0) return;

    const fileNames = new Set();
    for (const fNode of functionLikeNodes) {
      fileNames.add(searchForExp(fNode, e, f));
    }

    return Array.from(fileNames);
  } else {
    const fnNode = depthFirstSearch(ast, fn, searchForFunctionLike);
    if (!fnNode) return;

    return [searchForExp(fnNode, e, f)];
  }
}

export function searchPropertyForExp({ ast, p, e, f }: PropertySearchProps) {
  const propNode = breadthFirstSearch(ast, p, searchForProperty);
  if (!propNode) process.exit(0);
  return searchForExp(propNode, e, f);
}

export function searchForExp(node: SearchedNode, search: string, f: string) {
  if (breadthFirstSearch(node, search, searchForExpression)) return f;
}

export function breadthFirstSearch(
  ast: SearchedNode,
  search: string,
  visitFn: VisitFn,
) {
  const bfsQueue = [ast];
  const visitedNodes = new Set();

  visitedNodes.add(bfsQueue[0]);

  while (bfsQueue.length > 0) {
    const currentNode = bfsQueue.pop();

    const fnNode = visitFn(search, currentNode);

    if (fnNode) {
      return fnNode;
    }

    currentNode?.edges &&
      currentNode?.edges.forEach((childNode) => {
        if (!visitedNodes.has(childNode)) {
          bfsQueue.unshift(childNode);
          visitedNodes.add(childNode);
        }
      });
  }

  return null;
}

export function depthFirstSearch(
  ast: SearchedNode,
  search: string,
  visitFn: VisitFn,
) {
  const dfsStack = [ast];
  const visitedNodes = new Set();

  visitedNodes.add(dfsStack[0]);

  while (dfsStack.length > 0) {
    const currentNode = dfsStack.pop();

    const expNode = visitFn(search, currentNode);

    if (expNode) {
      return expNode;
    }

    currentNode?.edges &&
      currentNode?.edges.forEach((childNode) => {
        if (!visitedNodes.has(childNode)) {
          dfsStack.push(childNode);
          visitedNodes.add(childNode);
        }
      });
  }

  return null;
}

export function depthFirstSearchMultiple(ast: SearchedNode, search, visitFn) {
  const dfsStack = [ast];
  const visitedNodes: Set<SearchedNode> = new Set();
  const foundNodes: Set<SearchedNode> = new Set();

  visitedNodes.add(dfsStack[0]);

  while (dfsStack.length > 0) {
    const currentNode = dfsStack.pop();

    const expNode = visitFn(search, currentNode);

    if (expNode) {
      foundNodes.add(expNode);
    }

    currentNode?.edges &&
      currentNode.edges.forEach((childNode) => {
        if (!visitedNodes.has(childNode)) {
          dfsStack.push(childNode);
          visitedNodes.add(childNode);
        }
      });
  }

  return foundNodes;
}

export function searchForExpression(exp: string, node?: SearchedNode) {
  if (node && node.type && node.type === exp) {
    return node;
  }

  visit(node);
}

export function searchForProperty(prop: string, node?: SearchedNode) {
  if (node && node.type === NodeType.Property && node.key.name === prop) {
    return node;
  }

  visit(node);
}

export function searchForFunctionLike(fn: string, node?: SearchedNode) {
  if (node) {
    if (
      node.type === NodeType.Property &&
      node.method &&
      node.key.name === fn
    ) {
      // method on an object
      return node;
    } else if (
      node.type === NodeType.VariableDeclarator &&
      (node.init?.type === NodeType.FunctionExpression ||
        node.init?.type === NodeType.ArrowFunctionExpression) &&
      node.id?.name === fn
    ) {
      // named variable assignment with standard or arrow expression
      return node;
    } else if (
      node.type === NodeType.FunctionDeclaration &&
      node.id.name === fn
    ) {
      // named fn declaration
      return node;
    } else if (
      node.type === NodeType.CallExpression &&
      node.callee.name === fn
    ) {
      // inline arrow expressions
      return node;
    }
  }

  visit(node);
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
