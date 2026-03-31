import { createRequire } from "module";
import type { LanguageBackend, LanguageRegistry, Match } from "ast-search/plugin";
import { expandShorthands } from "./shorthands.js";
import { runTreeSitterQuery, validateTreeSitterQuery } from "./query.js";

// tree-sitter is a CommonJS module; use createRequire for ESM compat.
const _require = createRequire(import.meta.url);

// Lazy-initialize the parser so the native addon is only loaded when
// a Python file is actually parsed (not at module import time).
let _parser: unknown;
let _language: unknown;
let _QueryClass: unknown;

function getRuntime(): { parser: unknown; language: unknown; QueryClass: unknown } {
  if (!_parser) {
    const Parser = _require("tree-sitter") as {
      new (): { setLanguage(lang: unknown): void; parse(source: string): unknown };
      Query: new (language: unknown, pattern: string) => { captures(node: unknown): unknown[] };
    };
    const pythonModule = _require("tree-sitter-python") as {
      language: unknown;
      nodeTypeInfo?: unknown[];
    };
    _language = pythonModule.language;
    _QueryClass = Parser.Query;
    const p = new Parser();
    p.setLanguage(pythonModule);
    _parser = p;
  }
  return {
    parser: _parser,
    language: _language,
    QueryClass: _QueryClass,
  };
}

export class PythonLanguageBackend implements LanguageBackend {
  readonly langId = "python";
  readonly name = "Python";
  readonly extensions = new Set([".py", ".pyw"]);

  parse(source: string, _filePath: string): unknown {
    const { parser } = getRuntime();
    return (parser as { parse(s: string): unknown }).parse(source);
  }

  query(ast: unknown, selector: string, source: string, filePath: string): Match[] {
    const { language, QueryClass } = getRuntime();
    const expanded = expandShorthands(selector);
    return runTreeSitterQuery(
      ast,
      expanded,
      source,
      filePath,
      language,
      QueryClass as never,
    );
  }

  validateSelector(selector: string): void {
    const { language, QueryClass } = getRuntime();
    validateTreeSitterQuery(expandShorthands(selector), language, QueryClass as never);
  }
}

/**
 * Register the Python backend with an ast-search LanguageRegistry.
 * Called by ast-search core when --plugin ast-search-python is passed.
 */
export function register(registry: LanguageRegistry): void {
  registry.register(new PythonLanguageBackend());
}
