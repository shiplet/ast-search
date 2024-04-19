import { File, Identifier, Node } from "@babel/types";

export const NodeType = {
  ArrowFunctionExpression: "ArrowFunctionExpression",
  AwaitExpression: "AwaitExpression",
  CallExpression: "CallExpression",
  ExportDefaultDeclaration: "ExportDefaultDeclaration",
  FunctionDeclaration: "FunctionDeclaration",
  FunctionExpression: "FunctionExpression",
  ObjectExpression: "ObjectExpression",
  ObjectProperty: "ObjectProperty",
  Property: "Property",
  ThisExpression: "ThisExpression",
  VariableDeclarator: "VariableDeclarator",
};

export type SearchableNode = Node & {
  edges?: Array<SearchableNode>;
  id?: Identifier;
  key?: Identifier;
  name?: string;
};

export interface SearchProps {
  ast: File;
  root: string;
  expression: string;
}

export function searchForExp({ ast, root, expression }: SearchProps): boolean {
  const possibleRootNodes = searchForRootNodes(root)(
    ast.program.body as unknown as SearchableNode[],
  );
  console.log("possibleRootNodes");
  for (const node of possibleRootNodes) {
    console.log(
      node.key?.name ?? node.id?.name ?? root,
      `${node.loc?.start.line}:${node.loc?.start.column}`,
    );
  }
  return false;
}

export function searchForRootNodes(root: string) {
  const possibleRootNodes: Set<SearchableNode> = new Set();

  const checkKeyForRoot = (node: SearchableNode) => {
    if (node.key && node.key.type === "Identifier") {
      if (node.key.name === root) {
        possibleRootNodes.add(node);
      }
    }
  };

  const checkIdForRoot = (node: SearchableNode) => {
    if (node.id && node.id.name === root) {
      possibleRootNodes.add(node);
    }
  };

  const checkPossibleIdentifier = (node: SearchableNode) => {
    if (node.name && node.name === root) {
      possibleRootNodes.add(node);
    }
  };

  return function innerRootNodeSearch(
    body: SearchableNode[],
  ): Set<SearchableNode> {
    for (const node of body) {
      checkPossibleIdentifier(node);
      switch (node.type) {
        case "ObjectExpression":
        case "ObjectPattern":
          innerRootNodeSearch(node.properties as unknown as SearchableNode[]);
          break;
        case "VariableDeclaration":
          innerRootNodeSearch(node.declarations as unknown as SearchableNode[]);
          break;
        case "VariableDeclarator":
          checkIdForRoot(node);
          if (node.init && "properties" in node.init) {
            innerRootNodeSearch(
              node.init.properties as unknown as SearchableNode[],
            );
          }
          break;
        case "ObjectProperty":
        case "ClassProperty":
          checkKeyForRoot(node);
          innerRootNodeSearch([node.value as unknown as SearchableNode]);
          break;
        case "ObjectMethod":
        case "ClassMethod":
          checkKeyForRoot(node);
          if (node.body && node.body.type === "BlockStatement") {
            innerRootNodeSearch(node.body.body as unknown as SearchableNode[]);
          }
          break;
        case "FunctionExpression":
        case "ArrowFunctionExpression":
          checkIdForRoot(node);
          if (node.body && node.body) {
            innerRootNodeSearch([node.body] as unknown as SearchableNode[]);
          }
          break;
        case "ExpressionStatement":
          innerRootNodeSearch([node.expression] as unknown as SearchableNode[]);
          break;
        case "ReturnStatement":
          innerRootNodeSearch([node.argument] as unknown as SearchableNode[]);
          break;
        case "MemberExpression":
          innerRootNodeSearch([
            node.property,
            node.object,
          ] as unknown as SearchableNode[]);
          break;
        default:
          checkIdForRoot(node);
          Object.keys(node).forEach((p) => {
            if (isNode(node[p])) {
              innerRootNodeSearch([node[p]]);
            }
            if (isArray(node[p])) {
              innerRootNodeSearch(node[p]);
            }
          });

          break;
      }
    }

    return possibleRootNodes;
  };
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
