# ast-search-python — Agent Reference

Use this plugin to extend [ast-search](../../AGENTS.md) with Python file support. Load it with `--plugin ast-search-python` to search `.py` and `.pyw` files using tree-sitter S-expression queries.

---

## Invocation

```
ast-search <query> --plugin ast-search-python [--dir <path>] [--format text|json|files] [--lang python]
```

| Flag | Alias | Default | Description |
|------|-------|---------|-------------|
| `--plugin` | `-p` | — | Must be `ast-search-python` to activate Python support |
| `--dir` | `-d` | `cwd` | Root directory to search |
| `--format` | `-f` | `text` | Output format: `text`, `json`, or `files` |
| `--lang` | `-l` | all | Pass `python` to restrict to Python files only |

**Exit codes:** `0` = matches found · `1` = no matches · `2` = error (invalid selector, etc.)

---

## Query Syntax

Python queries use [tree-sitter](https://tree-sitter.github.io/tree-sitter/) S-expression syntax. Every query must include at least one `@capture_name` to return results — shorthands include `@_` automatically.

### Shorthands

| Shorthand   | Expands to                          |
|-------------|-------------------------------------|
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
| `comp`      | `(list_comprehension) @_`           |
| `dictcomp`  | `(dictionary_comprehension) @_`     |
| `setcomp`   | `(set_comprehension) @_`            |
| `genexp`    | `(generator_expression) @_`         |
| `assert`    | `(assert_statement) @_`             |
| `delete`    | `(delete_statement) @_`             |
| `global`    | `(global_statement) @_`             |
| `nonlocal`  | `(nonlocal_statement) @_`           |
| `decorated` | `(decorated_definition) @_`         |

### Raw S-expression patterns

```
(node_type) @name                             # match by type
(node_type field: (child_type) @c) @n         # field access
(node_type) @n (#eq? @n "value")              # predicate: text equality
(node_type) @n (#match? @n "regex")           # predicate: regex match
```

---

## Output Formats

Output formats (`text`, `json`, `files`) work identically to the core tool. See [ast-search AGENTS](../../AGENTS.md#output-formats) for details.

---

## Python Refactoring Patterns

### Find all function definitions
```bash
ast-search 'fn' --plugin ast-search-python
```

### Find all class definitions
```bash
ast-search 'class' --plugin ast-search-python
```

### Find all imports (including `from X import Y`)
```bash
ast-search 'import' --plugin ast-search-python
ast-search 'from' --plugin ast-search-python
```

### Find calls to a specific function by name
```bash
ast-search '(call function: (identifier) @n (#eq? @n "my_func")) @c' --plugin ast-search-python
```

### Find all decorators
```bash
ast-search 'decorator' --plugin ast-search-python
```

### Find all `raise` statements
```bash
ast-search 'raise' --plugin ast-search-python
```

### Find all list comprehensions
```bash
ast-search 'comp' --plugin ast-search-python
```

### Find all async functions
```bash
ast-search '(function_definition "async" _) @fn' --plugin ast-search-python
```

### Restrict to Python files only in a mixed-language repo
```bash
ast-search 'fn' --lang python --plugin ast-search-python
```

---

## Composing with Shell Tools

Get all Python files containing `await` and process them:
```bash
ast-search 'await' --plugin ast-search-python --format files | xargs -I {} black {}
```

Count matches per file:
```bash
ast-search 'call' --plugin ast-search-python --format json | jq 'group_by(.file) | map({file: .[0].file, count: length})'
```

---

## Programmatic API

```typescript
import { defaultRegistry } from 'ast-search/plugin';
const { register } = await import('ast-search-python');
register(defaultRegistry);

import { searchRepo } from 'ast-search';
const matches = await searchRepo('fn', './src');
```

---

## Supported File Types

`.py` `.pyw`

---

## Gotchas

- **Raw S-expressions without `@capture_name` return no results.** The shorthands include `@_` automatically; raw queries require you to add your own capture.
- **`async def` functions are typed as `function_definition`** in tree-sitter-python 0.21+. There is no separate `async_function_definition` node. The `fn` shorthand matches both. To match only async, use a predicate query.
- **Shorthands are not expanded inside quoted strings.** `'(call function: (identifier) @n (#eq? @n "fn"))'` keeps `"fn"` literal.
- **Unparseable files are silently skipped.** Syntax errors in source files do not abort the search.
- **`node_modules` is always excluded**, as are files/directories whose names start with `.`.
