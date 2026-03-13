export type CatalogSearchParams = {
  cat?: string | string[];
  sort?: string | string[];
  page?: string | string[];
  brand?: string | string[];
  price?: string | string[];
  availability?: string | string[];
  price_range?: string | string[];
  q?: string | string[];
  [key: string]: string | string[] | undefined;
};

export const CATALOG_SORT_OPTIONS = [
  { value: "popular", label: "Популярные" },
  { value: "price_asc", label: "Сначала дешевле" },
  { value: "price_desc", label: "Сначала дороже" },
  { value: "title_asc", label: "По названию" },
] as const;

export const CATALOG_PRICE_RANGES = [
  { value: "all", label: "Любая цена" },
  { value: "under_300", label: "До 300 USD", min: 0, max: 300 },
  { value: "300_600", label: "300–600 USD", min: 300, max: 600 },
  { value: "over_600", label: "От 600 USD", min: 600 },
] as const;

export const CATALOG_PAGE_SIZE = 24;

export const CATALOG_SORT_LABELS = new Map<string, string>(
  CATALOG_SORT_OPTIONS.map((option) => [option.value, option.label])
);

export const CATALOG_PRICE_LABELS = new Map<string, string>(
  CATALOG_PRICE_RANGES.map((range) => [range.value, range.label])
);

export type CatalogSortValue = (typeof CATALOG_SORT_OPTIONS)[number]["value"];
export type CatalogPriceValue = (typeof CATALOG_PRICE_RANGES)[number]["value"];

export type CatalogNormalizedParams = {
  selectedCategory: string;
  selectedCategories: string[];
  selectedSort: CatalogSortValue;
  selectedBrand: string;
  selectedBrands: string[];
  selectedAvailability: string;
  selectedAvailabilities: string[];
  selectedPriceRange: string;
  selectedPriceRanges: string[];
  selectedExtraFilters: Record<string, string[]>;
  selectedPrice: CatalogPriceValue;
  selectedQuery: string;
  requestedPage: number;
};

export type CatalogQueryInput = {
  cat?: string | string[];
  sort?: string;
  page?: number;
  brand?: string | string[];
  availability?: string | string[];
  priceRange?: string | string[];
  extraFilters?: Record<string, string | string[] | undefined>;
  price?: string;
  q?: string;
  v2?: boolean;
};

const RESERVED_DYNAMIC_FILTER_KEYS = new Set([
  "filter_brand",
  "filter_category",
  "filter_price_range",
  "filter_availability",
  "filter_sex",
]);

function getFirstValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeMultiValue(value?: string | string[], fallback = "all") {
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const normalized = rawValues
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);

  const uniqueValues = Array.from(new Set(normalized));
  const valuesWithoutAll = uniqueValues.filter((item) => item !== "all");

  if (valuesWithoutAll.length > 0) {
    return valuesWithoutAll;
  }

  return uniqueValues.length > 0 ? ["all"] : [fallback];
}

export function normalizeCatalogSearchParams(query: CatalogSearchParams): CatalogNormalizedParams {
  const selectedCategories = normalizeMultiValue(query.cat, "all");
  const selectedCategory = selectedCategories[0] ?? "all";
  const sortValue = getFirstValue(query.sort);
  const selectedSort = CATALOG_SORT_OPTIONS.some((option) => option.value === sortValue)
    ? (sortValue as CatalogSortValue)
    : "popular";
  const selectedBrands = normalizeMultiValue(query.brand, "all");
  const selectedBrand = selectedBrands[0] ?? "all";
  const selectedAvailabilities = normalizeMultiValue(query.availability, "all");
  const selectedAvailability = selectedAvailabilities[0] ?? "all";
  const selectedPriceRanges = normalizeMultiValue(query.price_range, "all");
  const selectedPriceRange = selectedPriceRanges[0] ?? "all";
  const selectedExtraFilters: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith("filter_") || RESERVED_DYNAMIC_FILTER_KEYS.has(key)) {
      continue;
    }

    const normalized = normalizeMultiValue(value, "all").filter((item) => item !== "all");
    if (normalized.length > 0) {
      selectedExtraFilters[key] = normalized;
    }
  }

  const priceValue = getFirstValue(query.price);
  const selectedPrice = CATALOG_PRICE_RANGES.some((option) => option.value === priceValue)
    ? (priceValue as CatalogPriceValue)
    : "all";
  const selectedQuery = (getFirstValue(query.q) ?? "").trim().slice(0, 80);
  const rawPage = Number(getFirstValue(query.page) ?? "1");
  const requestedPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  return {
    selectedCategory,
    selectedCategories,
    selectedSort,
    selectedBrand,
    selectedBrands,
    selectedAvailability,
    selectedAvailabilities,
    selectedPriceRange,
    selectedPriceRanges,
    selectedExtraFilters,
    selectedPrice,
    selectedQuery,
    requestedPage,
  };
}

export function buildCatalogQuery(next: CatalogQueryInput) {
  const params = new URLSearchParams();
  if (next.v2) params.set("v2", "1");
  if (next.cat) {
    const catValues = Array.isArray(next.cat) ? next.cat : [next.cat];
    for (const catValue of catValues) {
      if (catValue?.trim()) {
        params.append("cat", catValue.trim());
      }
    }
  }
  if (next.sort) params.set("sort", next.sort);
  if (next.brand) {
    const brandValues = Array.isArray(next.brand) ? next.brand : [next.brand];
    for (const brandValue of brandValues) {
      if (brandValue?.trim()) {
        params.append("brand", brandValue.trim());
      }
    }
  }
  if (next.availability) {
    const values = Array.isArray(next.availability) ? next.availability : [next.availability];
    for (const value of values) {
      if (value?.trim()) {
        params.append("availability", value.trim());
      }
    }
  }
  if (next.priceRange) {
    const values = Array.isArray(next.priceRange) ? next.priceRange : [next.priceRange];
    for (const value of values) {
      if (value?.trim()) {
        params.append("price_range", value.trim());
      }
    }
  }
  if (next.extraFilters) {
    for (const [key, value] of Object.entries(next.extraFilters)) {
      if (!key.startsWith("filter_")) {
        continue;
      }

      const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
      for (const item of values) {
        if (item?.trim()) {
          params.append(key, item.trim());
        }
      }
    }
  }
  if (next.price) params.set("price", next.price);
  if (next.q?.trim()) params.set("q", next.q.trim());
  if (next.page && next.page > 1) params.set("page", String(next.page));

  const query = params.toString();
  return query ? `/catalog?${query}` : "/catalog";
}
