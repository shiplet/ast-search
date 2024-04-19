import { FileHandle, open } from "node:fs/promises";
import * as parser from "@babel/parser";
import { File } from "@babel/types";

export function getAst(contents: string) {
  return parser.parse(contents, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });
}

export async function parseVueSFC(lines: Buffer) {
  const fileContents: string[] = [];
  let append = false;
  for (const line of lines.toString().split("\n")) {
    if (line === "<script>") {
      append = true;
      continue;
    }

    if (line === "</script>") {
      append = false;
      break;
    }

    if (append) {
      fileContents.push(line);
    }
  }

  return fileContents.join("\n");
}

export async function parseFile(lines: Buffer) {
  return lines.toString();
}

interface ParseReturn {
  ast: File;
  file: FileHandle;
}

export async function getAstFromPath(path: string): Promise<ParseReturn> {
  const file = await open(path);
  const lines = await file.readFile();
  let fileContents: string;
  let ast: parser.ParseResult<any>;

  fileContents = await parseVueSFC(lines);
  if (fileContents) {
    ast = getAst(fileContents);
  } else {
    fileContents = await parseFile(lines);
    ast = getAst(fileContents);
  }

  return { ast, file };
}
