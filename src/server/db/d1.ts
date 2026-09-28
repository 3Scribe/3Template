import "server-only";
import type { D1Database } from "@cloudflare/workers-types";
import type { Database } from "./port";

export function d1Database(binding: D1Database): Database {
  return {
    async query<T>(sql: string, params = []) {
      const result = await binding
        .prepare(sql)
        .bind(...params)
        .all<T>();
      return result.results;
    },
    async batch(statements) {
      await binding.batch(
        statements.map(({ sql, params = [] }) =>
          binding.prepare(sql).bind(...params),
        ),
      );
    },
    close() {},
  };
}
