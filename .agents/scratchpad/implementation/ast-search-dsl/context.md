# Context: ast-search DSL

## Source Type
Rough description → normalized into plan.md steps.

## Original Request Summary
Design and implement an opinionated DSL for the ast-search query language. The CLI should accept `ast-search '{QUERY}'` at the root of a JS repo and output all files with matching instances. Line-level matches must include line numbers and highlight exact matched characters. Search must be exhaustive over all matching files in the repo.

## Current Implementation

### CLI Interface (main.ts)
- Three required flags: `-f <file>`, `-r <root>`, `-s <expression>`
- Single file only; no repo-wide traversal
- `-r` anchors by function/property name (e.g. `setup`)
- `-s` constrains to a Babel AST expression type from a fixed list of ~20 types
- The expression-matching half (`searchForExpression`) is **commented out** — currently only finds root nodes, never checks if they contain the target expression

### Search Engine (search.ts)
- `searchForRootNodes(root)(body)` — depth-first traversal, finds nodes matching by `key.name`, `id.name`, or identifier `name`
- Returns `Set<Node>` — found root nodes
- `searchForExp` wraps it but the expression checking step is a no-op (commented out)

### File Parsing (file.ts)
- Supports: `.js .ts .jsx .tsx .mjs .cjs` (passed directly to Babel) + `.vue` (extracts `<script>` block first)
- All files parsed with `@babel/parser` (plugins: jsx, typescript)
- Single file: `getAstFromPath(path)` → `{ ast, file }`

### Node Helpers (helpers/nodes.ts)
- Type predicates: `hasKeyedNode`, `hasIdentifier`, `hasBodyBlockStatement`, `hasDeclarations`, `hasProperties`
- `getNodeBody(node)` — normalizes Babel AST node shapes into `Node[]` for recursive traversal

## Integration Points
- `search.ts` exports `searchForExp`, `searchForRootNodes` — these are the hooks for DSL execution
- `file.ts` exports `getAstFromPath` — needs a parallel `walkRepoFiles(dir)` for repo-wide use
- `main.ts` uses yargs — CLI entry point to be refactored to accept a bare query string

## Acceptance Criteria
1. `ast-search '{QUERY}'` at repo root finds all matching files
2. Output includes line numbers as prefixes
3. Matched characters are highlighted (ANSI color)
4. Search is exhaustive (all `.js .ts .jsx .tsx .mjs .cjs .vue` files, recursing into subdirs, skipping `node_modules`)

## Constraints
- ESM project (`"type": "module"`), import paths use `.js` extensions
- Tests use `memfs` mocks; new tests should follow the same pattern
- Babel parser is already integrated — don't introduce a second parser
- The existing `searchForRootNodes` traversal is working; build on it rather than replacing it
- Backpressure law: `npm test` must pass after every task

## DSL Design Principles (to be formalized in Step 1)
- Inspired by CSS selectors — familiar to JS devs
- Terse — designed for the grep use case (one-liner queries)
- Opinionated — fewer options, clearer semantics
- Composable — basic forms work alone; advanced forms layer on top
