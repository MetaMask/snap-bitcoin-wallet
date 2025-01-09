/**
 * Reverse a map object.
 *
 * @param map - The map to reverse.
 * @returns New reversed map.
 */
export function reverseMapping<
  From extends string | number | symbol,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  To extends string | number | symbol,
>(map: Record<From, To>) {
  return Object.fromEntries(
    Object.entries(map).map(([from, to]) => [to, from]),
  ) as Record<To, From>;
}
