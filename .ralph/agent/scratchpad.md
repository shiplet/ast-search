# Scratchpad: ast-search DSL

## 2026-03-30 — Planner re-activation after loop failure

### State assessment

Previous loop ran 5 iterations and failed. Picking up from:

- **Step 1 (DSL.md)** — CLOSED. `DSL.md` at repo root is complete: EBNF grammar, 16-entry
  shorthand table, 11 worked examples, semantics, design rationale.

- **Step 2 (parseQuery)** — IN_PROGRESS (task-1774906257-12bc). `src/query.ts` does NOT exist
  yet. `src/__tests__/query.test.ts` already exists with comprehensive coverage: bare-ident,
  bare-expr (shorthand + PascalCase), negation, &&/||, scope queries, parse errors, type
  narrowing. The Builder needs to implement `src/query.ts` to make these tests pass.

### What query.ts must export

```ts
export const SHORTHANDS: Record<string, string>  // 16 entries per DSL.md
export type Predicate = { negated: boolean; babelType: string }
export type ExprClause = Predicate[][]            // outer = OR, inner = AND
export type ScopeQuery = { kind: "scope"; scope: string; expr: ExprClause }
export type BareExpr   = { kind: "bare-expr"; expr: ExprClause }
export type BareIdent  = { kind: "bare-ident"; name: string }
export type Query      = ScopeQuery | BareExpr | BareIdent
export function parseQuery(query: string): Query
```

Key disambiguation rule: if the first token is a known shorthand OR starts with uppercase
(PascalCase Babel type), treat as bare-expr. Otherwise bare-ident.
`>` requires whitespace on both sides — no whitespace = parse error.
Unknown token in expression position (RHS of `>`) = parse error.

### Plan state
Step 3 (file walker), Step 4 (expression matcher), Step 5 (CLI wiring), Step 6 (output
formatter) are all defined in plan.md but not yet started. Proceed sequentially.

## 2026-03-30 — Step 4 complete: expression-containment search

Implemented in `src/search.ts`:
- `Match` interface: `{ file, line, col, text }`
- `searchForExpression(node, ExprClause): boolean` — OR of AND-clauses of Predicates with negation
- `walkAllNodes(node, visitor)` — full DFS over all AST children, skipping non-node fields
- `runQuery(query, ast, filename=""): Match[]` — dispatches on query kind:
  - BareIdent: delegates to `searchForRootNodes`, maps nodes to Match
  - BareExpr: walks entire program body, collects nodes matching ExprClause
  - ScopeQuery: finds root nodes by name, walks each root's subtree for ExprClause matches

Added 10 new tests in `search.test.ts`. All 90 tests pass, tsc clean.

## 2026-03-30 — Step 5 complete: CLI wiring + repo walk integration

Refactored `src/main.ts`:
- Removed old `-f/-r/-s` interface
- New CLI: `ast-search '<query>' [--dir <path>]` (dir defaults to cwd)
- Exported `searchRepo(query, dir): Promise<Match[]>` for testability
- Wires `walkRepoFiles` → `getAstFromPath` → `parseQuery` → `runQuery`
- Skips unparseable files via try/catch
- Guards `y.parse()` with `NODE_ENV !== 'test'` to avoid Jest interference

Added `src/__tests__/main.test.ts` with 7 integration tests.
All 97 tests pass, tsc clean.

## 2026-03-30 — Critic review of step-05 cli-wiring

**REJECTED** — two concrete issues:

1. Parse errors throw unhandled rejection → full stack trace in output. The yargs
   async command handler doesn't catch `parseQuery` errors, so the process logs
   both the yargs help AND the raw exception with stack. Fix: wrap `searchRepo`
   call in try/catch, print `Error: <message>` and call `process.exit(1)`.

2. All `debug:*` npm scripts are broken — they use the old `-f/-r/-s` interface
   that was removed in this step. `package.json` scripts still pass e.g.
   `-f src/... -r arrowFunction -s ThisExpression`. Must be updated to new
   `'<query>' --dir` form, or removed if no longer needed.
