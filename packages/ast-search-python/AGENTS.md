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

### Captures

Named captures (`@name` in your pattern, excluding `@_`) are included in the `captures` field of each match. The capture key is the name without the `@`.

Text output appends captures after the source line:

```
src/app.py:5:0: logging.info("user logged in") | fn=logging.info msg="user logged in" call=logging.info("user logged in")
```

JSON output includes a `captures` field when captures are present:

```json
{
  "file": "src/app.py",
  "line": 5,
  "col": 0,
  "source": "logging.info(\"user logged in\")",
  "captures": {
    "fn": "logging.info",
    "msg": "\"user logged in\"",
    "call": "logging.info(\"user logged in\")"
  }
}
```

All captures from a single pattern application are grouped onto one match — `@fn`, `@msg`, and `@call` from the same query match produce one result, not three.

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

### Find calls to any logging method and capture the method name and string argument
```bash
ast-search '(call function: [(identifier)(attribute)] @fn (#match? @fn "^(log|info|warn|error|debug)") arguments: (argument_list (string) @msg)) @call' --plugin ast-search-python
# output: ... | fn=logging.info msg="user logged in" call=logging.info("user logged in")
```

### Find functions whose name matches a regex
```bash
ast-search '(function_definition name: (identifier) @name (#match? @name "^handle_")) @fn' --plugin ast-search-python
# output: ... | name=handle_request fn=def handle_request(...):
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

- **Raw S-expressions without `@capture_name` return no results.** The shorthands include `@_` automatically; raw queries require you to add your own capture. A bare `(function_definition)` returns nothing; write `(function_definition) @fn` or just use the `fn` shorthand.
- **`async def` functions are typed as `function_definition`** in tree-sitter-python 0.21+. There is no separate `async_function_definition` node. The `fn` shorthand matches both. To match only async, use a predicate query.
- **Shorthands are not expanded inside quoted strings.** `'(call function: (identifier) @n (#eq? @n "fn"))'` keeps `"fn"` literal.
- **Unparseable files are silently skipped.** Syntax errors in source files do not abort the search.
- **`node_modules` is always excluded**, as are files/directories whose names start with `.`.
- **Verify the AST structure before writing a query.** Python attribute chains like `self.client.send()` nest deeply — `self` is not the direct `object:` of the outer call; `self.client` is. If a predicate query returns no results, first remove the predicate and confirm the base pattern matches what you expect.
- **All captures from one pattern match are grouped on a single result.** A query like `(function_definition name: (identifier) @n) @fn` produces one match per function, with both `@fn` and `@n` in the `captures` field. The anchor (location) is the first non-underscore capture — `@fn` in this case.
