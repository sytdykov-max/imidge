"use client";

import { useMemo, useState } from "react";

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
  selectedPrice: string;
  selectedSort: string;
  selectedQuery: string;
  categoryOptions: FilterOption[];
  brandOptions: FilterOption[];
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
  selectedPrice,
  selectedSort,
  selectedQuery,
  categoryOptions,
  brandOptions,
  priceOptions,
  priceFromValue,
  priceToValue,
}: CatalogV2FilterFormProps) {
  const [categoryValues, setCategoryValues] = useState<string[]>(normalizeSelected(selectedCategories));
  const [brandValues, setBrandValues] = useState<string[]>(normalizeSelected(selectedBrands));

  const categorySet = useMemo(() => new Set(categoryValues), [categoryValues]);
  const brandSet = useMemo(() => new Set(brandValues), [brandValues]);

  const toggleGroupValue = (
    currentValues: string[],
    nextValue: string,
    setValues: (values: string[]) => void
  ) => {
    if (nextValue === "all") {
      setValues(["all"]);
      return;
    }

    const withoutAll = currentValues.filter((value) => value !== "all");
    const exists = withoutAll.includes(nextValue);
    const nextValues = exists
      ? withoutAll.filter((value) => value !== nextValue)
      : [...withoutAll, nextValue];

    setValues(nextValues.length > 0 ? nextValues : ["all"]);
  };

  return (
    <form className="catalog-v2-filter-form" method="get" action="/catalog" aria-label="Фильтры каталога">
      <input type="hidden" name="v2" value="1" />
      {selectedSort !== "popular" && <input type="hidden" name="sort" value={selectedSort} />}
      {selectedQuery && <input type="hidden" name="q" value={selectedQuery} />}
      <input type="hidden" name="page" value="1" />

      <div className="catalog-v2-group">
        <p>Категория</p>
        <div className="catalog-v2-checks" role="list">
          {categoryOptions.map((option) => {
            const checked = categorySet.has(option.value);

            return (
              <label key={option.value} className={`catalog-v2-check${checked ? " active" : ""}`}>
                <input
                  type="checkbox"
                  name="cat"
                  value={option.value}
                  checked={checked}
                  onChange={() => toggleGroupValue(categoryValues, option.value, setCategoryValues)}
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
                  name="brand"
                  value={option.value}
                  checked={checked}
                  onChange={() => toggleGroupValue(brandValues, option.value, setBrandValues)}
                />
                <span className="catalog-v2-checkbox" aria-hidden="true" />
                <span>{option.label} ({option.count})</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="catalog-v2-group">
        <p>Диапазон</p>
        <div className="catalog-v2-links">
          {priceOptions.map((option) => (
            <label key={option.value} className={`catalog-v2-check${selectedPrice === option.value ? " active" : ""}`}>
              <input type="radio" name="price" value={option.value} defaultChecked={selectedPrice === option.value} />
              <span className="catalog-v2-checkbox" aria-hidden="true" />
              <span>{option.label} ({option.count})</span>
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="catalog-v2-apply-btn">
        Применить
      </button>
    </form>
  );
}
