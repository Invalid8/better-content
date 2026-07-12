export const dirtyKey = (collection: string, id: string) =>
  `${collection}:${id}`;

export function getPath(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const key of path.split(".")) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[key];
    if (current === undefined) return undefined;
  }
  return current;
}

export function setPath(
  obj: Record<string, unknown>,
  fieldKey: string,
  value: unknown,
): Record<string, unknown> {
  const keys = fieldKey.split(".");
  if (keys.length === 1) return { ...obj, [fieldKey]: value };
  const next = { ...obj };
  let current: Record<string, unknown> = next;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    current[key] = { ...((current[key] as object) ?? {}) };
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]!] = value;
  return next;
}
