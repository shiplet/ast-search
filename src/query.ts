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
  "import()": "ImportExpression",
  assign: "AssignmentExpression",
  binary: "BinaryExpression",
  logical: "LogicalExpression",
  spread: "SpreadElement",
};

export type Predicate = { negated: boolean; babelType: string };
export type ExprClause = Predicate[][];
export type ScopeQuery = { kind: "scope"; scope: string; expr: ExprClause };
export type BareExpr = { kind: "bare-expr"; expr: ExprClause };
export type BareIdent = { kind: "bare-ident"; name: string };
export type Query = ScopeQuery | BareExpr | BareIdent;

function resolveAtom(token: string): string {
  if (token in SHORTHANDS) return SHORTHANDS[token];
  if (/^[A-Z]/.test(token)) return token;
  throw new Error(`Unknown expression atom: '${token}'`);
}

function parsePredicate(s: string): Predicate {
  const negated = s.startsWith("!");
  const atomStr = negated ? s.slice(1) : s;
  const babelType = resolveAtom(atomStr);
  return { negated, babelType };
}

function parseExprClause(s: string): ExprClause {
  return s.split(" || ").map((andPart) =>
    andPart.split(" && ").map((t) => parsePredicate(t))
  );
}

function isExprStart(token: string): boolean {
  const atom = token.startsWith("!") ? token.slice(1) : token;
  return atom in SHORTHANDS || /^[A-Z]/.test(atom);
}

export function parseQuery(query: string): Query {
  const trimmed = query.trim();
  if (!trimmed) throw new Error("Empty query");

  if (trimmed.includes(">")) {
    if (!/\s>\s/.test(trimmed)) {
      throw new Error("Whitespace required around '>'");
    }
    const gtIdx = trimmed.indexOf(" > ");
    const scopePart = trimmed.slice(0, gtIdx);
    const exprPart = trimmed.slice(gtIdx + 3);
    if (!exprPart) throw new Error("Empty expression after '>'");
    return { kind: "scope", scope: scopePart, expr: parseExprClause(exprPart) };
  }

  const firstToken = trimmed.split(/[\s&|]+/)[0];
  if (isExprStart(firstToken)) {
    return { kind: "bare-expr", expr: parseExprClause(trimmed) };
  }

  return { kind: "bare-ident", name: trimmed };
}
