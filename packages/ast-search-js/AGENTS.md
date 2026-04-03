# ast-search — Agent Reference

Use this tool to locate AST patterns across a codebase before making edits. It is most valuable when you need to find all call sites, detect anti-patterns at scale, or scope a refactor before touching files.

Language support is plugin-based. The core handles JS/TS/Vue. For Python support, see [ast-search-python](packages/ast-search-python/AGENTS.md).

---

## Invocation

```
ast-search <query> [query2 ...] [--dir <path>] [--format text|json|files] [--lang <id>] [--plugin <pkg>]
```

| Flag | Alias | Default | Description |
|------|-------|---------|-------------|
| `--dir` | `-d` | `cwd` | Root directory to search |
| `--format` | `-f` | `text` | Output format: `text`, `json`, `files`, or `count` |
| `--exclude` | `-x` | none | Glob pattern(s) to exclude from search (repeatable) |
| `--lang` | `-l` | all | Restrict to one language backend by `langId` (e.g. `js`, `python`) |
| `--plugin` | `-p` | none | Load a language plugin package (repeatable) |
| `--context` | `-C` | `0` | Show N lines of context around each match (like `grep -C`) |
| `--show-ast` | — | off | Print the AST subtree of each matched node below the match line; useful when writing or debugging queries |
| `--ast` | — | off | Print AST for a code snippet (positional arg) or `--file`; useful for writing queries |

**Exit codes:** `0` = matches found · `1` = no matches · `2` = error (invalid selector, etc.)

**Multi-query:** Pass multiple queries as positional arguments. Each file is parsed once and all queries run against its AST — eliminates redundant I/O when you need several patterns from the same codebase. In `--format json`, every match includes a `query` field. Exit code `0` if any query matches.

```bash
ast-search 'FunctionDeclaration[async=true]' 'ArrowFunctionExpression[async=true]' --format json
```

---

## JS/TS/Vue Query Syntax

Queries are [esquery](https://github.com/estools/esquery) CSS-style selectors over Babel AST node types.

### Shorthands (auto-expanded outside quoted strings)

| Shorthand | Expands to |
|-----------|-----------|
| `this` | `ThisExpression` |
| `await` | `AwaitExpression` |
| `yield` | `YieldExpression` |
| `new` | `NewExpression` |
| `call` | `CallExpression` |
| `arrow` | `ArrowFunctionExpression` |
| `fn` | `FunctionExpression` |
| `member` | `MemberExpression` |
| `ternary` | `ConditionalExpression` |
| `template` | `TemplateLiteral` |
| `tagged` | `TaggedTemplateExpression` |
| `assign` | `AssignmentExpression` |
| `binary` | `BinaryExpression` |
| `logical` | `LogicalExpression` |
| `spread` | `SpreadElement` |
| `import` | `ImportDeclaration` |
| `export` | `:matches(ExportNamedDeclaration, ExportDefaultDeclaration, ExportAllDeclaration)` |
| `class` | `:matches(ClassDeclaration, ClassExpression)` |
| `throw` | `ThrowStatement` |
| `typeof` | `UnaryExpression[operator="typeof"]` |
| `destructure` | `:matches(ObjectPattern, ArrayPattern)` |
| `decorator` | `Decorator` |
| `jsx` | `:matches(JSXElement, JSXFragment)` |

Shorthands are **not** expanded inside quoted attribute values: `call[callee.name="new"]` keeps `"new"` literal.

### Selector patterns

```
NodeType                                   # match by type
NodeType[prop.name="value"]                # attribute equality
NodeType[prop=/regex/flags]                # attribute regex match (see Captures)
NodeType[prop=true]                        # boolean attribute
AncestorType DescendantType               # descendant (any depth)
ParentType > ChildType                    # direct child only
NodeType:has(OtherType)                   # contains a matching descendant
NodeType:not(OtherType)                   # excludes nodes matching selector
:has(...):not(...)                        # combinable
```

Shorthands are **not** expanded inside regex literals: `call[callee.name=/^(call|fn)$/]` keeps `/^(call|fn)$/` literal.

---

## Captures

When an attribute selector uses a regex (`/pattern/flags`), the matched value is automatically included in the `captures` field of each result. The capture key is the property path as written.

```bash
# Find logging calls and capture the method name
ast-search 'call[callee.property.name=/^(log|info|warn|error)$/]'
```

Text output appends captures after the source line:

```
src/app.ts:10:4: logger.info("hello world") | callee.property.name=info
```

Multiple regex matchers each produce their own capture key:

```bash
ast-search 'call[callee.property.name=/^(log|info)$/][arguments.0.value=/^user/]'
# → | callee.property.name=info arguments.0.value=user logged in
```

Exact-string matchers (`[prop="value"]`) do **not** produce captures.

---

## Output Formats

### `--format text` (default)

```
src/components/Foo.vue:5:13: return this.testValue
src/app.ts:10:4: logger.info("hello world") | callee.property.name=info
```

Pattern: `file:line:col: source` — `line` is 1-indexed, `col` is 0-indexed. `source` is the first line of the matched node, trimmed. Captures (if any) follow after ` | `.

When `--show-ast` is used, the AST subtree of each matched node is printed below the match line, indented by two spaces:

```
src/app.ts:14:4: fetchUser(id)
  CallExpression
    callee: Identifier [name="fetchUser"]
    arguments[0]: Identifier [name="id"]
```

This is the primary tool for debugging a query that matches too much or too little — run with `--show-ast` to see exactly what was matched, then refine the selector.

### `--format json`

```json
[
  {
    "file": "src/components/Foo.vue",
    "line": 5,
    "col": 13,
    "start": 142,
    "end": 163,
    "offsetEncoding": "utf16",
    "source": "return this.testValue"
  },
  {
    "file": "src/app.ts",
    "line": 10,
    "col": 4,
    "start": 312,
    "end": 337,
    "offsetEncoding": "utf16",
    "source": "logger.info(\"hello world\")",
    "captures": { "callee.property.name": "info" }
  },
  {
    "file": "src/app.ts",
    "line": 20,
    "col": 0,
    "start": 501,
    "end": 534,
    "offsetEncoding": "utf16",
    "source": "createRoute(",
    "source_full": "createRoute(\n  path,\n  handler\n)"
  }
]
```

Single pretty-printed JSON array. Fields:

- `start` / `end`: character offsets from the start of the file. `offsetEncoding` is always `"utf16"` for JS/TS matches (Babel), matching JS `string.slice()`. Use these for programmatic edits — apply back-to-front (descending `start`) to avoid offset invalidation.
- `source`: first trimmed line of the matched node. Always present.
- `source_full`: complete text of the matched node including all lines. **Only present when the match spans multiple lines** (i.e. when it differs from `source`). For single-line matches, `source` is sufficient and `source_full` is omitted.
- `captures`: present only when the query used regex attribute matchers (`/pattern/`).
- `query`: present on every match when multiple queries were provided, identifying which selector produced it.

### `--format files`

```
src/components/Foo.vue
src/components/Bar.ts
```

Deduplicated file paths, one per line. Use for batch operations.

### `--format count`

```
src/components/Foo.vue: 12
src/utils/helper.ts: 5
src/components/Bar.ts: 3

20 matches across 3 files
```

Per-file match counts sorted by frequency (descending), followed by a summary line. Use to scope a refactor before committing to a full search.

---

## JS/TS/Vue Refactoring Patterns

### Vue: find `setup()` methods that use `this` (Vue 2 anti-pattern)
```bash
ast-search 'ObjectMethod[key.name="setup"] this'
```

### Vue: find any method using `this`
```bash
ast-search 'ObjectMethod this'
```

### React: find `.map()` calls missing a `key` JSX attribute

**Element-level** — flags each `JSXElement` inside a `.map()` that is missing a `key` attribute:
```bash
ast-search 'CallExpression[callee.property.name="map"] JSXElement:not(:has(JSXAttribute[name.name="key"]))'
```

**Component-level** — flags the `VariableDeclarator` when it contains a `.map()` but no `key` attribute:
```bash
ast-search 'VariableDeclarator:has(CallExpression[callee.property.name="map"]):not(:has(JSXAttribute[name.name="key"]))'
```

### React: find `.map()` calls returning a JSXFragment (always a missing-key violation)
```bash
ast-search 'CallExpression[callee.property.name="map"] JSXFragment'
```

### React: find all `.map()` calls (including optional-chain variants)
```bash
ast-search 'CallExpression[callee.property.name="map"]'
```

### Find all `await` expressions
```bash
ast-search 'await'
```

### Find all async function declarations
```bash
ast-search 'FunctionDeclaration[async=true]'
```

### Find calls to a specific function by name
```bash
ast-search 'call[callee.name="myFunction"]'
```

### Find arrow functions nested inside function declarations
```bash
ast-search 'FunctionDeclaration arrow'
```

### Find all `console.log` calls
```bash
ast-search 'call[callee.object.name="console"][callee.property.name="log"]'
```

### Find all logging calls across multiple method names and capture which method was used
```bash
ast-search 'call[callee.property.name=/^(log|info|warn|error|debug)$/]'
# output: ... | callee.property.name=warn
```

### Find all `new` expressions for a specific class
```bash
ast-search 'NewExpression[callee.name="MyClass"]'
```

### Find variable declarations named a specific identifier
```bash
ast-search 'VariableDeclarator[id.name="myVar"]'
```

### Find JSX elements by component name
```bash
ast-search 'JSXOpeningElement[name.name="MyComponent"]'
```

---

## Composing with Shell Tools

Get all files with `await` expressions and process them:
```bash
ast-search 'await' --format files | xargs -I {} npx prettier --write {}
```

Count matches per file:
```bash
ast-search 'this' --format json | jq 'group_by(.file) | map({file: .[0].file, count: length})'
```

Get unique files for a targeted grep:
```bash
ast-search 'call[callee.name="deprecated"]' --format files | xargs grep -n "deprecated"
```

---

## Programmatic API

```typescript
import { searchRepo } from 'ast-search';

// Single query
const matches = await searchRepo(['CallExpression'], dir);

// Multi-query — one repo walk, all queries run per file
const matches = await searchRepo(['FunctionDeclaration', 'ArrowFunctionExpression'], dir);
// matches: Array<{
//   file: string;
//   line: number;
//   col: number;
//   start?: number;              // character offset of match start
//   end?: number;                // character offset of match end
//   offsetEncoding?: "utf16" | "bytes";  // "utf16" for JS/TS; "bytes" for Python
//   source: string;              // first trimmed line of matched node
//   source_full?: string;        // full matched node text; only present for multi-line matches
//   query?: string;              // present when multiple selectors were provided
//   captures?: Record<string, string>;  // present when selector uses /regex/ matchers
// }>

// With exclude patterns
const matches = await searchRepo(['CallExpression'], dir, defaultRegistry, ['**/*.test.ts', 'dist/**']);
```

To load plugins programmatically:

```typescript
import { defaultRegistry } from 'ast-search/plugin';
const { register } = await import('ast-search-python');
register(defaultRegistry);

const matches = await searchRepo([selector], dir);
```

---

## Supported File Types

**Core:** `.js` `.ts` `.jsx` `.tsx` `.mjs` `.cjs` `.vue`

**Via plugin:** see [ast-search-python](packages/ast-search-python/AGENTS.md) for `.py` / `.pyw` support.

**Vue SFCs:** Only the `<script>` block is parsed. Supports `<script>`, `<script setup>`, `<script lang="ts">`, `<script setup lang="ts">`. Template and style blocks are ignored.

---

## Gotchas

- **Optional chaining is normalized transparently.** `foo?.bar()` and `foo?.bar` match `CallExpression` and `MemberExpression` selectors respectively — no need for separate queries. The `optional` flag is preserved, so `[optional=true]` still narrows to strictly optional-chain nodes.
- **Unparseable files are silently skipped.** Syntax errors in source files do not abort the search; that file simply yields no matches.
- **`node_modules` is always excluded.** So are any files/directories whose names start with `.`. Use `--exclude` / `-x` for additional patterns (e.g. `--exclude '**/*.test.ts'` `--exclude 'dist/**'`). Patterns are matched against paths relative to `--dir`.
- **`col` is 0-indexed.** `line` is 1-indexed. Match this when cross-referencing editor output.
- **`source` is the first line only**, trimmed. Use `--format json` to get `start`/`end` offsets and `source_full` (the full matched node text) for multi-line matches.
- **JS shorthands expand globally** outside quoted strings and regex literals. Avoid bare shorthand keywords like `new` or `this` in unquoted attribute values — quote them: `[callee.name="this"]`. Regex literals (`/pattern/`) are preserved as-is.
- **Early selector validation** only runs when a single backend is active (either only core is loaded, or `--lang` is specified). All provided queries are validated before any file I/O begins. In mixed-language mode, invalid selectors surface as no matches rather than an error at startup.
- **`--validate` prints a plain-English explanation** (JS backend only) of what a selector matches. Use this to verify query intent before running a full repo scan:
  ```bash
  ast-search --validate 'call[callee.property.name=/^(log|info)$/]'
  # [js] Query syntax is valid.
  #   Matches: `CallExpression` nodes where `callee.property.name` matches /^(log|info)$/
  ```
  In `--format json`, the explanation appears as an `"explanation"` field in the result object.
