import { createRequire } from "module";
import path from "path";
import type { LanguageBackend, LanguageRegistry, Match } from "ast-search-js/plugin";
import { expandShorthands } from "./shorthands.js";
import { runTreeSitterQuery, validateTreeSitterQuery } from "./query.js";
import { printTSNodeText, printMatchTSNode, serializeTSNode, type TSNodeFull } from "./ast-print.js";

export { printMatchTSNode };

const _require = createRequire(import.meta.url);

interface TSTreeFull {
  rootNode: TSNodeFull;
}

interface Runtime {
  parser: { parse(source: string): unknown };
  language: unknown;
}

let _runtimePromise: Promise<Runtime> | null = null;

async function getRuntime(): Promise<Runtime> {
  if (_runtimePromise) return _runtimePromise;
  _runtimePromise = (async () => {
    const { default: Parser } = await import("web-tree-sitter");

    const wasmDir = path.dirname(_require.resolve("web-tree-sitter"));
    await Parser.init({
      locateFile: (_name: string) => path.join(wasmDir, "tree-sitter.wasm"),
    });

    const wasmPath = path.join(
      path.dirname(_require.resolve("tree-sitter-wasms/package.json")),
      "out",
      "tree-sitter-python.wasm",
    );
    const Python = await Parser.Language.load(wasmPath);

    const parser = new Parser();
    parser.setLanguage(Python);

    return { parser: parser as unknown as { parse(source: string): unknown }, language: Python };
  })();
  return _runtimePromise;
}

export class PythonLanguageBackend implements LanguageBackend {
  readonly langId = "python";
  readonly name = "Python";
  readonly extensions = new Set([".py", ".pyw"]);

  async parse(source: string, _filePath: string): Promise<unknown> {
    const { parser } = await getRuntime();
    return parser.parse(source);
  }

  async query(ast: unknown, selector: string, source: string, filePath: string, options?: { showAst?: boolean }): Promise<Match[]> {
    const { language } = await getRuntime();
    const expanded = expandShorthands(selector);
    return runTreeSitterQuery(ast, expanded, source, filePath, language, options?.showAst ?? false);
  }

  async validateSelector(selector: string): Promise<void> {
    const { language } = await getRuntime();
    validateTreeSitterQuery(expandShorthands(selector), language);
  }

  printAst(ast: unknown, _source: string, format: "text" | "json"): string {
    const tree = ast as TSTreeFull;
    if (format === "json") {
      return JSON.stringify(serializeTSNode(tree.rootNode), null, 2);
    }
    const out: string[] = [];
    printTSNodeText(tree.rootNode, out, "", undefined);
    return out.join("\n");
  }
}

/**
 * Register the Python backend with an ast-search LanguageRegistry.
 * Called by ast-search core when --plugin ast-search-python is passed.
 */
export function register(registry: LanguageRegistry): void {
  registry.register(new PythonLanguageBackend());
}
