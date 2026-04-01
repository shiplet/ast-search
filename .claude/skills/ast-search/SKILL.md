---
name: ast-search
description: Search source code using AST structural patterns. Use when finding
  call sites, detecting anti-patterns, or scoping a refactor across the codebase.
  Supports JS/TS/Vue natively; Python via --plugin. Prefer this over grep when
  the query is about code structure rather than text content.
argument-hint: '<query> [--dir <path>] [--format text|json|files] [--lang <id>]'
allowed-tools: Bash(ast-search *)
---

Search the codebase using ast-search with the query: $ARGUMENTS

Use `--format json` when the results need further processing. Use `--format files`
when you need a list of affected files to pass to subsequent tool calls. Default
`--format text` is best for presenting results to the user.

Prefer narrowing with `--dir` when the request is scoped to a specific area of
the codebase. Always show the raw output before interpreting it.

For query syntax and refactoring patterns, see AGENTS.md in the ast-search-js
package.
