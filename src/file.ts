import { FileHandle, open } from "node:fs/promises";
import { type Node, Parser } from "acorn";

export function getAst(contents: string) {
  return Parser.parse(contents, {
    ecmaVersion: 2022,
    sourceType: "module",
  });
}

export async function parseVueSFC(file: FileHandle) {
  const fileContents: string[] = [];
  let append = false;
  const lines = (await file.readFile()).toString().split("\n");
  for (const line of lines) {
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

export async function getAstFromPath(path: string) {
  const file = await open(path);

  const fileContents = await parseVueSFC(file);
  const ast = getAst(fileContents);

  return { ast, file };
}
