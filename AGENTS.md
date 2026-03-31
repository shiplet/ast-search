# ast-search — Agent Reference

Use this tool to locate AST patterns across a JS/TS/Vue codebase before making edits. It is most valuable when you need to find all call sites, detect anti-patterns at scale, or scope a refactor before touching files.

---

## Invocation

```
ast-search <query> [--dir <path>] [--format text|json|files]
```

| Flag | Alias | Default | Description |
|------|-------|---------|-------------|
| `--dir` | `-d` | `cwd` | Root directory to search |
| `--format` | `-f` | `text` | Output format: `text`, `json`, or `files` |

**Exit codes:** `0` = matches found · `1` = no matches · `2` = error (invalid selector, etc.)

---

## Query Syntax

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

Shorthands are **not** expanded inside quoted attribute values: `call[callee.name="new"]` keeps `"new"` literal.

### Selector patterns

```
NodeType                                   # match by type
NodeType[prop.name="value"]                # attribute equality
NodeType[prop=true]                        # boolean attribute
AncestorType DescendantType               # descendant (any depth)
ParentType > ChildType                    # direct child only
NodeType:has(OtherType)                   # contains a matching descendant
NodeType:not(OtherType)                   # excludes nodes matching selector
:has(...):not(...)                        # combinable
```

---

## Output Formats

### `--format text` (default)

```
src/components/Foo.vue:5:13: return this.testValue
src/components/Bar.vue:9:0: setup() {
```

Pattern: `file:line:col: source` — `line` is 1-indexed, `col` is 0-indexed. `source` is the first line of the matched node, trimmed.

### `--format json`

```json
[
  {
    "file": "src/components/Foo.vue",
    "line": 5,
    "col": 13,
    "source": "return this.testValue"
  }
]
```

Single pretty-printed JSON array. Parse with `jq` or read directly.

### `--format files`

```
src/components/Foo.vue
src/components/Bar.ts
```

Deduplicated file paths, one per line. Use for batch operations.

---

## Refactoring Patterns

### Vue: find `setup()` methods that use `this` (Vue 2 anti-pattern)
```bash
ast-search 'ObjectMethod[key.name="setup"] this'
```

### Vue: find any method using `this`
```bash
ast-search 'ObjectMethod this'
```

### React: find `.map()` calls missing a `key` JSX attribute

Two approaches, different granularity:

**Element-level** — flags each specific `JSXElement` inside a `.map()` that is missing a `key` attribute. More precise; use this when you want exact line numbers for the offending elements:
```bash
ast-search 'CallExpression[callee.property.name="map"] JSXElement:not(:has(JSXAttribute[name.name="key"]))'
```

**Component-level** — flags the `VariableDeclarator` (the whole component) when it contains a `.map()` but no `key` attribute anywhere inside it. Coarser, but useful for getting a file list to review:
```bash
ast-search 'VariableDeclarator:has(CallExpression[callee.property.name="map"]):not(:has(JSXAttribute[name.name="key"]))'
```

### React: find `.map()` calls returning a JSXFragment (always a missing-key violation)

`<>...</>` fragment syntax can never accept a `key` prop, so any fragment returned from `.map()` is unconditionally a missing-key violation. No `:not()` needed:
```bash
ast-search 'CallExpression[callee.property.name="map"] JSXFragment'
```

### React: find all `.map()` calls (including optional-chain variants like `items?.map(...)`)
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

const matches = await searchRepo(selector, dir);
// matches: Array<{ file: string; line: number; col: number; source: string }>
```

`validateSelector(selector)` throws synchronously on invalid selector syntax — call it to pre-validate before running a search.

---

## Supported File Types

`.js` `.ts` `.jsx` `.tsx` `.mjs` `.cjs` `.vue`

**Vue SFCs:** Only the `<script>` block is parsed. Supports `<script>`, `<script setup>`, `<script lang="ts">`, `<script setup lang="ts">`. Template and style blocks are ignored.

---

## Gotchas

- **Optional chaining is normalized transparently.** `foo?.bar()` and `foo?.bar` match `CallExpression` and `MemberExpression` selectors respectively — no need for separate queries. The `optional` flag is preserved, so `[optional=true]` still narrows to strictly optional-chain nodes.
- **Unparseable files are silently skipped.** Syntax errors in source files do not abort the search; that file simply yields no matches.
- **`node_modules` is always excluded.** So are any files/directories whose names start with `.`.
- **`col` is 0-indexed.** `line` is 1-indexed. Match this when cross-referencing editor output.
- **`source` is the first line only**, trimmed. Multi-line nodes (e.g., a full function body) are truncated. Use `--format json` and the `file`/`line`/`col` fields to locate the full node.
- **Shorthands expand globally** outside quoted strings. Avoid bare shorthand keywords like `new` or `this` in unquoted attribute values — quote them: `[callee.name="this"]`.
