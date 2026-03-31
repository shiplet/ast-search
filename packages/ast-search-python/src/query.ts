import type { Match } from "ast-search/plugin";

// tree-sitter types (minimal surface we use, compatible with v0.21+)
interface TSNode {
  startPosition: { row: number; column: number };
  startIndex: number;
  endIndex: number;
  type: string;
}

interface TSCapture {
  node: TSNode;
  name: string;
}

interface TSQueryConstructor {
  new (language: unknown, pattern: string): TSQuery;
}

interface TSQuery {
  captures(node: TSNode): TSCapture[];
}

interface TSTree {
  rootNode: TSNode;
}

function assertValidPattern(pattern: string): void {
  const trimmed = pattern.trim();
  // A valid tree-sitter pattern must start with "(" (S-expression) or contain
  // "@" (capture). Bare words crash tree-sitter with a native SIGSEGV.
  if (!trimmed.startsWith("(") && !trimmed.includes("@")) {
    throw new Error(
      `Invalid tree-sitter query "${trimmed}": must start with "(" or include a "@capture". ` +
      `Use a shorthand (e.g. "fn", "call") or write a full S-expression (e.g. "(function_definition) @fn").`,
    );
  }
}

export function runTreeSitterQuery(
  ast: unknown,
  pattern: string,
  source: string,
  filePath: string,
  language: unknown,
  QueryClass: TSQueryConstructor,
): Match[] {
  assertValidPattern(pattern);
  const tree = ast as TSTree;
  const q = new QueryClass(language, pattern);
  const captures = q.captures(tree.rootNode);

  const seen = new Set<TSNode>();
  const results: Match[] = [];

  for (const capture of captures) {
    const node = capture.node;
    if (seen.has(node)) continue;
    seen.add(node);

    const text = source.slice(node.startIndex, node.endIndex);
    const firstLine = text.split("\n")[0].trimEnd();

    results.push({
      file: filePath,
      line: node.startPosition.row + 1, // 1-indexed to match JS backend
      col: node.startPosition.column,
      source: firstLine,
    });
  }

  return results;
}

export function validateTreeSitterQuery(
  pattern: string,
  language: unknown,
  QueryClass: TSQueryConstructor,
): void {
  try {
    assertValidPattern(pattern);
    new QueryClass(language, pattern);
  } catch (e) {
    throw new Error(
      `Invalid tree-sitter query: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
