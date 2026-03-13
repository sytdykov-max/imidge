"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type FilterOption = {
  value: string;
  label: string;
  count: number;
};

type PriceOption = {
  value: string;
  label: string;
  count: number;
};

type CatalogV2FilterFormProps = {
  selectedCategories: string[];
  selectedBrands: string[];
  selectedAvailabilities: string[];
  selectedPriceRanges: string[];
  selectedExtraFilters: Record<string, string[]>;
  selectedPrice: string;
  selectedSort: string;
  selectedQuery: string;
  categoryOptions: FilterOption[];
  brandOptions: FilterOption[];
  availabilityOptions: FilterOption[];
  priceRangeOptions: FilterOption[];
  extraFacetGroups: Array<{
    key: string;
    label: string;
    options: FilterOption[];
  }>;
  priceOptions: PriceOption[];
  priceFromValue: number;
  priceToValue: number;
};

function normalizeSelected(values: string[]) {
  const cleaned = values.filter(Boolean);
  if (cleaned.length === 0 || cleaned.includes("all")) {
    return ["all"];
  }

  return cleaned;
}

export function CatalogV2FilterForm({
  selectedCategories,
  selectedBrands,
  selectedAvailabilities,
  selectedPriceRanges,
  selectedExtraFilters,
  selectedPrice,
  selectedSort,
  selectedQuery,
  categoryOptions,
  brandOptions,
  availabilityOptions,
  priceRangeOptions,
  extraFacetGroups,
  priceOptions,
  priceFromValue,
  priceToValue,
}: CatalogV2FilterFormProps) {
  const router = useRouter();
  const [categoryValues, setCategoryValues] = useState<string[]>(normalizeSelected(selectedCategories));
  const [brandValues, setBrandValues] = useState<string[]>(normalizeSelected(selectedBrands));
  const [availabilityValues, setAvailabilityValues] = useState<string[]>(normalizeSelected(selectedAvailabilities));
  const [priceRangeValues, setPriceRangeValues] = useState<string[]>(normalizeSelected(selectedPriceRanges));
  const [extraFacetValues, setExtraFacetValues] = useState<Record<string, string[]>>(() => {
    const normalized: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(selectedExtraFilters)) {
      const cleaned = normalizeSelected(values);
      if (!cleaned.includes("all")) {
        normalized[key] = cleaned;
      }
    }
    return normalized;
  });

  const categorySet = useMemo(() => new Set(categoryValues), [categoryValues]);
  const brandSet = useMemo(() => new Set(brandValues), [brandValues]);
  const availabilitySet = useMemo(() => new Set(availabilityValues), [availabilityValues]);
  const priceRangeSet = useMemo(() => new Set(priceRangeValues), [priceRangeValues]);
  const extraFacetSets = useMemo(() => {
    const result: Record<string, Set<string>> = {};
    for (const [key, values] of Object.entries(extraFacetValues)) {
      result[key] = new Set(values);
    }
    return result;
  }, [extraFacetValues]);

  const toggleGroupValue = (
    currentValues: string[],
    nextValue: string,
    setValues: (values: string[]) => void
  ) => {
    if (nextValue === "all") {
      const values = ["all"];
      setValues(values);
      return values;
    }

    const withoutAll = currentValues.filter((value) => value !== "all");
    const exists = withoutAll.includes(nextValue);
    const nextValues = exists
      ? withoutAll.filter((value) => value !== nextValue)
      : [...withoutAll, nextValue];

    const values = nextValues.length > 0 ? nextValues : ["all"];
    setValues(values);
    return values;
  };

  const applyFilters = (next: {
    categories?: string[];
    brands?: string[];
    availabilities?: string[];
    priceRanges?: string[];
    extraFilters?: Record<string, string[]>;
    price?: string;
  }) => {
    const params = new URLSearchParams();
    params.set("v2", "1");

    const categories = (next.categories ?? categoryValues).filter((value) => value !== "all");
    const brands = (next.brands ?? brandValues).filter((value) => value !== "all");
    const availabilities = (next.availabilities ?? availabilityValues).filter((value) => value !== "all");
    const priceRanges = (next.priceRanges ?? priceRangeValues).filter((value) => value !== "all");
    const extraFilters = next.extraFilters ?? extraFacetValues;
    const price = next.price ?? selectedPrice;

    for (const value of categories) {
      params.append("cat", value);
    }

    for (const value of brands) {
      params.append("brand", value);
    }

    for (const value of availabilities) {
      params.append("availability", value);
    }

    for (const value of priceRanges) {
      params.append("price_range", value);
    }

    for (const [key, values] of Object.entries(extraFilters)) {
      if (!key.startsWith("filter_")) {
        continue;
      }

      for (const value of values) {
        if (value && value !== "all") {
          params.append(key, value);
        }
      }
    }

    if (price !== "all") {
      params.set("price", price);
    }

    if (selectedSort !== "popular") {
      params.set("sort", selectedSort);
    }

    if (selectedQuery) {
      params.set("q", selectedQuery);
    }

    router.push(`/catalog?${params.toString()}`);
  };

  return (
    <div className="catalog-v2-filter-form" aria-label="Фильтры каталога" role="group">

      <div className="catalog-v2-group">
        <p>Категория</p>
        <div className="catalog-v2-checks" role="list">
          {categoryOptions.map((option) => {
            const checked = categorySet.has(option.value);

            return (
              <label key={option.value} className={`catalog-v2-check${checked ? " active" : ""}`}>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={checked}
                  onChange={() => {
                    const nextValues = toggleGroupValue(categoryValues, option.value, setCategoryValues);
                    applyFilters({ categories: nextValues });
                  }}
                />
                <span className="catalog-v2-checkbox" aria-hidden="true" />
                <span>{option.label} ({option.count})</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="catalog-v2-group">
        <p>Цена, грн</p>
        <div className="catalog-v2-range" role="group" aria-label="Диапазон цен">
          <input readOnly value={priceFromValue.toLocaleString("ru-RU")} aria-label="Цена от" />
          <span className="catalog-v2-range-sep" aria-hidden="true">—</span>
          <input readOnly value={priceToValue.toLocaleString("ru-RU")} aria-label="Цена до" />
        </div>
      </div>

      <div className="catalog-v2-group">
        <p>Бренд</p>
        <div className="catalog-v2-checks" role="list">
          {brandOptions.map((option) => {
            const checked = brandSet.has(option.value);

            return (
              <label key={option.value} className={`catalog-v2-check${checked ? " active" : ""}`}>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={checked}
                  onChange={() => {
                    const nextValues = toggleGroupValue(brandValues, option.value, setBrandValues);
                    applyFilters({ brands: nextValues });
                  }}
                />
                <span className="catalog-v2-checkbox" aria-hidden="true" />
                <span>{option.label} ({option.count})</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="catalog-v2-group">
        <p>Наличие</p>
        <div className="catalog-v2-checks" role="list">
          {availabilityOptions.map((option) => {
            const checked = availabilitySet.has(option.value);

            return (
              <label key={option.value} className={`catalog-v2-check${checked ? " active" : ""}`}>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={checked}
                  onChange={() => {
                    const nextValues = toggleGroupValue(availabilityValues, option.value, setAvailabilityValues);
                    applyFilters({ availabilities: nextValues });
                  }}
                />
                <span className="catalog-v2-checkbox" aria-hidden="true" />
                <span>{option.label} ({option.count})</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="catalog-v2-group">
        <p>Ценовой сегмент</p>
        <div className="catalog-v2-checks" role="list">
          {priceRangeOptions.map((option) => {
            const checked = priceRangeSet.has(option.value);

            return (
              <label key={option.value} className={`catalog-v2-check${checked ? " active" : ""}`}>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={checked}
                  onChange={() => {
                    const nextValues = toggleGroupValue(priceRangeValues, option.value, setPriceRangeValues);
                    applyFilters({ priceRanges: nextValues });
                  }}
                />
                <span className="catalog-v2-checkbox" aria-hidden="true" />
                <span>{option.label} ({option.count})</span>
              </label>
            );
          })}
        </div>
      </div>

      {extraFacetGroups.map((group) => {
        const currentValues = extraFacetValues[group.key] ?? ["all"];
        const currentSet = extraFacetSets[group.key] ?? new Set<string>(["all"]);

        return (
          <div className="catalog-v2-group" key={group.key}>
            <p>{group.label}</p>
            <div className="catalog-v2-checks" role="list">
              {group.options.map((option) => {
                const checked = currentSet.has(option.value);

                return (
                  <label key={option.value} className={`catalog-v2-check${checked ? " active" : ""}`}>
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={checked}
                      onChange={() => {
                        const nextValues = toggleGroupValue(currentValues, option.value, (values) => {
                          setExtraFacetValues((prev) => {
                            const nextMap = { ...prev };
                            if (values.includes("all")) {
                              delete nextMap[group.key];
                            } else {
                              nextMap[group.key] = values;
                            }
                            return nextMap;
                          });
                        });

                        const nextExtraFilters = { ...extraFacetValues };
                        if (nextValues.includes("all")) {
                          delete nextExtraFilters[group.key];
                        } else {
                          nextExtraFilters[group.key] = nextValues;
                        }

                        applyFilters({ extraFilters: nextExtraFilters });
                      }}
                    />
                    <span className="catalog-v2-checkbox" aria-hidden="true" />
                    <span>{option.label} ({option.count})</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="catalog-v2-group">
        <p>Диапазон</p>
        <div className="catalog-v2-links">
          {priceOptions.map((option) => (
            <label key={option.value} className={`catalog-v2-check${selectedPrice === option.value ? " active" : ""}`}>
              <input
                type="radio"
                value={option.value}
                defaultChecked={selectedPrice === option.value}
                onChange={() => applyFilters({ price: option.value })}
              />
              <span className="catalog-v2-checkbox" aria-hidden="true" />
              <span>{option.label} ({option.count})</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
