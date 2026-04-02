export interface Match {
  file: string;
  line: number;
  col: number;
  /** Character offset of the match start within the file (UTF-16 for JS/TS; byte offset for Python) */
  start?: number;
  /** Character offset of the match end within the file (UTF-16 for JS/TS; byte offset for Python) */
  end?: number;
  /** First trimmed line of the matched node — always present, backwards-compatible */
  source: string;
  /** Full source text of the matched node; omitted when identical to source (single-line match) */
  source_full?: string;
  /** AST subtree of the matched node as an indented text tree; only present when --show-ast is used */
  astSubtree?: string;
  query?: string;
  captures?: Record<string, string>;
  contextBefore?: string[];
  contextAfter?: string[];
}
