export function getCountMap(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return map;
}

export function getTopFacetValues(countMap: Map<string, number>, limit: number) {
  return Array.from(countMap.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0], "ru");
    })
    .slice(0, limit)
    .map(([value]) => value);
}

export function getPriceCountMap<T extends { amount?: number | null }>(
  items: T[],
  ranges: readonly { value: string; min?: number; max?: number }[],
  matcher: (amount: number | undefined, priceRange: string, ranges: readonly { value: string; min?: number; max?: number }[]) => boolean
) {
  const countMap = new Map<string, number>();

  for (const range of ranges) {
    const count =
      range.value === "all"
        ? items.length
        : items.filter((item) => matcher(item.amount ?? undefined, range.value, ranges)).length;

    countMap.set(range.value, count);
  }

  return countMap;
}
