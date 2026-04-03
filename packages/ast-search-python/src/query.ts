import type { Match } from "ast-search-js/plugin";
import { printMatchTSNode } from "./ast-print.js";

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

interface TSMatch {
  pattern: number;
  captures: TSCapture[];
}

interface TSQuery {
  captures(node: TSNode): TSCapture[];
  matches(node: TSNode): TSMatch[];
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
  showAst = false,
): Match[] {
  assertValidPattern(pattern);
  const tree = ast as TSTree;
  // matches() only returns nodes that have a capture name (@something).
  // If the user wrote a bare S-expression like (function_definition), add @_
  // so results are returned.
  const queryPattern = pattern.includes("@") ? pattern : `${pattern} @_`;
  const q = (language as TSLanguage).query(queryPattern);

  // Use matches() instead of captures() so all captures from one pattern
  // application are grouped together — enabling multi-node capture output.
  const seen = new Set<string>();
  const results: Match[] = [];

  for (const match of q.matches(tree.rootNode)) {
    // Anchor on the first non-underscore capture (the primary match location).
    // @_ is the auto-appended anonymous marker; user captures like @fn, @msg
    // are the meaningful ones and also serve as the anchor.
    const anchor =
      match.captures.find((c) => !c.name.startsWith("_")) ??
      match.captures[0];
    if (!anchor) continue;

    const key = `${anchor.node.startIndex}:${anchor.node.endIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const text = source.slice(anchor.node.startIndex, anchor.node.endIndex);
    const firstLine = text.split("\n")[0].trimEnd();

    // Collect all named captures except the anonymous @_ marker.
    const captureMap: Record<string, string> = {};
    for (const cap of match.captures) {
      if (!cap.name.startsWith("_")) {
        captureMap[cap.name] = source.slice(cap.node.startIndex, cap.node.endIndex);
      }
    }

    results.push({
      file: filePath,
      line: anchor.node.startPosition.row + 1, // 1-indexed to match JS backend
      col: anchor.node.startPosition.column,
      start: anchor.node.startIndex,
      end: anchor.node.endIndex,
      offsetEncoding: "bytes" as const,
      source: firstLine,
      ...(text !== firstLine ? { source_full: text } : {}),
      ...(showAst ? { astSubtree: printMatchTSNode(anchor.node as any) } : {}),
      ...(Object.keys(captureMap).length > 0 ? { captures: captureMap } : {}),
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
