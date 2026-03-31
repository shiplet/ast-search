import { extname } from "node:path";
import type { File } from "@babel/types";
import type { LanguageBackend } from "../../language.js";
import type { Match } from "../../types.js";
import { getAst, parseVueSFC } from "../../file.js";
import { runQuery, validateSelector as validate, SHORTHANDS, expandShorthands } from "../../search.js";

export class JSLanguageBackend implements LanguageBackend {
  readonly langId = "js";
  readonly name = "JavaScript/TypeScript";
  readonly extensions = new Set([
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".mjs",
    ".cjs",
    ".vue",
  ]);

  parse(source: string, filePath: string): File {
    const ext = extname(filePath);
    const content = ext === ".vue" ? parseVueSFC(Buffer.from(source)) : source;
    return getAst(content);
  }

  query(ast: unknown, selector: string, source: string, filePath: string): Match[] {
    return runQuery(selector, ast as File, source, filePath);
  }

  validateSelector(selector: string): void {
    validate(selector);
  }
}

export { SHORTHANDS, expandShorthands };
