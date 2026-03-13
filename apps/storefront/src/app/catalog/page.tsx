import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ScrollFadeRow } from "@/components/scroll-fade-row";
import { CatalogV2FilterForm } from "@/components/catalog-v2-filter-form";
import { CatalogCardActions } from "@/components/catalog-card-actions";
import { CatalogSortSelectAuto } from "@/components/catalog-sort-select-auto";
import { CatalogV2SearchAuto } from "@/components/catalog-v2-search-auto";
import { extractProductBrand } from "@/lib/catalog-brand";
import { getCountMap, getPriceCountMap } from "@/lib/catalog-facets";
import { matchPriceRange, sortByCatalogRule } from "@/lib/catalog-filters";
import { mapCatalogCategory } from "@/lib/catalog-mapping";
import {
  buildCatalogQuery,
  CATALOG_PAGE_SIZE,
  CATALOG_PRICE_LABELS,
  CATALOG_PRICE_RANGES,
  CATALOG_SORT_LABELS,
  CATALOG_SORT_OPTIONS,
  normalizeCatalogSearchParams,
  type CatalogQueryInput,
  type CatalogSearchParams,
} from "@/lib/catalog-query";
import { matchesQuery, normalizeQueryText, rankProductsByQuery } from "@/lib/catalog-search";
import { getAllStoreProducts, getMinProductPrice, getProductPriceByCurrency, type StoreProduct } from "@/lib/medusa-store";

type CatalogPageProps = {
  searchParams: Promise<CatalogSearchParams>;
};

type CatalogViewProduct = {
  product: StoreProduct;
  category: string;
  brand: string;
  availability: string;
  priceRange: string;
  extraFacets: Record<string, string>;
  minPrice: ReturnType<typeof getMinProductPrice>;
};

const RESERVED_DYNAMIC_FACET_KEYS = new Set([
  "filter_brand",
  "filter_category",
  "filter_price_range",
  "filter_availability",
  "filter_sex",
]);

const EXTRA_FACET_LABEL_OVERRIDES = new Map<string, string>([
  ["filter_gender", "Пол"],
  ["filter_gifts", "Подарки"],
  ["filter_style", "Стиль"],
  ["filter_size", "Размер"],
  ["filter_mechanism", "Механизм"],
  ["filter_mechanism_origin", "Произв. механизма"],
  ["filter_case_size_mm", "Размер (мм)"],
  ["filter_case_shape", "Форма корпуса"],
  ["filter_case_color", "Цвет корпуса"],
  ["filter_osnova_color", "Основной цвет"],
  ["filter_case_material", "Материал корпуса"],
  ["filter_extra_functions", "Доп. функции"],
  ["filter_glass", "Стекло"],
  ["filter_water_resistance", "Влагозащита"],
  ["filter_assembly_country", "Страна сборки"],
]);

const GLOBAL_HIDDEN_EXTRA_FACET_KEYS = new Set([
  "filter_artnumber",
  "filter_old_price",
]);

const IPAD_HIDDEN_EXTRA_FACET_KEYS = new Set([
  "filter_style",
  "filter_artnumber",
  "filter_depth",
  "filter_length",
  "filter_old_price",
  "filter_sale",
  "filter_sex",
  "filter_status",
  "filter_width",
]);

const UNKNOWN_FACET_VALUES = new Set([
  "не указано",
  "unknown",
  "n/a",
  "none",
  "null",
  "-",
]);

const AVAILABILITY_LABELS = new Map<string, string>([
  ["in_stock", "В наличии"],
  ["out_of_stock", "Нет в наличии"],
]);

const LEGACY_PRICE_RANGE_LABELS = new Map<string, string>([
  ["lt_100", "До 100 USD"],
  ["100_300", "100-300 USD"],
  ["300_600", "300-600 USD"],
  ["600_1000", "600-1000 USD"],
  ["gte_1000", "От 1000 USD"],
]);

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function collectExtraFacetValues(metadata: Record<string, unknown> | null | undefined) {
  const facets: Record<string, string> = {};

  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (!key.startsWith("filter_") || RESERVED_DYNAMIC_FACET_KEYS.has(key)) {
      continue;
    }

    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim();
    if (normalized && !UNKNOWN_FACET_VALUES.has(normalized.toLowerCase())) {
      facets[key] = normalizeFacetValue(key, normalized);
    }
  }

  return facets;
}

function normalizeGiftToken(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (/(black\s*friday|черн(ая|ой)\s*пятниц)/u.test(normalized)) {
    return "Черная пятница";
  }

  if (/(8\s*марта|march\s*8|women'?s\s*day|международн(ый|ого)\s*женск)/u.test(normalized)) {
    return "на 8 марта";
  }

  if (/(нов(ый|ого)\s*год|new\s*year|xmas|christmas|рождеств)/u.test(normalized)) {
    return "на Новый год";
  }

  return value.trim();
}

function splitFacetValue(key: string, value: string) {
  if (key !== "filter_gifts") {
    return [value.trim()].filter(Boolean);
  }

  return value
    .split(/\s*[\/|;,]+\s*/)
    .map((token) => normalizeGiftToken(token))
    .filter(Boolean);
}

function normalizeFacetValue(key: string, value: string) {
  if (key !== "filter_gifts") {
    return value.trim();
  }

  const tokens = Array.from(new Set(splitFacetValue(key, value)));
  return tokens.join(" / ");
}

function formatFacetGroupLabel(key: string) {
  const overridden = EXTRA_FACET_LABEL_OVERRIDES.get(key);
  if (overridden) {
    return overridden;
  }

  const cleaned = key.replace(/^filter_/, "").replace(/_/g, " ").trim();
  if (!cleaned) {
    return key;
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function getAllFacetValues(countMap: Map<string, number>) {
  return Array.from(countMap.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0], "ru");
    })
    .map(([value]) => value);
}

const USD_TO_UAH_RATE = Number(process.env.NEXT_PUBLIC_USD_TO_UAH_RATE ?? 41);
const EUR_TO_UAH_RATE = Number(process.env.NEXT_PUBLIC_EUR_TO_UAH_RATE ?? 45);

function toPrimaryUahPrice(price: { amount: number; currency: string } | null) {
  if (!price) {
    return null;
  }

  const currency = price.currency.toUpperCase();
  if (currency === "UAH") {
    return price;
  }

  if (currency === "USD") {
    return {
      amount: Math.round(price.amount * USD_TO_UAH_RATE),
      currency: "UAH",
    };
  }

  if (currency === "EUR") {
    return {
      amount: Math.round(price.amount * EUR_TO_UAH_RATE),
      currency: "UAH",
    };
  }

  return price;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightTitle(title: string, query: string): ReactNode {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return title;
  }

  const regex = new RegExp(`(${escapeRegExp(trimmedQuery)})`, "ig");
  const parts = title.split(regex);

  return parts.map((part, index) =>
    part.toLowerCase() === trimmedQuery.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="title-highlight">{part}</mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function sortProducts(items: CatalogViewProduct[], sort: string) {
  return sortByCatalogRule(
    items.map((item) => ({
      ...item,
      title: item.product.title,
      amount: item.minPrice?.amount,
    })),
    sort
  );
}

function pluralizeRuItems(value: number) {
  const absValue = Math.abs(value) % 100;
  const lastDigit = absValue % 10;

  if (absValue > 10 && absValue < 20) {
    return "товаров";
  }

  if (lastDigit === 1) {
    return "товар";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "товара";
  }

  return "товаров";
}

export async function generateMetadata({ searchParams }: CatalogPageProps): Promise<Metadata> {
  const query = await searchParams;
  const {
    selectedCategories,
    selectedSort,
    selectedBrands,
    selectedExtraFilters,
    selectedPrice,
    selectedQuery,
    requestedPage,
  } = normalizeCatalogSearchParams(query);
  const isDeepPaginationPage = requestedPage > 10;
  const categoryQueryValue = selectedCategories.includes("all") ? undefined : selectedCategories;
  const brandQueryValue = selectedBrands.includes("all") ? undefined : selectedBrands;

  const canonicalUrl = buildCatalogQuery({
    cat: categoryQueryValue,
    sort: selectedSort !== "popular" ? selectedSort : undefined,
    brand: brandQueryValue,
    extraFilters: selectedExtraFilters,
    price: selectedPrice !== "all" ? selectedPrice : undefined,
    q: selectedQuery || undefined,
    page: requestedPage > 1 ? requestedPage : undefined,
  });

  return {
    title: "Каталог",
    description: "Каталог товаров Imidge с актуальными данными из Medusa Store API.",
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: "Каталог Imidge",
      description: "Каталог товаров Imidge с актуальными данными из Medusa Store API.",
      url: canonicalUrl,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Каталог Imidge",
      description: "Каталог товаров Imidge с актуальными данными из Medusa Store API.",
    },
    robots: isDeepPaginationPage
      ? {
          index: false,
          follow: true,
        }
      : {
          index: true,
          follow: true,
        },
  };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const query = await searchParams;
  const redesignByEnv = process.env.NEXT_PUBLIC_ENABLE_CATALOG_REDESIGN === "1";
  const v2QueryValue = (query as Record<string, string | string[] | undefined>).v2;
  const disableRedesignByQuery = Array.isArray(v2QueryValue) ? v2QueryValue.includes("0") : v2QueryValue === "0";
  const redesignByQuery = Array.isArray(v2QueryValue) ? v2QueryValue.includes("1") : v2QueryValue === "1";
  const isCatalogRedesign = disableRedesignByQuery ? false : redesignByEnv || redesignByQuery || typeof v2QueryValue === "undefined";
  const {
    selectedCategory,
    selectedCategories,
    selectedSort,
    selectedBrand,
    selectedBrands,
    selectedAvailabilities,
    selectedPriceRanges,
    selectedExtraFilters,
    selectedPrice,
    selectedQuery,
    requestedPage,
  } = normalizeCatalogSearchParams(query);
  const isIpadCategoryContext = selectedCategories.some(
    (category) => category.trim().toLowerCase() === "чехлы/обложки ipad"
  );
  const hiddenExtraFacetKeys = new Set([
    ...GLOBAL_HIDDEN_EXTRA_FACET_KEYS,
    ...(isIpadCategoryContext ? [...IPAD_HIDDEN_EXTRA_FACET_KEYS] : []),
  ]);
  const selectedExtraFiltersVisible: Record<string, string[]> = Object.fromEntries(
    Object.entries(selectedExtraFilters)
      .filter(([facetKey]) => !hiddenExtraFacetKeys.has(facetKey))
      .map(([facetKey, values]) => [
        facetKey,
        values
          .map((value) => normalizeFacetValue(facetKey, value))
          .filter((value) => value && !UNKNOWN_FACET_VALUES.has(value.trim().toLowerCase())),
      ])
      .filter(([, values]) => values.length > 0)
  );

  const hasCategoryFilter = !selectedCategories.includes("all");
  const hasBrandFilter = !selectedBrands.includes("all");
  const hasAvailabilityFilter = !selectedAvailabilities.includes("all");
  const hasLegacyPriceRangeFilter = !selectedPriceRanges.includes("all");
  const selectedCategorySet = new Set(hasCategoryFilter ? selectedCategories : []);
  const selectedBrandSet = new Set(hasBrandFilter ? selectedBrands : []);
  const selectedAvailabilitySet = new Set(hasAvailabilityFilter ? selectedAvailabilities : []);
  const selectedPriceRangeSet = new Set(hasLegacyPriceRangeFilter ? selectedPriceRanges : []);
  const selectedExtraFilterSets = new Map(
    Object.entries(selectedExtraFiltersVisible).map(([key, values]) => [key, new Set(values)])
  );
  const categoryQueryValue = hasCategoryFilter ? selectedCategories : undefined;
  const brandQueryValue = hasBrandFilter ? selectedBrands : undefined;
  const availabilityQueryValue = hasAvailabilityFilter ? selectedAvailabilities : undefined;
  const priceRangeQueryValue = hasLegacyPriceRangeFilter ? selectedPriceRanges : undefined;

  const matchesSelectedExtraFilters = (item: CatalogViewProduct, skipFacetKey?: string) => {
    for (const [facetKey, selectedValues] of selectedExtraFilterSets.entries()) {
      if (facetKey === skipFacetKey) {
        continue;
      }

      const itemValue = item.extraFacets[facetKey];
      if (!itemValue) {
        return false;
      }

      if (facetKey === "filter_gifts") {
        const itemTokens = new Set(splitFacetValue(facetKey, itemValue));
        const hasAnySelected = Array.from(selectedValues).some((selected) => itemTokens.has(String(selected)));
        if (!hasAnySelected) {
          return false;
        }
        continue;
      }

      if (!selectedValues.has(itemValue)) {
        return false;
      }
    }

    return true;
  };

  const buildCurrentQuery = (overrides: CatalogQueryInput = {}) => {
    return buildCatalogQuery({
      v2: isCatalogRedesign,
      cat: categoryQueryValue,
      sort: selectedSort !== "popular" ? selectedSort : undefined,
      brand: brandQueryValue,
      availability: availabilityQueryValue,
      priceRange: priceRangeQueryValue,
      extraFilters: selectedExtraFiltersVisible,
      price: selectedPrice !== "all" ? selectedPrice : undefined,
      q: selectedQuery || undefined,
      ...overrides,
    });
  };

  const products = await getAllStoreProducts({ pageLimit: 100, maxPages: 100 });
  const mappedProducts: CatalogViewProduct[] = products.map((product) => ({
    product,
    category: mapCatalogCategory({
      title: product.title,
      handle: product.handle,
      type: product.type?.value,
      collection: product.collection?.title,
      metadata: product.metadata,
    }).label,
    brand: extractProductBrand(product),
    availability: readMetadataString(product.metadata, "filter_availability") || "unknown",
    priceRange: readMetadataString(product.metadata, "filter_price_range") || "unknown",
    extraFacets: collectExtraFacetValues(product.metadata),
    minPrice: getMinProductPrice(product),
  }));

  const normalizedQuery = normalizeQueryText(selectedQuery);
  const queryFilteredProducts = normalizedQuery
    ? mappedProducts.filter((item) => {
        return matchesQuery(
          {
            title: item.product.title,
            handle: item.product.handle,
            brand: item.brand,
            category: item.category,
          },
          selectedQuery
        );
      })
    : mappedProducts;

  const preCategoryProducts = queryFilteredProducts.filter((item) => {
    const byBrand = !hasBrandFilter || selectedBrandSet.has(item.brand);
    const byAvailability = !hasAvailabilityFilter || selectedAvailabilitySet.has(item.availability);
    const byLegacyPriceRange = !hasLegacyPriceRangeFilter || selectedPriceRangeSet.has(item.priceRange);
    const byExtraFacets = matchesSelectedExtraFilters(item);
    return byBrand && byAvailability && byLegacyPriceRange && byExtraFacets;
  });

  const preCategoryByPriceProducts = selectedPrice === "all"
    ? preCategoryProducts
    : preCategoryProducts.filter((item) => matchPriceRange(item.minPrice?.amount, selectedPrice, CATALOG_PRICE_RANGES));

  const categoryCountMap = getCountMap(preCategoryByPriceProducts.map((item) => item.category));
  const categories = getAllFacetValues(categoryCountMap);

  const categoryFilteredProducts = !hasCategoryFilter
    ? preCategoryByPriceProducts
    : preCategoryByPriceProducts.filter((item) => selectedCategorySet.has(item.category));

  const preBrandProducts = (selectedPrice === "all"
    ? categoryFilteredProducts
    : categoryFilteredProducts.filter((item) => matchPriceRange(item.minPrice?.amount, selectedPrice, CATALOG_PRICE_RANGES)))
    .filter((item) => {
      const byAvailability = !hasAvailabilityFilter || selectedAvailabilitySet.has(item.availability);
      const byLegacyPriceRange = !hasLegacyPriceRangeFilter || selectedPriceRangeSet.has(item.priceRange);
      const byExtraFacets = matchesSelectedExtraFilters(item);
      return byAvailability && byLegacyPriceRange && byExtraFacets;
    });

  const brandCountMap = getCountMap(preBrandProducts.map((item) => item.brand));
  const brands = getAllFacetValues(brandCountMap);

  const preAvailabilityProducts = (selectedPrice === "all"
    ? categoryFilteredProducts
    : categoryFilteredProducts.filter((item) => matchPriceRange(item.minPrice?.amount, selectedPrice, CATALOG_PRICE_RANGES))
  ).filter((item) => (!hasBrandFilter || selectedBrandSet.has(item.brand)) && matchesSelectedExtraFilters(item));
  const availabilityCountMap = getCountMap(preAvailabilityProducts.map((item) => item.availability));
  const availabilities = getAllFacetValues(availabilityCountMap);

  const preLegacyPriceRangeProducts = (selectedPrice === "all"
    ? categoryFilteredProducts
    : categoryFilteredProducts.filter((item) => matchPriceRange(item.minPrice?.amount, selectedPrice, CATALOG_PRICE_RANGES))
  ).filter((item) => {
    const byBrand = !hasBrandFilter || selectedBrandSet.has(item.brand);
    const byAvailability = !hasAvailabilityFilter || selectedAvailabilitySet.has(item.availability);
    const byExtraFacets = matchesSelectedExtraFilters(item);
    return byBrand && byAvailability && byExtraFacets;
  });
  const legacyPriceRangeCountMap = getCountMap(preLegacyPriceRangeProducts.map((item) => item.priceRange));
  const legacyPriceRanges = getAllFacetValues(legacyPriceRangeCountMap)
    .filter((value) => value.trim().toLowerCase() !== "unknown");

  const discoveredExtraFacetKeys = Array.from(
    new Set(
      mappedProducts.flatMap((item) => Object.keys(item.extraFacets))
    )
  );

  const allExtraFacetKeys = Array.from(
    new Set([...Object.keys(selectedExtraFiltersVisible), ...discoveredExtraFacetKeys])
  )
    .filter((facetKey) => !hiddenExtraFacetKeys.has(facetKey))
    .sort((a, b) => formatFacetGroupLabel(a).localeCompare(formatFacetGroupLabel(b), "ru"));

  const extraFacetGroups = allExtraFacetKeys
    .map((facetKey) => {
      const pool = (selectedPrice === "all"
        ? categoryFilteredProducts
        : categoryFilteredProducts.filter((item) => matchPriceRange(item.minPrice?.amount, selectedPrice, CATALOG_PRICE_RANGES))
      ).filter((item) => {
        const byBrand = !hasBrandFilter || selectedBrandSet.has(item.brand);
        const byAvailability = !hasAvailabilityFilter || selectedAvailabilitySet.has(item.availability);
        const byLegacyPriceRange = !hasLegacyPriceRangeFilter || selectedPriceRangeSet.has(item.priceRange);
        const byOtherExtraFacets = matchesSelectedExtraFilters(item, facetKey);
        return byBrand && byAvailability && byLegacyPriceRange && byOtherExtraFacets;
      });

      const countMap = getCountMap(
        pool
          .flatMap((item) => {
            const raw = item.extraFacets[facetKey];
            if (!raw) {
              return [] as string[];
            }

            return splitFacetValue(facetKey, raw)
              .map((token) => normalizeFacetValue(facetKey, token))
              .filter((token) => token && !UNKNOWN_FACET_VALUES.has(token.trim().toLowerCase()));
          })
      );
      const values = getAllFacetValues(countMap)
        .filter((value) => !UNKNOWN_FACET_VALUES.has(value.trim().toLowerCase()));
      const activeValues = selectedExtraFiltersVisible[facetKey] ?? [];
      const shouldRender = values.length > 1 || activeValues.length > 0;

      if (!shouldRender) {
        return null;
      }

      return {
        key: facetKey,
        label: formatFacetGroupLabel(facetKey),
        options: values.map((value) => ({
          value,
          label: value,
          count: countMap.get(value) ?? 0,
        })),
      };
    })
    .filter((group): group is { key: string; label: string; options: Array<{ value: string; label: string; count: number }> } => Boolean(group));

  const filteredProducts = preBrandProducts.filter((item) => {
    const byBrand = !hasBrandFilter || selectedBrandSet.has(item.brand);
    const byAvailability = !hasAvailabilityFilter || selectedAvailabilitySet.has(item.availability);
    const byLegacyPriceRange = !hasLegacyPriceRangeFilter || selectedPriceRangeSet.has(item.priceRange);
    const byExtraFacets = matchesSelectedExtraFilters(item);
    return byBrand && byAvailability && byLegacyPriceRange && byExtraFacets;
  });

  const prePriceProducts = !hasCategoryFilter
    ? queryFilteredProducts
    : queryFilteredProducts.filter((item) => selectedCategorySet.has(item.category));

  const prePriceByBrandProducts = !hasBrandFilter
    ? prePriceProducts
    : prePriceProducts.filter((item) => selectedBrandSet.has(item.brand));

  const prePriceFacetProducts = prePriceByBrandProducts.filter((item) => {
    const byAvailability = !hasAvailabilityFilter || selectedAvailabilitySet.has(item.availability);
    const byLegacyPriceRange = !hasLegacyPriceRangeFilter || selectedPriceRangeSet.has(item.priceRange);
    const byExtraFacets = matchesSelectedExtraFilters(item);
    return byAvailability && byLegacyPriceRange && byExtraFacets;
  });

  const priceCountMap = getPriceCountMap(
    prePriceFacetProducts.map((item) => ({ amount: item.minPrice?.amount })),
    CATALOG_PRICE_RANGES,
    matchPriceRange
  );

  const baseProducts = selectedQuery && selectedSort === "popular"
    ? rankProductsByQuery(filteredProducts.map((item) => ({
      ...item,
      title: item.product.title,
      handle: item.product.handle,
    })), selectedQuery)
    : filteredProducts;

  const visibleProducts = sortProducts(baseProducts, selectedSort);
  const suggestionPool = new Set<string>();
  if (normalizedQuery) {
    for (const item of mappedProducts) {
      if (normalizeQueryText(item.brand).includes(normalizedQuery)) {
        suggestionPool.add(item.brand);
      }
      if (normalizeQueryText(item.category).includes(normalizedQuery)) {
        suggestionPool.add(item.category);
      }
    }
  }
  const querySuggestions = Array.from(suggestionPool).slice(0, 6);
  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / CATALOG_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * CATALOG_PAGE_SIZE;
  const pagedProducts = visibleProducts.slice(pageStart, pageStart + CATALOG_PAGE_SIZE);
  const visibleV2Products = visibleProducts.slice(0, currentPage * CATALOG_PAGE_SIZE);
  const renderedProducts = isCatalogRedesign ? visibleV2Products : pagedProducts;
  const shownProductsCount = renderedProducts.length;
  const pageFrom = Math.max(1, currentPage - 2);
  const pageTo = Math.min(totalPages, currentPage + 2);
  const pageNumbers = Array.from({ length: pageTo - pageFrom + 1 }, (_, index) => pageFrom + index);
  const maxV2VisiblePages = 10;
  const v2PageItems: Array<number | "start-ellipsis" | "end-ellipsis"> = [];
  if (totalPages <= maxV2VisiblePages) {
    for (let page = 1; page <= totalPages; page += 1) {
      v2PageItems.push(page);
    }
  } else {
    const innerWindowSize = 6;
    let innerStart = Math.max(2, currentPage - Math.floor(innerWindowSize / 2));
    let innerEnd = Math.min(totalPages - 1, innerStart + innerWindowSize - 1);
    innerStart = Math.max(2, innerEnd - innerWindowSize + 1);

    v2PageItems.push(1);

    if (innerStart > 2) {
      v2PageItems.push("start-ellipsis");
    }

    for (let page = innerStart; page <= innerEnd; page += 1) {
      v2PageItems.push(page);
    }

    if (innerEnd < totalPages - 1) {
      v2PageItems.push("end-ellipsis");
    }

    v2PageItems.push(totalPages);
  }
  const selectedUiPriceRange = CATALOG_PRICE_RANGES.find((range) => range.value === selectedPrice);
  const priceFromValue = selectedUiPriceRange && "min" in selectedUiPriceRange ? selectedUiPriceRange.min : 0;
  const priceToValue = selectedUiPriceRange && "max" in selectedUiPriceRange ? selectedUiPriceRange.max : 28000;
  const hasNextPage = currentPage < totalPages;
  const hasActiveFilters =
    hasCategoryFilter ||
    hasBrandFilter ||
    hasAvailabilityFilter ||
    hasLegacyPriceRangeFilter ||
    Object.keys(selectedExtraFiltersVisible).length > 0 ||
    selectedPrice !== "all" ||
    selectedSort !== "popular" ||
    selectedQuery.length > 0 ||
    currentPage > 1;

  const catalogRootHref = isCatalogRedesign ? "/catalog?v2=1" : "/catalog";

  const activeFilterPills: Array<{ key: string; label: string; href: string }> = [];

  if (hasCategoryFilter) {
    for (const categoryValue of selectedCategories) {
      activeFilterPills.push({
        key: `cat-${categoryValue}`,
        label: `Категория: ${categoryValue}`,
        href: buildCatalogQuery({
          v2: isCatalogRedesign,
          cat: selectedCategories.filter((item) => item !== categoryValue),
          sort: selectedSort !== "popular" ? selectedSort : undefined,
          brand: brandQueryValue,
          availability: availabilityQueryValue,
          priceRange: priceRangeQueryValue,
          extraFilters: selectedExtraFiltersVisible,
          price: selectedPrice !== "all" ? selectedPrice : undefined,
          q: selectedQuery || undefined,
          page: 1,
        }),
      });
    }
  }

  if (hasBrandFilter) {
    for (const brandValue of selectedBrands) {
      activeFilterPills.push({
        key: `brand-${brandValue}`,
        label: `Бренд: ${brandValue}`,
        href: buildCatalogQuery({
          v2: isCatalogRedesign,
          cat: categoryQueryValue,
          sort: selectedSort !== "popular" ? selectedSort : undefined,
          brand: selectedBrands.filter((item) => item !== brandValue),
          availability: availabilityQueryValue,
          priceRange: priceRangeQueryValue,
          extraFilters: selectedExtraFiltersVisible,
          price: selectedPrice !== "all" ? selectedPrice : undefined,
          q: selectedQuery || undefined,
          page: 1,
        }),
      });
    }
  }

  if (hasAvailabilityFilter) {
    for (const availabilityValue of selectedAvailabilities) {
      activeFilterPills.push({
        key: `availability-${availabilityValue}`,
        label: `Наличие: ${AVAILABILITY_LABELS.get(availabilityValue) ?? availabilityValue}`,
        href: buildCatalogQuery({
          v2: isCatalogRedesign,
          cat: categoryQueryValue,
          sort: selectedSort !== "popular" ? selectedSort : undefined,
          brand: brandQueryValue,
          availability: selectedAvailabilities.filter((item) => item !== availabilityValue),
          priceRange: priceRangeQueryValue,
          extraFilters: selectedExtraFiltersVisible,
          price: selectedPrice !== "all" ? selectedPrice : undefined,
          q: selectedQuery || undefined,
          page: 1,
        }),
      });
    }
  }

  if (hasLegacyPriceRangeFilter) {
    for (const rangeValue of selectedPriceRanges) {
      activeFilterPills.push({
        key: `price_range-${rangeValue}`,
        label: `Сегмент: ${LEGACY_PRICE_RANGE_LABELS.get(rangeValue) ?? rangeValue}`,
        href: buildCatalogQuery({
          v2: isCatalogRedesign,
          cat: categoryQueryValue,
          sort: selectedSort !== "popular" ? selectedSort : undefined,
          brand: brandQueryValue,
          availability: availabilityQueryValue,
          priceRange: selectedPriceRanges.filter((item) => item !== rangeValue),
          extraFilters: selectedExtraFiltersVisible,
          price: selectedPrice !== "all" ? selectedPrice : undefined,
          q: selectedQuery || undefined,
          page: 1,
        }),
      });
    }
  }

  for (const [facetKey, selectedValues] of Object.entries(selectedExtraFiltersVisible)) {
    for (const facetValue of selectedValues) {
      const nextExtraFilters = { ...selectedExtraFiltersVisible };
      const nextValues = (nextExtraFilters[facetKey] ?? []).filter((item) => item !== facetValue);

      if (nextValues.length > 0) {
        nextExtraFilters[facetKey] = nextValues;
      } else {
        delete nextExtraFilters[facetKey];
      }

      activeFilterPills.push({
        key: `${facetKey}-${facetValue}`,
        label: `${formatFacetGroupLabel(facetKey)}: ${facetValue}`,
        href: buildCatalogQuery({
          v2: isCatalogRedesign,
          cat: categoryQueryValue,
          sort: selectedSort !== "popular" ? selectedSort : undefined,
          brand: brandQueryValue,
          availability: availabilityQueryValue,
          priceRange: priceRangeQueryValue,
          extraFilters: nextExtraFilters,
          price: selectedPrice !== "all" ? selectedPrice : undefined,
          q: selectedQuery || undefined,
          page: 1,
        }),
      });
    }
  }

  if (selectedPrice !== "all") {
    activeFilterPills.push({
      key: "price",
      label: `Цена: ${CATALOG_PRICE_LABELS.get(selectedPrice) ?? selectedPrice}`,
      href: buildCurrentQuery({ price: undefined, page: 1 }),
    });
  }

  if (selectedSort !== "popular") {
    activeFilterPills.push({
      key: "sort",
      label: `Сортировка: ${CATALOG_SORT_LABELS.get(selectedSort) ?? selectedSort}`,
      href: buildCurrentQuery({ sort: undefined, page: 1 }),
    });
  }

  if (selectedQuery) {
    activeFilterPills.push({
      key: "q",
      label: `Поиск: ${selectedQuery}`,
      href: buildCurrentQuery({ q: undefined, page: 1 }),
    });
  }

  if (currentPage > 1) {
    activeFilterPills.push({
      key: "page",
      label: `Страница: ${currentPage}`,
      href: buildCurrentQuery({ page: undefined }),
    });
  }

  return (
    <div>
      <SiteHeader />

      <main id="main-content" tabIndex={-1}>
        <section className={`section${isCatalogRedesign ? " catalog-section-v2" : ""}`}>
          <div className="container">
          {!isCatalogRedesign && (
            <>
              <p className="hero-kicker">Catalog</p>
              <h1 className="section-title">Каталог товаров</h1>
              <p className="section-subtitle">
                Каталог показывает товары из Medusa Store API с серверной фильтрацией и сортировкой.
              </p>
            </>
          )}

          {isCatalogRedesign && (
            <nav className="catalog-v2-breadcrumbs" aria-label="Хлебные крошки">
              <Link href="/">Главная</Link>
              <span aria-hidden="true">›</span>
              <span>Каталог</span>
            </nav>
          )}

          <div className={isCatalogRedesign ? "catalog-v2-layout" : undefined}>
            {isCatalogRedesign && (
              <aside className="catalog-v2-sidebar" aria-label="Фильтры каталога">
                <div className="catalog-v2-panel">
                  <h3>Фильтры</h3>

                  <div className="catalog-v2-active-box" role="status" aria-live="polite">
                    <div className="catalog-v2-active-head">
                      <p>Активные фильтры</p>
                      {hasActiveFilters && (
                        <Link href={catalogRootHref} className="catalog-v2-reset-link">
                          Сбросить
                        </Link>
                      )}
                    </div>
                    {hasActiveFilters ? (
                      <div className="catalog-v2-active-list">
                        {activeFilterPills.map((pill) => (
                          <Link key={pill.key} href={pill.href} className="catalog-v2-active-item" aria-label={`Убрать фильтр: ${pill.label}`}>
                            {pill.label}
                            <span className="catalog-v2-active-remove" aria-hidden="true">×</span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="catalog-v2-active-empty">Пока нет активных фильтров</p>
                    )}
                  </div>

                  <CatalogV2FilterForm
                    selectedCategories={selectedCategories}
                    selectedBrands={selectedBrands}
                    selectedAvailabilities={selectedAvailabilities}
                    selectedPriceRanges={selectedPriceRanges}
                    selectedExtraFilters={selectedExtraFiltersVisible}
                    selectedPrice={selectedPrice}
                    selectedSort={selectedSort}
                    selectedQuery={selectedQuery}
                    categoryOptions={categories.map((category) => ({
                      value: category,
                      label: category,
                      count: categoryCountMap.get(category) ?? 0,
                    }))}
                    brandOptions={brands.map((brand) => ({
                      value: brand,
                      label: brand,
                      count: brandCountMap.get(brand) ?? 0,
                    }))}
                    availabilityOptions={availabilities
                      .filter((value) => value === "in_stock")
                      .map((value) => ({
                        value,
                        label: AVAILABILITY_LABELS.get(value) ?? value,
                        count: availabilityCountMap.get(value) ?? 0,
                      }))}
                    priceRangeOptions={legacyPriceRanges.map((value) => ({
                      value,
                      label: LEGACY_PRICE_RANGE_LABELS.get(value) ?? value,
                      count: legacyPriceRangeCountMap.get(value) ?? 0,
                    }))}
                    extraFacetGroups={extraFacetGroups}
                    priceOptions={CATALOG_PRICE_RANGES.map((range) => ({
                      value: range.value,
                      label: range.label,
                      count: priceCountMap.get(range.value) ?? 0,
                    }))}
                    priceFromValue={priceFromValue}
                    priceToValue={priceToValue}
                  />
                </div>
              </aside>
            )}

            <div className={isCatalogRedesign ? "catalog-v2-main" : undefined}>

          <div className={`catalog-toolbar${isCatalogRedesign ? " catalog-toolbar-v2" : ""}`}>
            <p className="catalog-count">Найдено: {visibleProducts.length} · Стр. {currentPage}/{totalPages}</p>
            {isCatalogRedesign ? (
              <>
                <CatalogV2SearchAuto
                  initialQuery={selectedQuery}
                  selectedCategories={selectedCategories}
                  selectedBrands={selectedBrands}
                  selectedAvailabilities={selectedAvailabilities}
                  selectedPriceRanges={selectedPriceRanges}
                  selectedExtraFilters={selectedExtraFiltersVisible}
                  selectedPrice={selectedPrice}
                  selectedSort={selectedSort}
                />

                <div className="catalog-toolbar-v2-right">
                <form className="catalog-sort-form-v2" method="get" action="/catalog" aria-label="Сортировка каталога">
                  <input type="hidden" name="v2" value="1" />
                  {(categoryQueryValue ?? []).map((category) => (
                    <input key={`sort-cat-${category}`} type="hidden" name="cat" value={category} />
                  ))}
                  {(brandQueryValue ?? []).map((brand) => (
                    <input key={`sort-brand-${brand}`} type="hidden" name="brand" value={brand} />
                  ))}
                  {(availabilityQueryValue ?? []).map((availability) => (
                    <input key={`sort-availability-${availability}`} type="hidden" name="availability" value={availability} />
                  ))}
                  {(priceRangeQueryValue ?? []).map((range) => (
                    <input key={`sort-price-range-${range}`} type="hidden" name="price_range" value={range} />
                  ))}
                  {Object.entries(selectedExtraFiltersVisible).flatMap(([facetKey, values]) =>
                    values.map((value) => (
                      <input key={`sort-${facetKey}-${value}`} type="hidden" name={facetKey} value={value} />
                    ))
                  )}
                  {selectedPrice !== "all" && <input type="hidden" name="price" value={selectedPrice} />}
                  {selectedQuery && <input type="hidden" name="q" value={selectedQuery} />}
                  <CatalogSortSelectAuto
                    name="sort"
                    defaultValue={selectedSort}
                    className="catalog-sort-select-v2"
                    ariaLabel="Сортировка"
                    options={CATALOG_SORT_OPTIONS}
                  />
                </form>
                </div>
              </>
            ) : (
              <>
                <form className="catalog-search-form" method="get" action="/catalog" role="search" aria-label="Поиск в каталоге">
                  {selectedCategory !== "all" && <input type="hidden" name="cat" value={selectedCategory} />}
                  {selectedSort !== "popular" && <input type="hidden" name="sort" value={selectedSort} />}
                  {selectedBrand !== "all" && <input type="hidden" name="brand" value={selectedBrand} />}
                  {selectedPrice !== "all" && <input type="hidden" name="price" value={selectedPrice} />}
                  <input
                    type="search"
                    name="q"
                    defaultValue={selectedQuery}
                    placeholder="Поиск по названию"
                    className="catalog-search-input"
                    aria-label="Поиск по каталогу"
                  />
                  <button type="submit" className="catalog-search-btn">Найти</button>
                </form>
                {hasActiveFilters && (
                  <Link href={catalogRootHref} className="catalog-reset-link">
                    Сбросить фильтры
                  </Link>
                )}
                <ScrollFadeRow className="catalog-sort">
                  {CATALOG_SORT_OPTIONS.map((option) => (
                    <Link
                      key={option.value}
                      href={buildCatalogQuery({
                        cat: categoryQueryValue,
                        sort:
                          selectedSort === option.value
                            ? undefined
                            : option.value !== "popular"
                              ? option.value
                              : undefined,
                        brand: brandQueryValue,
                        price: selectedPrice !== "all" ? selectedPrice : undefined,
                        q: selectedQuery || undefined,
                        page: 1,
                      })}
                      aria-label={
                        selectedSort === option.value
                          ? `Снять сортировку: ${option.label}`
                          : `Применить сортировку: ${option.label}`
                      }
                      className={`catalog-sort-link${selectedSort === option.value ? " active" : ""}`}
                    >
                      {option.label}
                    </Link>
                  ))}
                </ScrollFadeRow>
              </>
            )}
          </div>

          {!isCatalogRedesign && querySuggestions.length > 0 && (
            <ScrollFadeRow className="catalog-chips">
              {querySuggestions.map((suggestion) => (
                <Link
                  key={suggestion}
                  href={buildCatalogQuery({
                    q: suggestion,
                    cat: categoryQueryValue,
                    sort: selectedSort !== "popular" ? selectedSort : undefined,
                    brand: brandQueryValue,
                    price: selectedPrice !== "all" ? selectedPrice : undefined,
                    page: 1,
                  })}
                  className="catalog-chip"
                >
                  {suggestion}
                </Link>
              ))}
            </ScrollFadeRow>
          )}

          {!isCatalogRedesign && (
            <>
              <ScrollFadeRow className="catalog-chips">
                <Link
                  href={buildCatalogQuery({
                    sort: selectedSort !== "popular" ? selectedSort : undefined,
                    brand: brandQueryValue,
                    price: selectedPrice !== "all" ? selectedPrice : undefined,
                    q: selectedQuery || undefined,
                    page: 1,
                  })}
                  className={`catalog-chip${selectedCategory === "all" ? " active" : ""}`}
                >
                  Все ({preCategoryByPriceProducts.length})
                </Link>
                {categories.map((category) => (
                  <Link
                    key={category}
                    href={buildCatalogQuery({
                      cat: selectedCategory === category ? undefined : category,
                      sort: selectedSort !== "popular" ? selectedSort : undefined,
                      brand: brandQueryValue,
                      price: selectedPrice !== "all" ? selectedPrice : undefined,
                      q: selectedQuery || undefined,
                      page: 1,
                    })}
                    aria-label={
                      selectedCategory === category
                        ? `Снять фильтр категории: ${category}`
                        : `Применить фильтр категории: ${category}`
                    }
                    className={`catalog-chip${selectedCategory === category ? " active" : ""}`}
                  >
                    {category} ({categoryCountMap.get(category) ?? 0})
                  </Link>
                ))}
              </ScrollFadeRow>

              <div className="catalog-filter-group">
                <p className="catalog-filter-title">Бренд</p>
                <ScrollFadeRow className="catalog-chips">
                  <Link
                    href={buildCatalogQuery({
                      cat: categoryQueryValue,
                      sort: selectedSort !== "popular" ? selectedSort : undefined,
                      price: selectedPrice !== "all" ? selectedPrice : undefined,
                      q: selectedQuery || undefined,
                      page: 1,
                    })}
                    className={`catalog-chip${selectedBrand === "all" ? " active" : ""}`}
                  >
                    Все бренды ({preBrandProducts.length})
                  </Link>
                  {brands.map((brand) => (
                    <Link
                      key={brand}
                      href={buildCatalogQuery({
                        cat: categoryQueryValue,
                        sort: selectedSort !== "popular" ? selectedSort : undefined,
                        brand: selectedBrand === brand ? undefined : brand,
                        price: selectedPrice !== "all" ? selectedPrice : undefined,
                        q: selectedQuery || undefined,
                        page: 1,
                      })}
                      aria-label={
                        selectedBrand === brand
                          ? `Снять фильтр бренда: ${brand}`
                          : `Применить фильтр бренда: ${brand}`
                      }
                      className={`catalog-chip${selectedBrand === brand ? " active" : ""}`}
                    >
                      {brand} ({brandCountMap.get(brand) ?? 0})
                    </Link>
                  ))}
                </ScrollFadeRow>
              </div>
            </>
          )}

          {!isCatalogRedesign && (
          <div className="catalog-filter-group">
            <p className="catalog-filter-title">Цена</p>
            <ScrollFadeRow className="catalog-chips">
              {CATALOG_PRICE_RANGES.map((range) => (
                <Link
                  key={range.value}
                  href={buildCatalogQuery({
                    cat: categoryQueryValue,
                    sort: selectedSort !== "popular" ? selectedSort : undefined,
                    brand: brandQueryValue,
                    price:
                      selectedPrice === range.value
                        ? undefined
                        : range.value !== "all"
                          ? range.value
                          : undefined,
                    q: selectedQuery || undefined,
                    page: 1,
                  })}
                  aria-label={
                    selectedPrice === range.value
                      ? `Снять фильтр цены: ${range.label}`
                      : `Применить фильтр цены: ${range.label}`
                  }
                  className={`catalog-chip${selectedPrice === range.value ? " active" : ""}`}
                >
                  {range.label} ({priceCountMap.get(range.value) ?? 0})
                </Link>
              ))}
            </ScrollFadeRow>
          </div>
          )}

          {!isCatalogRedesign && hasActiveFilters && (
            <div className="active-filters" role="status" aria-live="polite">
              <p className="active-filters-title">Активные фильтры:</p>
              <div className="active-filters-list">
                {activeFilterPills.map((pill) => (
                  <Link key={pill.key} href={pill.href} className="active-filter-item" aria-label={`Убрать фильтр: ${pill.label}`}>
                    {pill.label}
                    <span className="active-filter-remove" aria-hidden="true">×</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className={`catalog-grid${isCatalogRedesign ? " catalog-grid-v2" : ""}`}>
            {renderedProducts.map(({ product, category, brand, minPrice }) => {
              const productHref = isCatalogRedesign ? `/product/${product.handle}?v2=1` : `/product/${product.handle}`;
              const primaryPrice = toPrimaryUahPrice(minPrice);
              const usdPrice = minPrice?.currency !== "USD" ? getProductPriceByCurrency(product, "USD") : null;
              const secondaryUsdText = usdPrice
                ? `≈ ${usdPrice.amount.toLocaleString("ru-RU")} ${usdPrice.currency}`
                : minPrice && minPrice.currency !== "UAH"
                  ? `≈ ${minPrice.amount.toLocaleString("ru-RU")} ${minPrice.currency}`
                  : null;

              return (
              <article className={`product-card${isCatalogRedesign ? " product-card-v2" : ""}`} key={product.id}>
                <Link href={productHref} aria-label={`Открыть товар ${product.title}`}>
                  <div className={`product-image-wrap${isCatalogRedesign ? " product-image-wrap-v2" : ""}`}>
                    {product.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.thumbnail} alt={product.title} className="product-image" />
                    ) : (
                      <div className="product-image placeholder">IMIDGE</div>
                    )}
                  </div>
                </Link>

                {isCatalogRedesign ? (
                  <div className="catalog-card-body-v2">
                    <p className="product-kicker-v2">{brand || category}</p>
                    <h3 className="product-title-v2">
                      <Link href={productHref} aria-label={`Открыть товар ${product.title}`}>
                        {highlightTitle(product.title, selectedQuery)}
                      </Link>
                    </h3>
                    <div className="catalog-price-row-v2">
                      {primaryPrice && (
                        <span className="product-price-old-v2">
                          {`${Math.round(primaryPrice.amount * 1.2).toLocaleString("ru-RU")} ${primaryPrice.currency}`}
                        </span>
                      )}
                      <div className="catalog-price-main-v2">
                        <strong className="product-price-v2">
                          {primaryPrice ? `${primaryPrice.amount.toLocaleString("ru-RU")} ${primaryPrice.currency}` : "Цена уточняется"}
                        </strong>
                        {secondaryUsdText && <span className="product-price-secondary-v2">{secondaryUsdText}</span>}
                      </div>
                    </div>
                    <CatalogCardActions
                      href={productHref}
                      variantId={product.variants?.find((variant) =>
                        (variant.prices ?? []).some((price) => typeof price.amount === "number" && price.amount > 0)
                      )?.id}
                      wishlistItem={{
                        handle: product.handle,
                        title: product.title,
                        brand: brand || category || "Без бренда",
                        thumbnail: product.thumbnail,
                        priceText: minPrice ? `${minPrice.amount.toLocaleString("ru-RU")} ${minPrice.currency}` : undefined,
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <p className="hero-kicker">{category}</p>
                    <h3>
                      <Link href={productHref} aria-label={`Открыть товар ${product.title}`}>
                        {highlightTitle(product.title, selectedQuery)}
                      </Link>
                    </h3>
                    <p className="product-handle">/{product.handle}</p>
                    <p className="product-price">
                      {primaryPrice ? `${primaryPrice.amount.toLocaleString("ru-RU")} ${primaryPrice.currency}` : "Цена уточняется"}
                    </p>
                    {secondaryUsdText && <p className="product-price-secondary">{secondaryUsdText}</p>}
                    <Link href={productHref} className="cta-btn product-btn">
                      Открыть товар
                    </Link>
                  </>
                )}
              </article>
              );
            })}
          </div>

          {isCatalogRedesign && totalPages > 1 && (
            <div className="catalog-more-v2">
              {hasNextPage && (
                <Link
                  href={buildCatalogQuery({
                    cat: categoryQueryValue,
                    sort: selectedSort !== "popular" ? selectedSort : undefined,
                    brand: brandQueryValue,
                    price: selectedPrice !== "all" ? selectedPrice : undefined,
                    q: selectedQuery || undefined,
                    page: currentPage + 1,
                  })}
                  className="catalog-more-btn-v2"
                >
                  Показать ещё товары
                </Link>
              )}
              <p className="catalog-more-info-v2">
                Показано {shownProductsCount} из {visibleProducts.length} · {CATALOG_PAGE_SIZE} {pluralizeRuItems(CATALOG_PAGE_SIZE)} на странице
              </p>
            </div>
          )}

          {totalPages > 1 && (
            isCatalogRedesign ? (
              <div className="catalog-pagination-wrap-v2">
                <nav className="catalog-pagination catalog-pagination-v2" aria-label="Пагинация каталога">
                  {v2PageItems.map((item, index) => (
                    typeof item === "number" ? (
                      <Link
                        key={`page-${item}`}
                        href={buildCatalogQuery({
                          cat: categoryQueryValue,
                          sort: selectedSort !== "popular" ? selectedSort : undefined,
                          brand: brandQueryValue,
                          price: selectedPrice !== "all" ? selectedPrice : undefined,
                          q: selectedQuery || undefined,
                          page: item,
                        })}
                        aria-current={item === currentPage ? "page" : undefined}
                        className={`pagination-link pagination-link-v2${item === currentPage ? " active" : ""}`}
                      >
                        {item}
                      </Link>
                    ) : (
                      <span key={`${item}-${index}`} className="pagination-ellipsis-v2" aria-hidden="true">…</span>
                    )
                  ))}
                </nav>
              </div>
            ) : (
              <nav className="catalog-pagination" aria-label="Пагинация каталога">
                {currentPage > 1 ? (
                  <Link
                    href={buildCatalogQuery({
                      cat: categoryQueryValue,
                      sort: selectedSort !== "popular" ? selectedSort : undefined,
                      brand: brandQueryValue,
                      price: selectedPrice !== "all" ? selectedPrice : undefined,
                      q: selectedQuery || undefined,
                      page: currentPage - 1,
                    })}
                    rel="prev"
                    className="pagination-link"
                  >
                    Назад
                  </Link>
                ) : (
                  <span className="pagination-link disabled">Назад</span>
                )}

                {pageNumbers.map((pageNumber) => (
                  <Link
                    key={pageNumber}
                    href={buildCatalogQuery({
                      cat: categoryQueryValue,
                      sort: selectedSort !== "popular" ? selectedSort : undefined,
                      brand: brandQueryValue,
                      price: selectedPrice !== "all" ? selectedPrice : undefined,
                      q: selectedQuery || undefined,
                      page: pageNumber,
                    })}
                    aria-current={pageNumber === currentPage ? "page" : undefined}
                    className={`pagination-link${pageNumber === currentPage ? " active" : ""}`}
                  >
                    {pageNumber}
                  </Link>
                ))}

                {currentPage < totalPages ? (
                  <Link
                    href={buildCatalogQuery({
                      cat: categoryQueryValue,
                      sort: selectedSort !== "popular" ? selectedSort : undefined,
                      brand: brandQueryValue,
                      price: selectedPrice !== "all" ? selectedPrice : undefined,
                      q: selectedQuery || undefined,
                      page: currentPage + 1,
                    })}
                    rel="next"
                    className="pagination-link"
                  >
                    Вперёд
                  </Link>
                ) : (
                  <span className="pagination-link disabled">Вперёд</span>
                )}
              </nav>
            )
          )}

            {visibleProducts.length === 0 && (
              <div className="empty-state">
                {selectedQuery
                  ? (
                    <>
                      По запросу «{selectedQuery}» ничего не найдено. {" "}
                      <Link
                        href={buildCatalogQuery({
                          cat: categoryQueryValue,
                          sort: selectedSort !== "popular" ? selectedSort : undefined,
                          brand: brandQueryValue,
                          price: selectedPrice !== "all" ? selectedPrice : undefined,
                          page: 1,
                        })}
                      >
                        Сбросить только поиск
                      </Link>
                    </>
                  )
                  : "Товары пока не найдены. Проверьте, что backend Medusa запущен и данные засидены."}
              </div>
            )}
            </div>
          </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
