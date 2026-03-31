import type { LanguageBackend } from "./language.js";

export class LanguageRegistry {
  private readonly byExt = new Map<string, LanguageBackend>();
  private readonly byId = new Map<string, LanguageBackend>();

  register(backend: LanguageBackend): void {
    this.byId.set(backend.langId, backend);
    for (const ext of backend.extensions) {
      this.byExt.set(ext, backend);
    }
  }

  getByExtension(ext: string): LanguageBackend | undefined {
    return this.byExt.get(ext);
  }

  getByLangId(langId: string): LanguageBackend | undefined {
    return this.byId.get(langId);
  }

  get allExtensions(): ReadonlySet<string> {
    return new Set(this.byExt.keys());
  }

  get allBackends(): LanguageBackend[] {
    return [...this.byId.values()];
  }
}

export const defaultRegistry = new LanguageRegistry();
