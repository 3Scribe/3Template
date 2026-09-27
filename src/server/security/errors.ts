import "server-only";
export class PublicError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PublicError("Invalid request.");
  return value as Record<string, unknown>;
}
export function name(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100)
    throw new PublicError("Enter a name between 1 and 100 characters.");
  return value.trim();
}
