"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { matchesQuery, rankProductsByQuery } from "@/lib/catalog-search";

type SearchItem = {
  id: string;
  title: string;
  handle: string;
  thumbnail?: string | null;
  brand: string;
  category: string;
};

type CatalogSearchClientProps = {
  initialQuery: string;
  items: SearchItem[];
};

export function CatalogSearchClient({ initialQuery, items }: CatalogSearchClientProps) {
  const [inputQuery, setInputQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputQuery.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [inputQuery]);

  const filteredItems = useMemo(() => {
    if (!debouncedQuery) {
      return [];
    }

    const subset = items.filter((item) => {
      return matchesQuery(
        {
          title: item.title,
          handle: item.handle,
          brand: item.brand,
          category: item.category,
        },
        debouncedQuery
      );
    });

    return rankProductsByQuery(subset, debouncedQuery).slice(0, 24);
  }, [debouncedQuery, items]);

  return (
    <>
      <div className="catalog-toolbar" style={{ marginTop: 8 }}>
        <form className="catalog-search-form" role="search" onSubmit={(event) => event.preventDefault()}>
          <input
            type="search"
            className="catalog-search-input"
            placeholder="Например: BMW, Breguet, Model"
            value={inputQuery}
            onChange={(event) => setInputQuery(event.target.value)}
            aria-label="Поиск товаров"
          />
          <button type="button" className="catalog-search-btn" onClick={() => setInputQuery("")}>Очистить</button>
        </form>
      </div>

      {!debouncedQuery && (
        <p className="section-subtitle">Начните вводить запрос: название, бренд или артикул.</p>
      )}

      {debouncedQuery && filteredItems.length === 0 && (
        <p className="section-subtitle">По запросу «{debouncedQuery}» ничего не найдено.</p>
      )}

      {filteredItems.length > 0 && (
        <>
          <p className="catalog-count">Найдено: {filteredItems.length}</p>
          <div className="catalog-grid">
            {filteredItems.map((item) => (
              <article className="product-card" key={item.id}>
                <p className="hero-kicker" style={{ marginBottom: 8 }}>{item.brand}</p>
                <Link href={`/product/${item.handle}`} aria-label={`Открыть товар ${item.title}`}>
                  <div className="product-image-wrap">
                    {item.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnail} alt={item.title} className="product-image" />
                    ) : (
                      <div className="product-image placeholder">IMIDGE</div>
                    )}
                  </div>
                </Link>

                <h3>
                  <Link href={`/product/${item.handle}`} aria-label={`Открыть товар ${item.title}`}>
                    {item.title}
                  </Link>
                </h3>
                <p className="product-handle">/{item.handle}</p>
                <Link href={`/product/${item.handle}`} className="cta-btn product-btn">Открыть товар</Link>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
