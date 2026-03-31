# ast-search

A CLI tool for searching source files using AST patterns, designed to facilitate large-scale refactors.

Accepts a query and searches all supported files under a directory, printing each match with its file path, line, and column. Language support is provided by plugins — the core handles JS/TS/Vue; additional languages are opt-in.

## Example

Say you have Vue SFCs with `setup()` functions that improperly access `this`:

```js
export default {
  setup() {
    const value = computed(() => {
      return this.testValue  // shouldn't be here
    })
  }
}
```

Find all such occurrences across your whole repo:

```bash
ast-search 'ObjectMethod[key.name="setup"] ThisExpression'
```

Output:

```
src/components/Foo.vue:5:13: return this.testValue
src/components/Bar.vue:9:18: return this.otherProp
```

## Installation

```bash
npm install -g ast-search

# Optional: add Python support
npm install -g ast-search-python
```

## Usage

```
ast-search <query> [--dir <path>] [--format <fmt>] [--lang <id>] [--plugin <pkg>]
```

| Argument           | Description                                                   | Default      |
| ------------------ | ------------------------------------------------------------- | ------------ |
| `<query>`          | Query string (see Query Syntax below)                         | required     |
| `-d, --dir`        | Root directory to search                                      | current dir  |
| `-f, --format`     | Output format: `text`, `json`, or `files`                     | `text`       |
| `-l, --lang`       | Restrict search to one language backend (e.g. `js`, `python`) | all languages |
| `-p, --plugin`     | Load a language plugin package (repeatable)                   | none         |

### Output formats

- **`text`** (default) — one match per line as `file:line:col: source`
- **`files`** — unique file paths only, one per line; useful for piping to `xargs`
- **`json`** — full match array as JSON

## Query syntax

### JavaScript / TypeScript / Vue

Queries use [esquery](https://github.com/estools/esquery) CSS selector syntax over Babel AST node types. A few examples:

```bash
# Find all arrow functions inside a function named "setup"
ast-search 'ObjectMethod[key.name="setup"] ArrowFunctionExpression'

# Find await expressions anywhere
ast-search 'AwaitExpression'

# Find assignments inside catch clauses
ast-search 'CatchClause AssignmentExpression'
```

#### Shorthands

Common node types can be written as short keywords:

| Shorthand  | Expands to                  |
| ---------- | --------------------------- |
| `this`     | `ThisExpression`            |
| `await`    | `AwaitExpression`           |
| `yield`    | `YieldExpression`           |
| `new`      | `NewExpression`             |
| `call`     | `CallExpression`            |
| `arrow`    | `ArrowFunctionExpression`   |
| `fn`       | `FunctionExpression`        |
| `member`   | `MemberExpression`          |
| `ternary`  | `ConditionalExpression`     |
| `template` | `TemplateLiteral`           |
| `tagged`   | `TaggedTemplateExpression`  |
| `assign`   | `AssignmentExpression`      |
| `binary`   | `BinaryExpression`          |
| `logical`  | `LogicalExpression`         |
| `spread`   | `SpreadElement`             |

The original Vue `this` example using shorthands:

```bash
ast-search 'ObjectMethod[key.name="setup"] this'
```

#### Optional chaining

Optional chains (`?.`) are normalized transparently — `CallExpression` and `MemberExpression` selectors match both regular and optional-chain variants:

```bash
# Matches both items.map(...) and items?.map(...)
ast-search 'CallExpression[callee.property.name="map"]'
```

The `optional` flag is preserved on matched nodes, so you can still narrow to strictly optional calls:

```bash
ast-search 'CallExpression[optional=true]'
```

### Python (via `ast-search-python`)

Python queries use [tree-sitter](https://tree-sitter.github.io/tree-sitter/) S-expression syntax. Install the plugin first:

```bash
npm install -g ast-search-python
```

Then pass `--plugin ast-search-python` to enable `.py` / `.pyw` file support:

```bash
# Find all function definitions (shorthand)
ast-search 'fn' --plugin ast-search-python

# Find all class definitions (raw S-expression)
ast-search '(class_definition) @cls' --plugin ast-search-python

# Find all calls to a specific function by name
ast-search '(call function: (identifier) @n (#eq? @n "my_func")) @c' --plugin ast-search-python

# Restrict to only Python files in a mixed-language repo
ast-search 'fn' --lang python --plugin ast-search-python
```

#### Python shorthands

| Shorthand   | Expands to                          |
| ----------- | ----------------------------------- |
| `fn`        | `(function_definition) @_`          |
| `call`      | `(call) @_`                         |
| `class`     | `(class_definition) @_`             |
| `assign`    | `(assignment) @_`                   |
| `return`    | `(return_statement) @_`             |
| `await`     | `(await) @_`                        |
| `yield`     | `(yield) @_`                        |
| `import`    | `(import_statement) @_`             |
| `from`      | `(import_from_statement) @_`        |
| `if`        | `(if_statement) @_`                 |
| `for`       | `(for_statement) @_`                |
| `while`     | `(while_statement) @_`              |
| `raise`     | `(raise_statement) @_`              |
| `with`      | `(with_statement) @_`               |
| `lambda`    | `(lambda) @_`                       |
| `decorator` | `(decorator) @_`                    |
| `augassign` | `(augmented_assignment) @_`         |

For raw S-expression queries, include at least one `@capture_name` — tree-sitter's `captures()` requires it to return results.

> **Note:** In tree-sitter-python 0.21+, `async def` functions are still typed as `function_definition` (no separate `async_function_definition` node). To match only async functions, use a full predicate query.

## Supported file types

**Core:** `.js` `.ts` `.jsx` `.tsx` `.mjs` `.cjs` `.vue`

**With `ast-search-python`:** `.py` `.pyw`

## Plugin API

To write a language plugin, implement the `LanguageBackend` interface exported from `ast-search/plugin` and export a `register` function:

```typescript
import type { LanguageBackend, LanguageRegistry } from 'ast-search/plugin';

class MyLanguageBackend implements LanguageBackend {
  readonly langId = 'mylang';
  readonly name = 'My Language';
  readonly extensions = new Set(['.ml']);
  parse(source: string, filePath: string) { /* return opaque AST */ }
  query(ast: unknown, selector: string, source: string, filePath: string) { /* return Match[] */ }
  validateSelector(selector: string) { /* throw on invalid */ }
}

export function register(registry: LanguageRegistry) {
  registry.register(new MyLanguageBackend());
}
```

Name your package `ast-search-<lang>` and users load it with `--plugin ast-search-<lang>`.
