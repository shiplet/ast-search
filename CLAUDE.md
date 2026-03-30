# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                  # run all tests with coverage
npx tsc                   # compile TypeScript to build/
npm run dev               # watch mode compilation
npm run build             # copy main.js to ast-search binary
```

Run a single test file:
```bash
npx jest src/__tests__/search.test.ts
```

Run debug scripts against fixture files (compiles first):
```bash
npm run debug:basics      # JS basics fixture
npm run debug:vue         # Vue SFC fixture
npm run debug:react       # React TSX fixture
```

## Architecture

This is a CLI tool (`-f <file> -r <root> -s <expression>`) that searches source files for a named function/property (the "root"), then checks whether its body contains a given expression type. Designed for large-scale refactoring tasks (e.g., finding Vue `setup()` functions that use `this`).

**Data flow:**

```
main.ts (CLI/yargs) → file.ts (read + parse) → search.ts (AST traversal)
                                                      ↓
                                              helpers/nodes.ts (node predicates)
```

**Key modules:**

- `file.ts` — Opens the file and routes by extension: `.vue` files are parsed as Vue SFCs (content extracted between `<script ...>` and `</script>` using `SCRIPT_OPEN`/`SCRIPT_CLOSE` regexes, supporting `<script>`, `<script setup>`, `<script lang="ts">`, etc.); `.js/.ts/.jsx/.tsx/.mjs/.cjs` files are passed directly to Babel. Unsupported extensions throw. All content is parsed with `@babel/parser` (plugins: `jsx`, `typescript`).
- `search.ts` — `searchForRootNodes(root)(body)` does a recursive depth-first traversal of the AST, collecting nodes whose `key.name`, `id.name`, or identifier `name` matches the root string. Returns a `Set<Node>`. `searchForExp()` calls this and prints results; **the expression-matching half (`searchForExpression`) is currently commented out.**
- `helpers/nodes.ts` — Type-predicate functions (`hasKeyedNode`, `hasIdentifier`, `hasBodyBlockStatement`, `hasDeclarations`, `hasProperties`) plus `getNodeBody()`, which normalizes the many shapes of Babel AST nodes into a consistent `Node[]` for recursive traversal.

**Test setup:**

Tests use `memfs` to mock `node:fs/promises`. `src/__tests__/setup.ts` populates the virtual filesystem with six fixture files (plain JS, Vue 2 SFC, Vue 3 `<script setup>` SFC, React TSX, JS basics, and empty). The `jest.config.mjs` `moduleNameMapper` strips `.js` extensions from imports so TypeScript's ESM-style imports resolve correctly under Jest/ts-jest.

## Notes

- The project is ESM (`"type": "module"`). Import paths in source use `.js` extensions even for `.ts` files (required for Node ESM).
- `output.json` (written by `-d`/`--debug` flag) is gitignored — useful for inspecting the raw Babel AST of a file.
- The compiled binary (`ast-search`) is also gitignored; rebuild with `npm run build` after `npx tsc`.
