# ast-search

A CLI tool for searching source files using AST patterns, designed to facilitate large-scale refactors.

Accepts an [esquery](https://github.com/estools/esquery) CSS-selector-style query and searches all supported files under a directory, printing each match with its file path, line, and column.

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

## Usage

```
ast-search <query> [--dir <path>] [--format <fmt>]
```

| Argument         | Description                                              | Default      |
| ---------------- | -------------------------------------------------------- | ------------ |
| `<query>`        | esquery selector string (see below)                      | required     |
| `-d, --dir`      | root directory to search                                 | current dir  |
| `-f, --format`   | output format: `text`, `json`, or `files`                | `text`       |

### Output formats

- **`text`** (default) — one match per line as `file:line:col: source`
- **`files`** — unique file paths only, one per line; useful for piping to `xargs`
- **`json`** — full match array as JSON

## Query syntax

Queries use [esquery](https://github.com/estools/esquery) CSS selector syntax over Babel AST node types. A few examples:

```bash
# Find all arrow functions inside a function named "setup"
ast-search 'ObjectMethod[key.name="setup"] ArrowFunctionExpression'

# Find await expressions anywhere
ast-search 'AwaitExpression'

# Find assignments inside catch clauses
ast-search 'CatchClause AssignmentExpression'
```

### Shorthands

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

## Supported file types

`.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs`, `.vue`
