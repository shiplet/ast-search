# ast-search-js

[![npm](https://img.shields.io/npm/v/ast-search-js)](https://www.npmjs.com/package/ast-search-js)

Structural code search for JS/TS/Vue — designed for large-scale refactors and AI agent workflows. Finds code by shape, not string.

Accepts a query and searches all supported files under a directory, printing each match with its file path, line, and column. Language support is provided by plugins — the core handles JS/TS/Vue; additional languages are opt-in.

Agents: see [AGENTS.md](./AGENTS.md) for tool descriptions, output format details, and usage patterns.

## Table of Contents

- [Example](#example)
- [Installation](#installation)
- [Usage](#usage)
  - [Output formats](#output-formats)
- [Query syntax](#query-syntax)
  - [JavaScript / TypeScript / Vue](#javascript--typescript--vue)
    - [Shorthands](#shorthands)
    - [Optional chaining](#optional-chaining)
  - [Python](#python)
- [Supported file types](#supported-file-types)
- [Plugin API](#plugin-api)

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
npm install -g ast-search-js

# Optional: add Python support
npm install -g ast-search-python
```

## Agent and LLM usage

`ast-search` is designed to work well as a tool in AI agent workflows:

- **Token-efficient** — outputs only match locations, not whole file contents
- **Machine-readable** — `--format json` returns a structured array ready for parsing
- **Structurally precise** — selector-based queries eliminate false positives from string matching
- **Composable** — `--format files` produces a newline-delimited list suitable for piping to `xargs` or subsequent tool calls

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

- **`text`** (default) — one match per line as `file:line:col: source`; when the query uses regex matchers, captured values are appended after ` | `
- **`files`** — unique file paths only, one per line; useful for piping to `xargs`
- **`json`** — full match array as JSON; includes a `captures` field when regex matchers were used

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

# Find logging calls across multiple methods — regex attribute matching
# Captures the matched method name: | callee.property.name=warn
ast-search 'call[callee.property.name=/^(log|info|warn|error)$/]'
```

Attribute selectors support both exact strings (`[prop="value"]`) and regex literals (`[prop=/pattern/flags]`). Regex matchers automatically capture the matched value in the result's `captures` field.

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

### Python

For Python support, see [ast-search-python](../ast-search-python/README.md).

## Supported file types

**Core:** `.js` `.ts` `.jsx` `.tsx` `.mjs` `.cjs` `.vue`

**Via plugin:** see [ast-search-python](../ast-search-python/README.md) for `.py` / `.pyw` support.

## Plugin API

Language support is extensible. See the [Plugin API section in the repository README](https://github.com/willey-shiplet/ast-search#plugin-api) for the `LanguageBackend` interface and instructions for writing a language plugin.
