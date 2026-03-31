import type { Match } from "./types.js";

export type { Match };

export interface LanguageBackend {
  /** Short identifier used with --lang flag, e.g. "js", "python" */
  readonly langId: string;
  /** File extensions this backend handles, e.g. new Set([".py"]) */
  readonly extensions: ReadonlySet<string>;
  /** Human-readable name for error messages */
  readonly name: string;

  /** Parse source text into an opaque AST. Throws on unrecoverable parse error. */
  parse(source: string, filePath: string): Promise<unknown> | unknown;

  /**
   * Run a selector query against a parsed AST. The selector is in the
   * backend's native query syntax (after shorthand expansion). Returns matches
   * with file/line/col/source fields.
   */
  query(ast: unknown, selector: string, source: string, filePath: string): Promise<Match[]> | Match[];

  /**
   * Validate a selector string. Expands shorthands internally, then checks
   * syntax. Throws with a descriptive message on invalid syntax.
   */
  validateSelector(selector: string): Promise<void> | void;
}
