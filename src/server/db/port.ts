import "server-only";

export type Parameter = string | number | null;
export type Statement = { sql: string; params?: Parameter[] };
export interface Database {
  query<T>(sql: string, params?: Parameter[]): Promise<T[]>;
  // All statements commit together or roll back together, on both SQLite and D1.
  batch(statements: Statement[]): Promise<void>;
  close(): void;
}
