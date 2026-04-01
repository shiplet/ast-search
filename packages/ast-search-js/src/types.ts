export interface Match {
  file: string;
  line: number;
  col: number;
  source: string;
  captures?: Record<string, string>;
}
