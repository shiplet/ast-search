// Shorthands for common Python AST node types, expressed as tree-sitter
// S-expression patterns. Each shorthand includes a `@_` capture so that
// `captures()` returns results without the user needing to add a capture name.
//
// For attribute matching or complex patterns, write tree-sitter S-expressions
// directly (and include at least one capture):
//   (call function: (identifier) @name (#eq? @name "foo"))
//
// NOTE: In tree-sitter-python 0.21+, async functions are still
// `function_definition` (no separate `async_function_definition` type).
// To match only async functions, use the full query:
//   (function_definition . "async" .) @fn

export const PYTHON_SHORTHANDS: Record<string, string> = {
  // Shared semantics with JS backend
  fn:      "(function_definition) @_",
  call:    "(call) @_",
  class:   "(class_definition) @_",
  assign:  "(assignment) @_",
  return:  "(return_statement) @_",
  await:   "(await) @_",
  yield:   "(yield) @_",
  import:  "(import_statement) @_",
  if:      "(if_statement) @_",
  for:     "(for_statement) @_",
  while:   "(while_statement) @_",

  // Python-specific
  from:      "(import_from_statement) @_",
  raise:     "(raise_statement) @_",
  with:      "(with_statement) @_",
  lambda:    "(lambda) @_",
  comp:      "(list_comprehension) @_",
  dictcomp:  "(dictionary_comprehension) @_",
  setcomp:   "(set_comprehension) @_",
  genexp:    "(generator_expression) @_",
  decorator: "(decorator) @_",
  assert:    "(assert_statement) @_",
  delete:    "(delete_statement) @_",
  global:    "(global_statement) @_",
  nonlocal:  "(nonlocal_statement) @_",
  augassign: "(augmented_assignment) @_",
  decorated: "(decorated_definition) @_",
};

export function expandShorthands(selector: string): string {
  // Expand shorthand words to their tree-sitter S-expression equivalents, outside
  // quoted strings. Two expansion contexts:
  //
  // 1. Inside S-expressions — after `(`: expand to just the node type name so that
  //    `(fn body: ...)` becomes `(function_definition body: ...)`. Shorthands whose
  //    name already matches the tree-sitter node type (call, await, yield, lambda,
  //    decorator) are no-ops here — expanding `call` → `call` is harmless.
  //
  // 2. Standalone — not preceded by `(` or `@`: expand to the full S-expression
  //    so that bare `fn` becomes `(function_definition) @_`.
  //
  // Capture names like `@fn` are left untouched by both patterns.
  const keys = Object.keys(PYTHON_SHORTHANDS);

  // Map each shorthand to its bare node type name: "(function_definition) @_" → "function_definition"
  const nodeTypes: Record<string, string> = {};
  for (const [key, val] of Object.entries(PYTHON_SHORTHANDS)) {
    const m = val.match(/^\((\w+)\)\s*@_$/);
    nodeTypes[key] = m ? m[1] : key;
  }

  const innerPattern = new RegExp(`(?<=\\()\\b(${keys.join("|")})\\b`, "g");
  const standalonePattern = new RegExp(`(?<![@(])\\b(${keys.join("|")})\\b`, "g");

  const parts: string[] = [];
  let i = 0;
  while (i < selector.length) {
    const ch = selector[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < selector.length && selector[j] !== ch) j++;
      parts.push(selector.slice(i, j + 1));
      i = j + 1;
    } else {
      const nextQuote = selector.slice(i).search(/['"]/);
      const segment =
        nextQuote === -1 ? selector.slice(i) : selector.slice(i, i + nextQuote);
      // Inner pass first: (fn → (function_definition
      const afterInner = segment.replace(innerPattern, (m) => nodeTypes[m] ?? m);
      // Standalone pass: bare fn → (function_definition) @_
      parts.push(afterInner.replace(standalonePattern, (m) => PYTHON_SHORTHANDS[m] ?? m));
      i = nextQuote === -1 ? selector.length : i + nextQuote;
    }
  }
  return parts.join("");
}
