# ast-search DSL

A terse, CSS-selector-inspired query language for searching JavaScript and TypeScript ASTs
across an entire repository.

---

## Quick start

```
ast-search 'setup > this'
```

Find every `setup` function or method that references `this`.

---

## Grammar (EBNF)

```ebnf
query           ::= scope-query | bare-expr | bare-ident

(* Scoped search: find named nodes whose body contains an expression *)
scope-query     ::= scope ws ">" ws expr-clause

(* Bare expression: match any occurrence of the expression in the file *)
bare-expr       ::= expr-clause

(* Bare identifier: find all nodes with this name, no expression filter *)
bare-ident      ::= identifier

(* The scope can be a concrete name or a wildcard *)
scope           ::= identifier | "*"

(* Boolean operators: && binds more tightly than || *)
expr-clause     ::= and-clause (ws "||" ws and-clause)*
and-clause      ::= expr-pred (ws "&&" ws expr-pred)*

(* A single expression predicate, optionally negated *)
expr-pred       ::= "!"? expr-atom

(* An expression atom is either a full Babel type name or a shorthand alias *)
expr-atom       ::= babel-type | shorthand

(* Babel AST node type: PascalCase, from the expressions table in main.ts *)
babel-type      ::= [A-Z] [A-Za-z]+

(* Shorthand alias: lowercase keyword defined in the Shorthands table below *)
(* import() is the only shorthand that contains punctuation and is special-cased *)
shorthand       ::= "import()" | [a-z] [a-z]*

(* Identifier: any valid JS identifier *)
identifier      ::= [A-Za-z_$] [A-Za-z0-9_$]*

ws              ::= " "+
```

> **Note:** Whitespace around `>` is **required** — `setup>this` is a parse error.
> Write `setup > this`. This mirrors the CSS adjacent-sibling convention where
> selector tokens are separated by whitespace.

### Precedence

`&&` binds more tightly than `||`, encoded directly in the two-level grammar
(`and-clause` nested inside `expr-clause`). No parentheses are needed for the current
expression set; grouping syntax is reserved for a future version.

---

## Shorthand aliases

Shorthands are lowercase aliases for the most common Babel expression types. They save
typing in everyday queries and keep the DSL feeling like grep rather than an XML schema.

| Shorthand   | Babel type                  | Notes                          |
|-------------|-----------------------------|---------------------------------|
| `this`      | `ThisExpression`            | Any use of the `this` keyword  |
| `await`     | `AwaitExpression`           | Any `await expr`               |
| `yield`     | `YieldExpression`           | Any `yield expr`               |
| `new`       | `NewExpression`             | Any `new Ctor()`               |
| `call`      | `CallExpression`            | Any function call `f()`        |
| `arrow`     | `ArrowFunctionExpression`   | Any `() =>` expression         |
| `fn`        | `FunctionExpression`        | Any `function` expression      |
| `member`    | `MemberExpression`          | Any property access `a.b`      |
| `ternary`   | `ConditionalExpression`     | Any `a ? b : c`                |
| `template`  | `TemplateLiteral`           | Any `` `foo ${bar}` `` literal |
| `tagged`    | `TaggedTemplateExpression`  | Any `` tag`...` `` expression  |
| `import()`  | `ImportExpression`          | Dynamic `import()` call        |
| `assign`    | `AssignmentExpression`      | Any `a = b`, `a += b`, etc.    |
| `binary`    | `BinaryExpression`          | Any `a + b`, `a === b`, etc.   |
| `logical`   | `LogicalExpression`         | Any `a && b`, `a || b`, etc.   |
| `spread`    | `SpreadElement`             | Any `...expr`                  |

Full Babel type names are always accepted verbatim (e.g. `ThisExpression`). Shorthands are
strictly aliases — they expand before evaluation.

An all-lowercase token that is **not** in the shorthands table behaves differently depending
on where it appears:

- **Bare-query position** (no `>` in the query): treated as a bare-identifier search (root
  pass only, no body pass). It is **not** silently discarded and does **not** error — it
  matches nodes literally named that identifier. For example, `ast-search 'foo'` finds all
  nodes named `foo`.
- **Expression position** (right-hand side of `>`): a parse error. Only known shorthands
  and PascalCase Babel type names are valid expression atoms. `setup > foo` is a parse
  error if `foo` is not in the shorthands table.

The shorthand table is the only source of expression aliases.

---

## Worked examples

### 1 — Bare identifier: find all nodes named `setup`

```
ast-search 'setup'
```

Finds every function declaration, method, arrow function, or variable declarator whose
name matches `setup`. No expression filter is applied. Useful for a quick "where is this
defined?" lookup.

---

### 2 — Scope + expression: `setup` functions that use `this`

```
ast-search 'setup > this'
```

The canonical motivating query. Finds every node named `setup` whose body contains at
least one `ThisExpression`. Designed for auditing Vue 2 Options-API patterns inside Vue 3
`setup()` methods, where `this` usage is a bug.

---

### 3 — Wildcard scope: any named node using `this`

```
ast-search '* > this'
```

The `*` scope matches every named node (any identifier). Useful when you want to find all
occurrences of an expression type regardless of which function it lives in.

---

### 4 — Negation: `setup` functions that do **not** use `await`

```
ast-search 'setup > !await'
```

The `!` prefix negates the predicate. Returns `setup` nodes that contain no
`AwaitExpression`. Useful for auditing synchronous-only lifecycle hooks.

---

### 5 — AND composition: `setup` using both `this` and `await`

```
ast-search 'setup > this && await'
```

Both predicates must be satisfied. Returns `setup` nodes that contain a `ThisExpression`
**and** an `AwaitExpression`. Useful for finding the worst offenders when migrating Options
API components — those that mix old and new patterns.

---

### 6 — OR composition: `render` using `member` or `ternary`

```
ast-search 'render > member || ternary'
```

Either predicate satisfies the query. Returns `render` functions that use a
`MemberExpression` **or** a `ConditionalExpression`. Useful for auditing complex render
logic that might benefit from extraction.

---

### 7 — Bare expression: all dynamic imports anywhere in the repo

```
ast-search 'import()'
```

No scope — matches any occurrence of `ImportExpression` in the file body. Useful for
finding all lazy-loading entry points across the repo.

---

### 8 — Bare expression with boolean operators: files using both `this` and `await`

```
ast-search 'this && await'
```

No scope — matches any file whose body contains both a `ThisExpression` **and** an
`AwaitExpression` anywhere. Useful for finding files that mix class-style `this` access
with async/await patterns. Or the `||` variant:

```
ast-search 'this || await'
```

Matches files that contain **either** expression — a broader net. Both forms evaluate each
predicate against the entire file body, with the same `&&`/`||` precedence rules as scoped
queries.

---

### 9 — Full Babel type name: `useEffect` containing `ArrowFunctionExpression`

```
ast-search 'useEffect > ArrowFunctionExpression'
```

Full Babel type names work anywhere a shorthand does. Useful when no shorthand exists for
the target type, or when you want to be explicit.

---

### 10 — Wildcard + negation: any named function not using `call`

```
ast-search '* > !call'
```

Find every named function body that never makes a function call. Useful for identifying
pure value-computing functions that never invoke side effects.

---

### 11 — Scope + complex composition: `fetchData` using `await` or `import()`

```
ast-search 'fetchData > await || import()'
```

Finds `fetchData` functions that use asynchronous idioms — either `await` or dynamic
`import()`. Useful when auditing data-fetching conventions across a large codebase.

---

## Semantics

### Scoping

The `scope > expr` form applies a two-phase search:

1. **Root pass:** walk the entire AST depth-first, collecting all nodes whose name matches
   the scope identifier (checked against `key.name`, `id.name`, or bare `Identifier.name`).
2. **Body pass:** for each collected root node, walk its body and check whether the
   predicate is satisfied.

A node "contains" an expression if the expression type appears anywhere in its subtree —
not just at the top level.

### Bare identifier (no `>`)

When the query contains no `>` separator and the single token is **not** a known shorthand
or PascalCase Babel type, it is treated as a bare identifier search. The root pass runs;
no body pass runs. All matching named nodes are reported.

### Bare expression (no identifier, starts with expression atom)

When the query starts with a known shorthand (e.g. `this`, `await`, `import()`) or a
PascalCase Babel type (e.g. `ThisExpression`), it is treated as a bare expression search —
**even if the first token could also be a valid identifier**. The body pass runs against
the entire file body. Every location where the expression appears is reported.

> **Disambiguation rule:** a token that is a known shorthand is always resolved as a
> bare-expr, never as a bare-ident. For example, `ast-search 'template'` matches every
> TemplateLiteral in the repo — **not** functions or variables named `template`. This
> matters for any shorthand that doubles as a common JS identifier: `call`, `fn`,
> `arrow`, `template`, `member`, `assign`, `logical`, etc. To find nodes named `template`
> by identifier, write a scoped query such as `template > this` (where `this` can be any
> valid expression atom). The scope position uses the `identifier` production — shorthand
> expansion never applies there — so `template` in scope position always matches nodes
> literally named `template`. Note: there is currently no way to bare-ident search for a
> name that collides with a shorthand without providing an expression filter; this is a
> known DSL limitation.

When the bare-expr contains boolean operators (`&&` / `||`), each predicate in the
expression is evaluated against the entire file body. A file matches when the composed
predicate holds at file scope — the same evaluation semantics as a scoped body pass, but
with the whole file as the implicit body.

- `this && await` — matches files that contain **both** a `ThisExpression` and an `AwaitExpression` anywhere in the file
- `this || await` — matches files that contain **either** a `ThisExpression` or an `AwaitExpression`
- `!import() && arrow` — matches files with no dynamic imports that do use arrow functions

### Wildcard `*`

The wildcard scope matches every named node the root pass can find, regardless of name.

### Negation `!`

A negated predicate `!expr` is satisfied when the node's body contains **no** occurrence of
that expression type.

In a **scoped query** (`setup > !await`), negation is evaluated against the matched node's
body subtree.

In a **bare-expr query** (`!await`), negation is evaluated against the entire file body —
the file matches when the expression type appears **nowhere** in the file. This is useful
for finding files that have not adopted a pattern (e.g. `!import()` to find files that
never use dynamic imports).

### Boolean operators

- `&&`: all predicates must be satisfied; **must be written explicitly** — space-separated tokens are a parse error, not implicit AND
- `||`: at least one predicate must be satisfied

---

## Design rationale

### Why CSS-selector syntax (`scope > expr`)?

The `>` child combinator is immediately recognizable to JS developers (every one of whom
knows CSS selectors). It reads naturally: "inside `setup`, find `this`." Alternatives
considered: `/` (XPath-like), `:` (less directional), `in` (too wordy). The `>` wins on
clarity and familiarity.

### Why shorthands?

`this`, `await`, and `yield` are already JS keywords. Requiring users to type
`ThisExpression` instead of `this` is pure friction with no semantic benefit. Shorthands
make the DSL feel like grep: short, memorable, and typeable without consulting docs.
Full Babel type names remain valid for precision and for node types without a shorthand.

### Why `!` for negation instead of `not` or `-`?

`!` is the JS negation operator — developers already reach for it instinctively. `not`
adds three characters and feels verbose. `-` is ambiguous with subtraction. `!` wins on
brevity and language consistency.

### Why `&&` / `||` instead of `and` / `or`?

Same logic: JS developers type `&&` and `||` every day. English keywords feel out of
place in a symbol-heavy query language. The DSL targets engineers, not spreadsheet users.

### Why wildcard `*` instead of `.` or `_`?

`*` is the universal glob wildcard — familiar from shell, CSS, and regex. `.` means
"anything" in regex but "current directory" in shell, creating confusion. `*` is
unambiguous in this position.

### Why no parentheses (yet)?

The current expression set is small enough that `&&` / `||` flat composition covers
real-world queries. Parentheses add parser complexity and are easy to add later
(the grammar already reserves them). YAGNI for v1.

### Why Babel AST types rather than a custom type vocabulary?

Babel is the underlying parser. Exposing its type names directly means the DSL stays in
sync with the AST automatically — no mapping layer to maintain. Users who need to write
a query for an obscure type can look it up in the Babel docs once and use it forever.

### Why a single positional argument instead of `-r`/`-s` flags?

The existing three-flag interface (`-f`, `-r`, `-s`) is verbose and hard to compose in
shell pipelines. A single quoted query string mirrors how `grep`, `jq`, and `ripgrep` are
invoked — it's the "grep for ASTs" UX. The flags are retired in favor of the query.
