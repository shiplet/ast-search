# ast-search

A CLI tool for searching source files using AST patterns, designed to facilitate large-scale refactors. Give it a query and a directory; it walks every supported file, runs the query against the parsed AST, and prints each match with its file path, line, and column.

```bash
# Find Vue setup() functions that access `this`
ast-search 'ObjectMethod[key.name="setup"] this'

# Find Python functions that raise exceptions
ast-search 'raise' --plugin ast-search-python
```

## Packages

| Package | Description |
| ------- | ----------- |
| [ast-search-js](packages/ast-search-js/README.md) | Core CLI. Supports JS, TS, JSX, TSX, Vue. Uses [esquery](https://github.com/estools/esquery) CSS selector syntax over Babel AST nodes. |
| [ast-search-python](packages/ast-search-python/README.md) | Python plugin. Adds `.py`/`.pyw` support via [tree-sitter](https://tree-sitter.github.io/tree-sitter/) S-expression queries. |

## Quick start

```bash
npm install -g ast-search-js

# Optional: add Python support
npm install -g ast-search-python
```

```
ast-search <query> [--dir <path>] [--format text|json|files] [--lang <id>] [--plugin <pkg>]
```

See each package's README for full query syntax, shorthands, output formats, and the plugin API for adding new languages.
