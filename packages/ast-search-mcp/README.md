# ast-search-mcp

[![npm](https://img.shields.io/npm/v/ast-search-mcp?label=ast-search-mcp)](https://www.npmjs.com/package/ast-search-mcp)

MCP server for [ast-search-js](../ast-search-js/README.md) — structural code search for AI agents. Exposes AST pattern search as MCP tools so any MCP-compatible client (Claude Code, Claude Desktop, etc.) can search source code by shape rather than text.

## Table of Contents

- [Installation](#installation)
- [Setup](#setup)
- [Tools](#tools)
  - [search](#search)
  - [validate\_query](#validate_query)
  - [show\_ast](#show_ast)
- [Python support](#python-support)

## Installation

```bash
npm install -g ast-search-mcp

# Optional: add Python support
npm install -g ast-search-python
```

## Setup

Add the server to your MCP client's configuration. For **Claude Code**, add to `.claude/settings.json` in your project (or `~/.claude/settings.json` globally):

```json
{
  "mcpServers": {
    "ast-search": {
      "command": "ast-search-mcp"
    }
  }
}
```

For **Claude Desktop**, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ast-search": {
      "command": "ast-search-mcp"
    }
  }
}
```

Or run without a global install using `npx`:

```json
{
  "mcpServers": {
    "ast-search": {
      "command": "npx",
      "args": ["ast-search-mcp"]
    }
  }
}
```

## Tools

### `search`

Search source code using AST structural patterns. Returns match locations with file path, line, column, and source snippet.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `queries` | `string[]` | required | One or more AST selector queries. CSS selectors for JS/TS/Vue; S-expressions for Python. |
| `dir` | `string` | `cwd` | Root directory to search |
| `lang` | `string` | all | Restrict to one language backend, e.g. `"js"` or `"python"` |
| `exclude` | `string[]` | none | Glob patterns to exclude, e.g. `["**/*.test.ts", "dist/**"]` |
| `limit` | `number` | none | Stop after N matches — useful for exploratory scope checks |
| `context` | `number` | `0` | Lines of source context to include above and below each match |
| `showAst` | `boolean` | `false` | Include the AST subtree of each matched node — useful when writing or debugging queries |
| `plugins` | `string[]` | none | Language plugin packages to load, e.g. `["ast-search-python"]` |

**Result shape:**

```json
{
  "matches": [
    {
      "file": "src/app.ts",
      "line": 10,
      "col": 4,
      "start": 312,
      "end": 337,
      "offsetEncoding": "utf16",
      "source": "logger.info(\"hello world\")",
      "captures": { "callee.property.name": "info" }
    }
  ],
  "_meta": {
    "matchCount": 1,
    "filesSearched": 42,
    "wallMs": 180,
    "queries": ["call[callee.property.name=/^(log|info|warn|error)$/]"],
    "truncated": false
  }
}
```

`start`/`end` are character offsets whose encoding is indicated by `offsetEncoding`: `"utf16"` for JS/TS (Babel), `"bytes"` for Python (tree-sitter). `source_full` is included when a match spans multiple lines. `captures` is present when the query used regex attribute matchers. `query` is present on each match when multiple queries were provided.

### `validate_query`

Validate an AST selector without running a search. For JS queries, also returns a plain-English explanation of what nodes the selector matches.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | `string` | required | AST selector to validate |
| `lang` | `string` | `"js"` | Language backend to validate against: `"js"` or `"python"` |
| `plugins` | `string[]` | none | Language plugin packages required for the target language |

**Result shape (valid):**

```json
{
  "valid": true,
  "lang": "js",
  "explanation": "Matches `CallExpression` nodes where `callee.property.name` matches /^(log|info)$/"
}
```

**Result shape (invalid):**

```json
{
  "valid": false,
  "error": "Unknown pseudo-class ':hasChild'"
}
```

### `show_ast`

Print the AST structure of a code snippet or source file. Use this to discover node types and property paths when writing queries.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `code` | `string` | — | Inline code snippet to parse and print |
| `file` | `string` | — | Path to a source file to parse |
| `lines` | `string` | — | Line range when using `file`, e.g. `"10-20"` (1-indexed, inclusive) |
| `lang` | `string` | inferred | Language to use: `"js"` (default) or `"python"`. Inferred from file extension when `file` is given. |
| `plugins` | `string[]` | none | Language plugin packages required for the target language |

Provide either `code` or `file` — not both.

## Python support

To search `.py` and `.pyw` files, install the Python plugin and pass it in the `plugins` parameter of any tool call:

```bash
npm install -g ast-search-python
```

Then in your tool calls, include `"plugins": ["ast-search-python"]`. Plugins are loaded once per server session — subsequent calls with the same plugin name are no-ops.

Python queries use tree-sitter S-expression syntax. See [ast-search-python](../ast-search-python/README.md) for the full query syntax and shorthands.

```json
{
  "queries": ["fn"],
  "dir": "/path/to/project",
  "plugins": ["ast-search-python"],
  "lang": "python"
}
```
