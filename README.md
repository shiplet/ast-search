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

See each package's README for full query syntax, shorthands, and output formats.

## Plugin API

Language support is plugin-based. The core handles JS/TS/Vue; additional languages are opt-in. To write a plugin, implement the `LanguageBackend` interface exported from `ast-search-js/plugin` and export a `register` function:

```typescript
import type { LanguageBackend, LanguageRegistry } from 'ast-search-js/plugin';

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

Name your package `ast-search-<lang>` and users load it with `--plugin ast-search-<lang>`. See [ast-search-python](packages/ast-search-python/README.md) for a reference implementation.
