export type TimestampLike = { toDate(): Date };

export function timestampToISO(
  value: TimestampLike | string | null | undefined
): string {
  if (value == null) {
    console.warn('timestampToISO: missing createdAt, defaulting to current time');
    return new Date().toISOString();
  }
  if (typeof value === 'string') return value;
  return value.toDate().toISOString();
}
