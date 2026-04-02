export interface Match {
  file: string;
  line: number;
  col: number;
  source: string;
  query?: string;
  captures?: Record<string, string>;
  contextBefore?: string[];
  contextAfter?: string[];
}
