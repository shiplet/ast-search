# Plan: ast-search DSL

## Steps

### 1. DSL Specification
Design and document the query language: syntax, grammar (EBNF), semantics, and worked examples covering all acceptance criteria.

**Demo:** A `DSL.md` spec document in the repo root that clearly defines the query language — grammar rules, shorthand aliases, worked examples, and the rationale behind each design choice. A human (or Builder) reading this doc can unambiguously implement or extend the parser.

**Wave:**
- `code-assist:ast-search-dsl:step-01:write-dsl-spec` — Analyze existing CLI patterns and write DSL.md: formal grammar, shorthand table, 8+ worked examples, and design rationale

---

### 2. DSL Parser
Implement a `parseQuery(query: string)` function that transforms a raw query string into a typed `Query` object. Cover all grammar forms from Step 1.

**Demo:** `parseQuery('setup > ThisExpression')` returns a structured object; `parseQuery('fn:useEffect(*)')` returns a call-match query; unit tests pass for all grammar forms.

**Wave:**
- `code-assist:ast-search-dsl:step-02:parser-core` — Implement `src/query.ts` with `parseQuery`, `Query` types, and full unit tests in `src/__tests__/query.test.ts`

---

### 3. Repo-Wide File Discovery
Implement `walkRepoFiles(dir: string): AsyncIterable<string>` that recursively yields all parseable JS/TS/Vue file paths, skipping `node_modules` and hidden directories.

**Demo:** Given a real directory (or memfs mock), the walker yields all `.js .ts .jsx .tsx .mjs .cjs .vue` files. Unit tests cover: deep recursion, node_modules exclusion, empty dir, mixed extensions.

**Wave:**
- `code-assist:ast-search-dsl:step-03:file-walker` — Implement `src/walk.ts` with `walkRepoFiles` and tests in `src/__tests__/walk.test.ts`

---

### 4. Expression Matching + Query Execution
Implement `searchForExpression` (currently commented out) and wire the DSL query into a `runQuery(query, ast): Match[]` function that returns located, line-annotated matches.

**Demo:** `runQuery(parseQuery('setup > ThisExpression'), ast)` returns `[{ line, col, text }]` for each match. Unit tests verify the scope→expression containment logic for the main query forms.

**Wave:**
- `code-assist:ast-search-dsl:step-04:expression-matcher` — Implement expression-containment search and `Match` type; unit tests for containment logic using fixture ASTs

---

### 5. CLI Wiring + Repo Traversal
Refactor `main.ts` to accept a bare query string (`ast-search '{QUERY}'`), walk the repo from CWD, parse each file, run the query, and stream results.

**Demo:** From repo root: `ast-search 'setup > ThisExpression'` prints matching file paths with line numbers. Old `-f/-r/-s` interface is removed or gracefully superseded.

**Wave:**
- `code-assist:ast-search-dsl:step-05:cli-wiring` — Refactor `main.ts` to accept bare query + run repo walk; integration test using real fixture files

---

### 6. Output Formatting
Implement line-level output with ANSI highlighting of matched characters and `file:line:col:` prefixes.

**Demo:** Output for a match looks like: `src/foo.ts:12:4: setup() { [this].foo }` with the matched token highlighted in color (or underlined). Works in pipe mode (no color when stdout is not a TTY).

**Wave:**
- `code-assist:ast-search-dsl:step-06:output-formatter` — Implement `src/output.ts` with ANSI highlight and TTY detection; tests cover color/no-color paths and the prefix format
