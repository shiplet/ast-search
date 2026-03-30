import {
  isStandardized,
  File,
  Node,
  isIdentifier,
  isScopable,
  isDeclaration,
  isVariableDeclarator,
} from "@babel/types";
import {
  getNodeBody,
  hasBodyBlockStatement,
  hasDeclarations,
  hasIdentifier,
  hasKeyedNode,
  hasProperties,
} from "./helpers/nodes.js";
import { type ExprClause, type Query } from "./query.js";

export interface SearchProps {
  ast: File;
  root: string;
  search: string;
  filename: string;
}

const BRANCH_TERMINUS = "└──";
const BRANCH = "├──";

export function searchForExp({
  ast,
  root,
  search,
  filename,
}: SearchProps): boolean {
  const possibleRootNodes = searchForRootNodes(root)(ast.program.body);
  const nodeContainsExpression: Set<Node> = new Set();

  if (possibleRootNodes.size > 0) {
    console.log("root nodes found: ");
    Array.from(possibleRootNodes).forEach((node, i) => {
      const prefix = possibleRootNodes.size - i > 1 ? BRANCH : BRANCH_TERMINUS;
      console.log(
        `${prefix} ✅ ${filename}:${node.loc?.start.line}:${node.loc?.start.column}`,
        root,
      );
      // nodeContainsExpression.add(searchForExpression(node, expression));
    });
  }

  return false;
}

export function searchForRootNodes(root: string) {
  const possibleRootNodes: Set<Node> = new Set();

  const checkKeyForRoot = (node: Node) => {
    if ("key" in node && node.key && node.key.type === "Identifier") {
      if (node.key.name === root) {
        possibleRootNodes.add(node);
      }
    }
  };

  const checkIdForRoot = (node: Node) => {
    if ("id" in node) {
      if (isIdentifier(node.id)) {
        if (node.id.name === root) possibleRootNodes.add(node);
      }
    }
  };

  const checkPossibleIdentifier = (node: Node) => {
    if (isIdentifier(node) && node.name === root) {
      possibleRootNodes.add(node);
    }
  };

  return function searchNodes(body: Node[]): Set<Node> {
    for (const node of body) {
      checkPossibleIdentifier(node);

      // check standard js items
      if (isStandardized(node)) {
        if (hasKeyedNode(node)) {
          checkKeyForRoot(node);
        }

        // check if it's an identifier
        if (hasIdentifier(node)) {
          checkIdForRoot(node);
        }

        // search searchable node bodies
        searchNodes(getNodeBody(node) as Node[]);
      }
    }

    return possibleRootNodes;
  };
}

export interface Match {
  file: string;
  line: number;
  col: number;
  text: string;
}

const SKIP_KEYS = new Set([
  "loc", "start", "end", "extra", "tokens",
  "comments", "innerComments", "leadingComments", "trailingComments",
]);

export function searchForExpression(node: Node, expr: ExprClause): boolean {
  return expr.some((andClause) =>
    andClause.every((pred) =>
      pred.negated ? node.type !== pred.babelType : node.type === pred.babelType,
    ),
  );
}

function walkAllNodes(node: Node, visitor: (n: Node) => void): void {
  visitor(node);
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const val = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(val)) {
      for (const child of val) {
        if (child && typeof child === "object" && "type" in child) {
          walkAllNodes(child as Node, visitor);
        }
      }
    } else if (val && typeof val === "object" && "type" in val) {
      walkAllNodes(val as Node, visitor);
    }
  }
}

export function runQuery(query: Query, ast: File, filename = ""): Match[] {
  const toMatch = (node: Node): Match => ({
    file: filename,
    line: node.loc?.start.line ?? 0,
    col: node.loc?.start.column ?? 0,
    text: node.type,
  });

  switch (query.kind) {
    case "bare-ident": {
      const nodes = searchForRootNodes(query.name)(ast.program.body);
      return Array.from(nodes).map(toMatch);
    }
    case "bare-expr": {
      const results: Match[] = [];
      for (const stmt of ast.program.body) {
        walkAllNodes(stmt as Node, (n) => {
          if (searchForExpression(n, query.expr)) results.push(toMatch(n));
        });
      }
      return results;
    }
    case "scope": {
      const rootNodes = searchForRootNodes(query.scope)(ast.program.body);
      const matches: Match[] = [];
      for (const rootNode of rootNodes) {
        walkAllNodes(rootNode, (n) => {
          if (n !== rootNode && searchForExpression(n, query.expr)) {
            matches.push(toMatch(n));
          }
        });
      }
      return matches;
    }
  }
}

// export function searchFnForExp({ ast, fn, e }: FNSearchProps): boolean {
//   const functionLikeNodes = depthFirstSearch(
//     ast.program.body,
//     fn,
//     searchForFunctionLike,
//   );
//
//   console.log("\nfunctionLikeNodes");
//   for (const node of functionLikeNodes) {
//     console.log(node.type);
//   }
//   if (functionLikeNodes.size === 0) return false;
//
//   // let instances = 0;
//   // for (const fnNode of functionLikeNodes) {
//   //   instances += searchForExp(fnNode, e) ? 1 : 0;
//   // }
//   // return instances > 0;
//   return false;
// }
//
// // export function searchPropertyForExp({ ast, p, e, f }: PropertySearchProps) {
// //   const propNode = breadthFirstSearch(ast, p, searchForProperty);
// //   if (!propNode) return;
// //   return searchForExp(propNode, e, f);
// // }
//
// export function searchForExp(node: SearchableStatement, search: string) {
//   if (breadthFirstSearch(node, search, searchForExpression)) return true;
//   return false;
// }
//
// export function breadthFirstSearch(
//   ast: SearchableStatement,
//   search: string,
//   visitFn: VisitFn,
// ) {
//   const bfsQueue = [ast];
//   const visitedNodes = new Set();
//
//   visitedNodes.add(bfsQueue[0]);
//
//   while (bfsQueue.length > 0) {
//     const currentNode = bfsQueue.pop();
//
//     const fnNode = visitFn(search, currentNode);
//
//     if (fnNode) {
//       return fnNode;
//     }
//
//     currentNode?.edges &&
//       currentNode?.edges.forEach((childNode) => {
//         if (!visitedNodes.has(childNode)) {
//           bfsQueue.unshift(childNode);
//           visitedNodes.add(childNode);
//         }
//       });
//   }
//
//   return null;
// }
//
// export function depthFirstSearch(ast: SearchableStatement[], search, visitFn) {
//   const dfsStack = ast;
//   const visitedNodes: Set<SearchableStatement> = new Set();
//   const foundNodes: Set<SearchableStatement> = new Set();
//
//   visitedNodes.add(dfsStack[0]);
//
//   while (dfsStack.length > 0) {
//     const currentNode = dfsStack.pop();
//
//     const expNode = visitFn(search, currentNode);
//
//     if (expNode) {
//       foundNodes.add(expNode);
//     }
//
//     currentNode?.edges &&
//       currentNode.edges.forEach((childNode) => {
//         if (!visitedNodes.has(childNode)) {
//           dfsStack.push(childNode);
//           visitedNodes.add(childNode);
//         }
//       });
//   }
//
//   return foundNodes;
// }
//
// export function searchForExpression(exp: string, node?: SearchableStatement) {
//   if (node && node.type && node.type === exp) {
//     return node;
//   }
//
//   visit(node);
// }
//
// // export function searchForProperty(prop: string, node?: SearchableStatement) {
// //   if (node && node.type === NodeType.Property && node.key.name === prop) {
// //     return node;
// //   }
// //
// //   visit(node);
// // }
//
// const functionLikes = [
//   "ArrowFunctionExpression",
//   "CallExpression",
//   "FunctionDeclaration",
//   "FunctionExpression",
//   "ObjectMethod",
// ];
//
// export function searchForFunctionLike(fn: string, node?: Node) {
//   if (node) {
//     switch (node.type) {
//       case "ArrowFunctionExpression":
//       case "CallExpression":
//       case "FunctionDeclaration":
//       case "FunctionExpression":
//       case "ObjectMethod":
//         return node;
//       case "VariableDeclaration":
//         return node.declarations.some((n) =>
//           functionLikes.includes(n.init?.type ?? ""),
//         )
//           ? node
//           : null;
//       case "VariableDeclarator":
//         if (
//           node.init?.type === "FunctionExpression" ||
//           node.init?.type === "ArrowFunctionExpression"
//         ) {
//           return node;
//         }
//         break;
//       case "ObjectProperty":
//         if (
//           node.value.type === "FunctionExpression" ||
//           node.value.type === "ArrowFunctionExpression"
//         ) {
//           return node;
//         }
//         break;
//       default:
//         break;
//     }
//
//     visit(node);
//     //
//     //
//     // if (
//     //   node.type === NodeType.Property &&
//     //   node.method &&
//     //   node.key.name === fn
//     // ) {
//     //   // method on an object
//     //   return node;
//     // } else if (
//     //   node.type === NodeType.VariableDeclarator &&
//     //   (node.init?.type === NodeType.FunctionExpression ||
//     //     node.init?.type === NodeType.ArrowFunctionExpression) &&
//     //   node.id?.name === fn
//     // ) {
//     //   // named variable assignment with standard or arrow expression
//     //   return node;
//     // } else if (
//     //   node.type === NodeType.FunctionDeclaration &&
//     //   node.id.name === fn
//     // ) {
//     //   // named fn declaration
//     //   return node;
//     // } else if (
//     //   node.type === NodeType.CallExpression &&
//     //   node.callee.name === fn
//     // ) {
//     //   // inline arrow expressions
//     //   return node;
//     // }
//   }
// }
//
// export function visit(node) {
//   if (isNode(node)) {
//     node.edges = [];
//     for (const prop of Object.keys(node)) {
//       console.log(prop);
//       if (prop !== "edges") {
//         if (isArray(node[prop])) {
//           node.edges.push(...node[prop]);
//         }
//         if (isNode(node[prop])) {
//           node.edges.push(node[prop]);
//         }
//       }
//     }
//   }
//
//   // These may never actually get used
//   // if (isObject(node)) {
//   //   console.log(node);
//   //   node.edges = [];
//   //   for (const prop of node) {
//   //     if (prop !== "edges") {
//   //       if (isArray(node[prop])) {
//   //         node.edges.push(...node[prop]);
//   //       }
//   //       if (isNode(node[prop])) {
//   //         node.edges.push(node[prop]);
//   //       }
//   //     }
//   //   }
//   // }
//   //
//   // if (isArray(node)) {
//   //   for (const prop in node) {
//   //     if (prop !== "edges") {
//   //       if (isNode(node[prop])) {
//   //         console.log(node[prop]);
//   //       }
//   //     }
//   //   }
//   // }
// }
//
export function isNode(item: Node) {
  return item?.constructor && item.constructor.name === "Node";
}
//
export function isArray(item) {
  return item?.constructor && item.constructor === Array;
}
//
// // This was only used in the above isObject check,
// // make sure it's not actually needed before deleting
// // export function isObject(item) {
// //   return item?.constructor && item.constructor === Object;
// // }
