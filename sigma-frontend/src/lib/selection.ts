export function toggleMultiSelection<T extends string>(current: T[], value: T | "", totalOptions: number): T[] {
  if (value === "") {
    return [];
  }
  if (current.length === 0) {
    return [value];
  }
  if (current.includes(value)) {
    return current.filter((item) => item !== value);
  }
  const next = [...current, value];
  if (next.length >= totalOptions) {
    return [];
  }
  return next;
}
