import "server-only";
import { openDatabase } from "./sqlite";
import type { Database, Parameter } from "./port";

export function nodeDatabase(path: string): Database {
  const db = openDatabase(path, true);
  const execute = <T>(sql: string, params: Parameter[] = []) =>
    db.prepare(sql).all(...params) as T[];
  return {
    async query<T>(sql: string, params: Parameter[] = []) {
      return execute<T>(sql, params);
    },
    async batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const statement of statements)
          execute(statement.sql, statement.params);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    close() {
      db.close();
    },
  };
}
