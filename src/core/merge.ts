const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Merge plain objects recursively. Arrays, functions, React elements and
 * other instances are replaced, and `undefined` never overrides a value.
 */
export function deepMerge<T>(base: T, ...overrides: Array<unknown>): T {
  let result: unknown = base;
  for (const override of overrides) {
    result = mergeTwo(result, override);
  }
  return result as T;
}

function mergeTwo(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const merged: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    merged[key] = mergeTwo(base[key], override[key]);
  }
  return merged;
}

/** Shallow merge that ignores `undefined` values in the overrides. */
export function assignDefined<T extends object>(
  base: T,
  ...overrides: Array<Partial<T> | undefined>
): T {
  const result = { ...base } as Record<string, unknown>;
  for (const override of overrides) {
    if (!override) continue;
    for (const key of Object.keys(override)) {
      const value = (override as Record<string, unknown>)[key];
      if (value !== undefined) result[key] = value;
    }
  }
  return result as T;
}
