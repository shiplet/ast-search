import type { Match } from "ast-search-js/plugin";

// web-tree-sitter types (minimal surface we use)
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

interface TSQuery {
  captures(node: TSNode): TSCapture[];
}

interface TSLanguage {
  query(pattern: string): TSQuery;
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
): Match[] {
  assertValidPattern(pattern);
  const tree = ast as TSTree;
  // captures() only returns nodes that have a capture name (@something).
  // If the user wrote a bare S-expression like (function_definition), add @_
  // so results are returned.
  const queryPattern = pattern.includes("@") ? pattern : `${pattern} @_`;
  const q = (language as TSLanguage).query(queryPattern);
  const captures = q.captures(tree.rootNode);

  // web-tree-sitter may return different JS objects for the same node when
  // multiple capture names match it, so deduplicate by position instead of identity.
  const seen = new Set<string>();
  const results: Match[] = [];

  for (const capture of captures) {
    const node = capture.node;
    const key = `${node.startIndex}:${node.endIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);

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
): void {
  try {
    assertValidPattern(pattern);
    (language as TSLanguage).query(pattern);
  } catch (e) {
    throw new Error(
      `Invalid tree-sitter query: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
