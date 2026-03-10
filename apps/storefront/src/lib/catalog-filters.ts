export type PriceRangeOption = {
  value: string;
  min?: number;
  max?: number;
};

export function matchPriceRange(amount: number | undefined, priceRange: string, ranges: readonly PriceRangeOption[]) {
  if (priceRange === "all") {
    return true;
  }

  if (typeof amount !== "number") {
    return false;
  }

  const range = ranges.find((option) => option.value === priceRange);
  if (!range || range.value === "all") {
    return true;
  }

  if (typeof range.min === "number" && amount < range.min) {
    return false;
  }

  if (typeof range.max === "number" && amount >= range.max) {
    return false;
  }

  return true;
}

export function sortByCatalogRule<T extends { title: string; amount?: number | null }>(items: T[], sort: string) {
  const sorted = [...items];

  switch (sort) {
    case "price_asc":
      sorted.sort((a, b) => (a.amount ?? Number.MAX_SAFE_INTEGER) - (b.amount ?? Number.MAX_SAFE_INTEGER));
      break;
    case "price_desc":
      sorted.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
      break;
    case "title_asc":
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ru"));
      break;
    default:
      break;
  }

  return sorted;
}
