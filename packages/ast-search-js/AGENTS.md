# ast-search — Agent Reference

Use this tool to locate AST patterns across a codebase before making edits. It is most valuable when you need to find all call sites, detect anti-patterns at scale, or scope a refactor before touching files.

Language support is plugin-based. The core handles JS/TS/Vue. For Python support, see [ast-search-python](packages/ast-search-python/AGENTS.md).

---

## Invocation

```
ast-search <query> [--dir <path>] [--format text|json|files] [--lang <id>] [--plugin <pkg>]
```

| Flag | Alias | Default | Description |
|------|-------|---------|-------------|
| `--dir` | `-d` | `cwd` | Root directory to search |
| `--format` | `-f` | `text` | Output format: `text`, `json`, or `files` |
| `--lang` | `-l` | all | Restrict to one language backend by `langId` (e.g. `js`, `python`) |
| `--plugin` | `-p` | none | Load a language plugin package (repeatable) |

**Exit codes:** `0` = matches found · `1` = no matches · `2` = error (invalid selector, etc.)

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

### `--format json`

```json
[
  {
    "file": "src/components/Foo.vue",
    "line": 5,
    "col": 13,
    "source": "return this.testValue"
  },
  {
    "file": "src/app.ts",
    "line": 10,
    "col": 4,
    "source": "logger.info(\"hello world\")",
    "captures": { "callee.property.name": "info" }
  }
]
```

Single pretty-printed JSON array. The `captures` field is present only when the query used regex attribute matchers.

### `--format files`

```
src/components/Foo.vue
src/components/Bar.ts
```

Deduplicated file paths, one per line. Use for batch operations.

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

const matches = await searchRepo(selector, dir);
// matches: Array<{
//   file: string;
//   line: number;
//   col: number;
//   source: string;
//   captures?: Record<string, string>;  // present when selector uses /regex/ matchers
// }>
```

To load plugins programmatically:

```typescript
import { defaultRegistry } from 'ast-search/plugin';
const { register } = await import('ast-search-python');
register(defaultRegistry);

const matches = await searchRepo(selector, dir);
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
- **`node_modules` is always excluded.** So are any files/directories whose names start with `.`.
- **`col` is 0-indexed.** `line` is 1-indexed. Match this when cross-referencing editor output.
- **`source` is the first line only**, trimmed. Multi-line nodes (e.g., a full function body) are truncated. Use `--format json` and the `file`/`line`/`col` fields to locate the full node.
- **JS shorthands expand globally** outside quoted strings and regex literals. Avoid bare shorthand keywords like `new` or `this` in unquoted attribute values — quote them: `[callee.name="this"]`. Regex literals (`/pattern/`) are preserved as-is.
- **Early selector validation** only runs when a single backend is active (either only core is loaded, or `--lang` is specified). In mixed-language mode, invalid selectors surface as no matches rather than an error at startup.
