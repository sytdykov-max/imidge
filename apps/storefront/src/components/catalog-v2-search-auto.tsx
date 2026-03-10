"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CatalogV2SearchAutoProps = {
  initialQuery: string;
  selectedCategories: string[];
  selectedBrands: string[];
  selectedPrice: string;
  selectedSort: string;
  debounceMs?: number;
};

export function CatalogV2SearchAuto({
  initialQuery,
  selectedCategories,
  selectedBrands,
  selectedPrice,
  selectedSort,
  debounceMs = 350,
}: CatalogV2SearchAutoProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalizedInitial = initialQuery.trim();
      const normalizedNext = query.trim();

      if (normalizedInitial === normalizedNext) {
        return;
      }

      const params = new URLSearchParams();
      params.set("v2", "1");

      for (const category of selectedCategories) {
        if (category !== "all") {
          params.append("cat", category);
        }
      }

      for (const brand of selectedBrands) {
        if (brand !== "all") {
          params.append("brand", brand);
        }
      }

      if (selectedPrice !== "all") {
        params.set("price", selectedPrice);
      }

      if (selectedSort !== "popular") {
        params.set("sort", selectedSort);
      }

      if (normalizedNext) {
        params.set("q", normalizedNext);
      }

      router.push(`/catalog?${params.toString()}`);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, initialQuery, query, router, selectedBrands, selectedCategories, selectedPrice, selectedSort]);

  return (
    <div className="catalog-search-form-v2" role="search" aria-label="Поиск в каталоге">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Поиск по названию"
        className="catalog-search-input-v2"
        aria-label="Поиск по названию"
      />
    </div>
  );
}
