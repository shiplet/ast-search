import { FileHandle, open } from "node:fs/promises";
import { extname } from "node:path";
import * as parser from "@babel/parser";
import { File } from "@babel/types";

export function getAst(contents: string) {
  return parser.parse(contents, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });
}

export const SCRIPT_OPEN = /^\s*<script(\s[^>]*)?\s*>/;
export const SCRIPT_CLOSE = /^\s*<\/script>\s*/;

export function parseVueSFC(lines: Buffer): string {
  const fileContents: string[] = [];
  let append = false;
  for (const line of lines.toString().split("\n")) {
    if (SCRIPT_OPEN.test(line)) {
      append = true;
      continue;
    }

    if (SCRIPT_CLOSE.test(line)) {
      append = false;
      break;
    }

    if (append) {
      fileContents.push(line);
    }
  }

  return fileContents.join("\n");
}

const JS_EXTENSIONS = new Set([".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"]);

interface ParseReturn {
  ast: File;
  file: FileHandle;
  source: string;
}

export async function getAstFromPath(path: string): Promise<ParseReturn> {
  const file = await open(path);
  const lines = await file.readFile();
  const ext = extname(path);

  let fileContents: string;
  if (ext === ".vue") {
    fileContents = parseVueSFC(lines);
  } else if (JS_EXTENSIONS.has(ext)) {
    fileContents = lines.toString();
  } else {
    throw new Error(`Unsupported file extension: "${ext}" in path: ${path}`);
  }

  const ast = getAst(fileContents);
  return { ast, file, source: fileContents };
}
