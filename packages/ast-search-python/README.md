# ast-search-python

[![npm](https://img.shields.io/npm/v/ast-search-python?label=ast-search-python)](https://www.npmjs.com/package/ast-search-python)

Python language plugin for [ast-search-js](../ast-search-js/README.md). Adds `.py` / `.pyw` file support using [tree-sitter](https://tree-sitter.github.io/tree-sitter/) S-expression queries.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Example](#example)
- [Query syntax](#query-syntax)
  - [Shorthands](#shorthands)
- [Supported file types](#supported-file-types)
- [Plugin API](#plugin-api)

## Installation

```bash
npm install -g ast-search-js
npm install -g ast-search-python
```

> **pnpm users:** `tree-sitter` requires compiling a native addon. pnpm blocks build scripts by default, so the binary won't be built without extra steps. Either run `pnpm approve-builds -g` (select `tree-sitter` and `tree-sitter-python`), then reinstall — or use `npm install -g` instead.

## Usage

Pass `--plugin ast-search-python` to enable Python file support:

```bash
ast-search <query> --plugin ast-search-python [--dir <path>] [--format <fmt>] [--lang python]
```

| Argument       | Description                                                    | Default     |
| -------------- | -------------------------------------------------------------- | ----------- |
| `<query>`      | Shorthand or tree-sitter S-expression (see Query Syntax below) | required    |
| `-d, --dir`    | Root directory to search                                       | current dir |
| `-f, --format` | Output format: `text`, `json`, or `files`                      | `text`      |
| `-l, --lang`   | Restrict search to `python` only (useful in mixed-language repos) | all languages |
| `-p, --plugin` | `ast-search-python`                                            | required    |
| `-C, --context` | Show N lines of context around each match (like `grep -C`)   | `0`         |
| `--ast`        | Print AST for a code snippet or `--file`; use with `--lang python` for Python ASTs | off |

## Example

Find all functions that `raise` an exception:

```bash
ast-search '(function_definition body: (block (raise_statement) @r) @b) @fn' --plugin ast-search-python
```

Using the shorthand:

```bash
ast-search 'raise' --plugin ast-search-python
```

## Query syntax

Python queries use tree-sitter S-expression syntax. A few examples:

```bash
# Find all function definitions (shorthand)
ast-search 'fn' --plugin ast-search-python

# Find all class definitions (raw S-expression)
ast-search '(class_definition) @cls' --plugin ast-search-python

# Find all calls to a specific function by name
ast-search '(call function: (identifier) @n (#eq? @n "my_func")) @c' --plugin ast-search-python

# Find calls to any function matching a regex (using #match? predicate)
ast-search '(call function: (identifier) @n (#match? @n "^(get|post|put|delete)_")) @c' --plugin ast-search-python

# Restrict to only Python files in a mixed-language repo
ast-search 'fn' --lang python --plugin ast-search-python
```

Raw S-expression queries must include at least one `@capture_name` — tree-sitter requires it to return results. Shorthands include `@_` automatically.

Named captures (`@name`, excluding `@_`) appear in the `captures` field of each match. All captures from a single pattern application are grouped on one result. In text output they appear after ` | `; in JSON they're in a `captures` object.

```bash
# Find logging calls — capture the method name and string argument
ast-search '(call function: [(identifier)(attribute)] @fn (#match? @fn "^(log|info|warn|error)") arguments: (argument_list (string) @msg)) @call' --plugin ast-search-python
# text output: src/app.py:5:0: logging.info("msg") | fn=logging.info msg="msg" call=logging.info("msg")
```

### Shorthands

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
| `comp`      | `(list_comprehension) @_`           |
| `dictcomp`  | `(dictionary_comprehension) @_`     |
| `setcomp`   | `(set_comprehension) @_`            |
| `genexp`    | `(generator_expression) @_`         |
| `assert`    | `(assert_statement) @_`             |
| `delete`    | `(delete_statement) @_`             |
| `global`    | `(global_statement) @_`             |
| `nonlocal`  | `(nonlocal_statement) @_`           |
| `decorated` | `(decorated_definition) @_`         |

> **Note:** In tree-sitter-python 0.21+, `async def` functions are typed as `function_definition` (no separate `async_function_definition` node). The `fn` shorthand matches both sync and async functions. To match only async functions, use a predicate query.

## Supported file types

`.py` `.pyw`

## Plugin API

This package implements the `LanguageBackend` interface from `ast-search-js/plugin`. It registers the `python` language backend automatically when loaded via `--plugin ast-search-python`, or programmatically:

```typescript
import { defaultRegistry } from 'ast-search-js/plugin';
const { register } = await import('ast-search-python');
register(defaultRegistry);
```
