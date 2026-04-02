import { VISITOR_KEYS } from "@babel/types";
import type { File, Node } from "@babel/types";

const SKIP_ALWAYS = new Set([
  "start", "end", "loc", "extra",
  "innerComments", "leadingComments", "trailingComments",
  "tokens", "errors",
]);

const JSON_STRIP = new Set([
  "start", "end", "loc", "tokens", "errors",
  "innerComments", "leadingComments", "trailingComments",
  "extra",
]);

function isNode(val: unknown): val is Node {
  return (
    typeof val === "object" &&
    val !== null &&
    typeof (val as Record<string, unknown>).type === "string"
  );
}

function printNode(node: Node, out: string[], indent: string, propLabel?: string): void {
  const childKeys = new Set(
    (VISITOR_KEYS as Record<string, readonly string[]>)[node.type] ?? [],
  );

  const nodeObj = node as unknown as Record<string, unknown>;
  const inline: string[] = [];
  for (const key of Object.keys(node)) {
    if (key === "type" || SKIP_ALWAYS.has(key) || childKeys.has(key)) continue;
    const val = nodeObj[key];
    if (val === null || val === undefined) continue;
    if (typeof val === "string") {
      inline.push(`${key}="${val}"`);
    } else if (typeof val === "number" || typeof val === "boolean") {
      inline.push(`${key}=${val}`);
    }
  }

  const label = propLabel ? `${propLabel}: ${node.type}` : node.type;
  const suffix = inline.length > 0 ? ` [${inline.join(" ")}]` : "";
  out.push(`${indent}${label}${suffix}`);

  for (const key of childKeys) {
    const child = nodeObj[key];
    if (child === null || child === undefined) continue;
    if (Array.isArray(child)) {
      (child as unknown[]).forEach((item, i) => {
        if (isNode(item)) {
          printNode(item, out, indent + "  ", `${key}[${i}]`);
        }
      });
    } else if (isNode(child)) {
      printNode(child, out, indent + "  ", key);
    }
  }
}

export function printAstText(ast: File): string {
  const out: string[] = [];
  for (const node of ast.program?.body ?? []) {
    printNode(node, out, "", undefined);
  }
  return out.join("\n");
}

export function printAstJson(ast: File): string {
  const body = ast.program?.body ?? [];
  const root = body.length === 1 ? body[0] : body;
  return JSON.stringify(
    root,
    (key, val) => (JSON_STRIP.has(key) ? undefined : val),
    2,
  );
}
