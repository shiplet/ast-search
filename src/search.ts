import esquery from "esquery";
import { VISITOR_KEYS } from "@babel/types";
import type { File, Node } from "@babel/types";

export interface Match {
  file: string;
  line: number;
  col: number;
  source: string;
}

export const SHORTHANDS: Record<string, string> = {
  this: "ThisExpression",
  await: "AwaitExpression",
  yield: "YieldExpression",
  new: "NewExpression",
  call: "CallExpression",
  arrow: "ArrowFunctionExpression",
  fn: "FunctionExpression",
  member: "MemberExpression",
  ternary: "ConditionalExpression",
  template: "TemplateLiteral",
  tagged: "TaggedTemplateExpression",
  assign: "AssignmentExpression",
  binary: "BinaryExpression",
  logical: "LogicalExpression",
  spread: "SpreadElement",
};

// Expand shorthands to full Babel type names, but not inside quoted attribute values.
export function expandShorthands(selector: string): string {
  const keys = Object.keys(SHORTHANDS);
  const pattern = new RegExp(`\\b(${keys.join("|")})\\b`, "g");

  const parts: string[] = [];
  let i = 0;
  while (i < selector.length) {
    const ch = selector[i];
    if (ch === '"' || ch === "'") {
      // Preserve quoted string as-is
      let j = i + 1;
      while (j < selector.length && selector[j] !== ch) j++;
      parts.push(selector.slice(i, j + 1));
      i = j + 1;
    } else {
      const nextQuote = selector.slice(i).search(/['"]/);
      const segment =
        nextQuote === -1 ? selector.slice(i) : selector.slice(i, i + nextQuote);
      parts.push(segment.replace(pattern, (m) => SHORTHANDS[m] ?? m));
      i = nextQuote === -1 ? selector.length : i + nextQuote;
    }
  }
  return parts.join("");
}

function extractFirstLine(source: string, node: Node): string {
  if (!source || node.start == null) return "";
  const text = source.slice(node.start, node.end ?? node.start);
  return text.split("\n")[0].trim();
}

export function validateSelector(selector: string): void {
  esquery.parse(expandShorthands(selector));
}

// Normalize Babel's optional-chain node types so esquery selectors like
// CallExpression[callee.property.name="map"] transparently match optional
// chains (foo?.bar()). The `optional` flag is preserved, so callers can
// still narrow to optional-only with [optional=true] or [callee.optional=true].
export function normalizeOptionalChaining(node: any): void {
  if (!node || typeof node !== "object") return;
  // Capture visitor keys before renaming so we use the original type's keys.
  const keys = (VISITOR_KEYS as any)[node.type] ?? [];
  if (node.type === "OptionalCallExpression") node.type = "CallExpression";
  else if (node.type === "OptionalMemberExpression") node.type = "MemberExpression";
  for (const key of keys) {
    const child = node[key];
    if (Array.isArray(child)) child.forEach(normalizeOptionalChaining);
    else normalizeOptionalChaining(child);
  }
}

export function runQuery(
  selector: string,
  ast: File,
  source = "",
  filename = "",
): Match[] {
  const expanded = expandShorthands(selector);
  normalizeOptionalChaining(ast);
  // Cast to any: esquery expects estree.Node but Babel AST is structurally
  // compatible; VISITOR_KEYS ensures correct traversal of Babel-specific nodes.
  const nodes = esquery.query(ast as any, expanded, {
    visitorKeys: VISITOR_KEYS as Record<string, readonly string[]>,
  });

  return nodes.map((node) => ({
    file: filename,
    line: (node as any).loc?.start.line ?? 0,
    col: (node as any).loc?.start.column ?? 0,
    source: extractFirstLine(source, node as unknown as Node),
  }));
}
