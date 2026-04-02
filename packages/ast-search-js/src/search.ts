import esquery from "esquery";
import { VISITOR_KEYS } from "@babel/types";
import type { File, Node } from "@babel/types";
import type { Match } from "./types.js";
import { printMatchNode } from "./ast-print.js";

export type { Match };

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
  // Declaration & structure shorthands
  import: "ImportDeclaration",
  export: ":matches(ExportNamedDeclaration, ExportDefaultDeclaration, ExportAllDeclaration)",
  class: ":matches(ClassDeclaration, ClassExpression)",
  throw: "ThrowStatement",
  // Expression shorthands
  typeof: "UnaryExpression[operator=\"typeof\"]",
  destructure: ":matches(ObjectPattern, ArrayPattern)",
  decorator: "Decorator",
  jsx: ":matches(JSXElement, JSXFragment)",
};

// Expand shorthands to full Babel type names, but not inside quoted attribute
// values or regex literals (/pattern/flags).
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
    } else if (ch === '/') {
      // Preserve regex literal /pattern/flags as-is
      let j = i + 1;
      while (j < selector.length && selector[j] !== '/') {
        if (selector[j] === '\\') j++; // skip escaped char
        j++;
      }
      j++; // past closing /
      while (j < selector.length && /[gimsuy]/.test(selector[j])) j++;
      parts.push(selector.slice(i, j));
      i = j;
    } else {
      const nextSpecial = selector.slice(i).search(/['"/]/);
      const segment =
        nextSpecial === -1 ? selector.slice(i) : selector.slice(i, i + nextSpecial);
      parts.push(segment.replace(pattern, (m) => SHORTHANDS[m] ?? m));
      i = nextSpecial === -1 ? selector.length : i + nextSpecial;
    }
  }
  return parts.join("");
}

// Parse all [prop.path=/regex/flags] attribute matchers out of an expanded selector.
export function extractRegexCaptures(
  selector: string,
): Array<{ path: string; regex: RegExp }> {
  const results: Array<{ path: string; regex: RegExp }> = [];
  // Match [some.path=/pattern/flags] — path is dotted identifiers/digits
  const attrRe = /\[([\w.[\]]+)=(\/(?:[^/\\]|\\.)*\/[gimsuy]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(selector)) !== null) {
    const path = m[1];
    const regexLiteral = m[2];
    const lastSlash = regexLiteral.lastIndexOf('/');
    const pattern = regexLiteral.slice(1, lastSlash);
    const flags = regexLiteral.slice(lastSlash + 1);
    try {
      results.push({ path, regex: new RegExp(pattern, flags) });
    } catch {
      // Invalid regex — skip rather than crash; esquery will reject it too
    }
  }
  return results;
}

// Walk a dotted property path (e.g. "callee.property.name", "arguments.0.value")
// on an AST node and return the string value of the leaf, or undefined if not found.
export function resolvePath(node: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = node;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    const idx = Number(p);
    cur = Number.isNaN(idx)
      ? (cur as Record<string, unknown>)[p]
      : (cur as unknown[])[idx];
  }
  if (cur == null || typeof cur === 'object') return undefined;
  return String(cur);
}

function extractSource(source: string, node: Node): { first: string; full: string } {
  if (!source || node.start == null) return { first: "", full: "" };
  const text = source.slice(node.start, node.end ?? node.start);
  return { first: text.split("\n")[0].trim(), full: text };
}

export function validateSelector(selector: string): void {
  esquery.parse(expandShorthands(selector));
}

type Sel = ReturnType<typeof esquery.parse>;

function describeNode(s: Sel): string {
  switch (s.type) {
    case "identifier":
      return `\`${(s as any).value}\` nodes`;
    case "wildcard":
      return "any node";
    case "attribute": {
      const a = s as any;
      if (!a.operator || a.value === undefined) return `with \`${a.name}\` present`;
      if (a.value?.type === "regexp") return `where \`${a.name}\` matches ${a.value.value}`;
      const rawVal = a.value?.value ?? a.value;
      // Quote string values that look like identifiers; leave booleans/numbers bare
      const needsQuotes = typeof rawVal === "string"
        && rawVal !== "true" && rawVal !== "false"
        && rawVal !== "null" && rawVal !== "undefined"
        && isNaN(Number(rawVal));
      return `where \`${a.name}\` ${a.operator} ${needsQuotes ? `"${rawVal}"` : rawVal}`;
    }
    case "compound": {
      const sels: Sel[] = (s as any).selectors;
      // If leading selector is a type/identifier, use it as the subject and
      // append the rest as conditions without a redundant "and" connector.
      if (sels.length > 0 && (sels[0].type === "identifier" || sels[0].type === "wildcard")) {
        const [head, ...tail] = sels;
        const tailStr = tail.map(describeNode).join(" ");
        return tailStr ? `${describeNode(head)} ${tailStr}` : describeNode(head);
      }
      return sels.map(describeNode).join(" ");
    }
    case "descendant": {
      const b = s as any;
      return `${describeNode(b.left)} containing ${describeNode(b.right)}`;
    }
    case "child": {
      const b = s as any;
      return `${describeNode(b.left)} with direct child ${describeNode(b.right)}`;
    }
    case "sibling": {
      const b = s as any;
      return `${describeNode(b.left)} followed by sibling ${describeNode(b.right)}`;
    }
    case "adjacent": {
      const b = s as any;
      return `${describeNode(b.left)} immediately followed by ${describeNode(b.right)}`;
    }
    case "has":
      return `(containing ${(s as any).selectors.map(describeNode).join(" or ")})`;
    case "not":
      return `(excluding ${(s as any).selectors.map(describeNode).join(" or ")})`;
    case "matches":
      return `(${(s as any).selectors.map(describeNode).join(" or ")})`;
    case "class":
      return `any :${(s as any).name}`;
    default:
      return (s as any).type ?? "unknown";
  }
}

/**
 * Returns a plain-English description of what a selector matches.
 * Expands shorthands before parsing so the description reflects the
 * underlying node types, not shorthand aliases.
 */
export function explainSelector(selector: string): string {
  const ast = esquery.parse(expandShorthands(selector));
  return describeNode(ast);
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
  showAst = false,
): Match[] {
  const expanded = expandShorthands(selector);
  const regexCaptures = extractRegexCaptures(expanded);
  normalizeOptionalChaining(ast);
  // Cast to any: esquery expects estree.Node but Babel AST is structurally
  // compatible; VISITOR_KEYS ensures correct traversal of Babel-specific nodes.
  const nodes = esquery.query(ast as any, expanded, {
    visitorKeys: VISITOR_KEYS as Record<string, readonly string[]>,
  });

  return nodes.map((node) => {
    const captureMap: Record<string, string> = {};
    for (const { path, regex } of regexCaptures) {
      const val = resolvePath(node, path);
      if (val !== undefined && regex.test(val)) captureMap[path] = val;
    }
    const babelNode = node as unknown as Node;
    const { first, full } = extractSource(source, babelNode);
    return {
      file: filename,
      line: (node as any).loc?.start.line ?? 0,
      col: (node as any).loc?.start.column ?? 0,
      ...(babelNode.start != null ? { start: babelNode.start } : {}),
      ...(babelNode.end != null ? { end: babelNode.end } : {}),
      source: first,
      ...(full !== first ? { source_full: full } : {}),
      ...(showAst ? { astSubtree: printMatchNode(babelNode) } : {}),
      ...(Object.keys(captureMap).length > 0 ? { captures: captureMap } : {}),
    };
  });
}
