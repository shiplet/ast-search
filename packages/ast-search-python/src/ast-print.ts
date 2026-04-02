// Extended tree-sitter node interface used by AST printing utilities
export interface TSNodeFull {
  type: string;
  isNamed: boolean;
  text: string;
  children: TSNodeFull[];
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  fieldNameForChild(index: number): string | null;
}

export function printTSNodeText(node: TSNodeFull, out: string[], indent: string, fieldName?: string): void {
  const label = fieldName ? `${fieldName}: ${node.type}` : node.type;
  const namedChildren = node.children.filter((c) => c.isNamed);
  if (namedChildren.length === 0) {
    const text = node.text.replace(/\n/g, "\\n");
    const suffix = text.length <= 60 ? ` [text="${text}"]` : "";
    out.push(`${indent}${label}${suffix}`);
  } else {
    out.push(`${indent}${label}`);
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (!child.isNamed) continue;
      const childField = node.fieldNameForChild(i) ?? undefined;
      printTSNodeText(child, out, indent + "  ", childField);
    }
  }
}

export function printMatchTSNode(node: TSNodeFull): string {
  const out: string[] = [];
  printTSNodeText(node, out, "", undefined);
  return out.join("\n");
}

export function serializeTSNode(node: TSNodeFull): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: node.type,
    isNamed: node.isNamed,
    start: node.startPosition,
    end: node.endPosition,
  };
  const namedChildren: Array<Record<string, unknown>> = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (!child.isNamed) continue;
    const fieldName = node.fieldNameForChild(i);
    const serialized = serializeTSNode(child);
    if (fieldName) serialized.field = fieldName;
    namedChildren.push(serialized);
  }
  if (namedChildren.length > 0) {
    result.children = namedChildren;
  } else {
    result.text = node.text;
  }
  return result;
}
