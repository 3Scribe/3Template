// Pure validation shared by Next's config loader and server entry points.
// Never pass this object to a client component.
export function readConfig(env: Record<string, string | undefined>) {
  const databasePath = env.DATABASE_PATH ?? "./data/3t.sqlite";
  if (
    !databasePath.trim() ||
    databasePath !== databasePath.trim() ||
    /[\x00-\x1f]/.test(databasePath) ||
    databasePath === ":memory:" ||
    /^[a-z][a-z\d+.-]*:/i.test(databasePath.replace(/^[a-z]:[\\/]/i, ""))
  ) {
    throw new Error(
      "DATABASE_PATH must be a non-empty local file path (not a URL or in-memory database).",
    );
  }
  return { databasePath };
}
