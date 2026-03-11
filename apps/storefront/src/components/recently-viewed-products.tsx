"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type RecentlyViewedItem = {
  handle: string;
  title: string;
  brand: string;
  category?: string;
  thumbnail?: string | null;
  priceText?: string;
  oldPriceText?: string;
  variantId?: string;
};

type RecentlyViewedProductsProps = {
  currentItem: RecentlyViewedItem;
  isProductRedesign: boolean;
};

const STORAGE_KEY = "imidge_recently_viewed_products_v1";
const MAX_STORED = 20;
const MAX_RENDERED = 4;

function sanitizeItems(raw: unknown): RecentlyViewedItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seen = new Set<string>();
  const result: RecentlyViewedItem[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const handle = typeof (entry as { handle?: unknown }).handle === "string"
      ? (entry as { handle: string }).handle.trim()
      : "";
    const title = typeof (entry as { title?: unknown }).title === "string"
      ? (entry as { title: string }).title.trim()
      : "";
    const brand = typeof (entry as { brand?: unknown }).brand === "string"
      ? (entry as { brand: string }).brand.trim()
      : "";
    const category = typeof (entry as { category?: unknown }).category === "string"
      ? (entry as { category: string }).category.trim()
      : "";
    const thumbnail = typeof (entry as { thumbnail?: unknown }).thumbnail === "string"
      ? (entry as { thumbnail: string }).thumbnail
      : null;
    const priceText = typeof (entry as { priceText?: unknown }).priceText === "string"
      ? (entry as { priceText: string }).priceText.trim()
      : "";
    const oldPriceText = typeof (entry as { oldPriceText?: unknown }).oldPriceText === "string"
      ? (entry as { oldPriceText: string }).oldPriceText.trim()
      : "";
    const variantId = typeof (entry as { variantId?: unknown }).variantId === "string"
      ? (entry as { variantId: string }).variantId.trim()
      : "";

    if (!handle || !title || seen.has(handle)) {
      continue;
    }

    seen.add(handle);
    result.push({
      handle,
      title,
      brand: brand || "Без бренда",
      category: category || "",
      thumbnail,
      priceText: priceText || undefined,
      oldPriceText: oldPriceText || undefined,
      variantId: variantId || undefined,
    });
  }

  return result;
}

export function RecentlyViewedProducts({ currentItem, isProductRedesign }: RecentlyViewedProductsProps) {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const existing = sanitizeItems(parsed);

      const next = [currentItem, ...existing.filter((item) => item.handle !== currentItem.handle)].slice(0, MAX_STORED);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setItems(next.filter((item) => item.handle !== currentItem.handle).slice(0, MAX_RENDERED));
    } catch {
      setItems([]);
    }
  }, [currentItem]);

  const viewedItems = useMemo(() => {
    const sameBrand = currentItem.brand.trim().toLowerCase();
    const sameCategory = (currentItem.category ?? "").trim().toLowerCase();

    return items
      .filter((item) => item.handle !== currentItem.handle)
      .map((item) => {
        const brand = item.brand.trim().toLowerCase();
        const category = (item.category ?? "").trim().toLowerCase();

        let score = 0;
        if (sameBrand && brand === sameBrand) {
          score += 2;
        }
        if (sameCategory && category === sameCategory) {
          score += 1;
        }

        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
      .slice(0, MAX_RENDERED);
  }, [currentItem.brand, currentItem.category, currentItem.handle, items]);

  if (viewedItems.length === 0) {
    return null;
  }

  return (
    <div className={isProductRedesign ? "product-related-v2" : undefined}>
      {isProductRedesign ? (
        <h2 className="product-related-title-v2">Просмотренные товары</h2>
      ) : (
        <p className="hero-kicker">Просмотренные товары</p>
      )}

      <div className={`catalog-grid${isProductRedesign ? " catalog-grid-v2 product-related-grid-v2" : ""}`}>
        {viewedItems.map((item) => (
          <article className={`product-card${isProductRedesign ? " product-card-v2" : ""}`} key={item.handle}>
            <Link
              href={isProductRedesign ? `/product/${item.handle}?v2=1` : `/product/${item.handle}`}
              aria-label={`Открыть товар ${item.title}`}
            >
              <div className={`product-image-wrap${isProductRedesign ? " product-image-wrap-v2" : ""}`}>
                {item.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnail} alt={item.title} className="product-image" />
                ) : (
                  <div className="product-image placeholder">IMIDGE</div>
                )}
              </div>
            </Link>

            {isProductRedesign ? (
              <div className="catalog-card-body-v2 catalog-card-body-v2-simple">
                <h3 className="product-title-v2">
                  <Link
                    href={`/product/${item.handle}?v2=1`}
                    aria-label={`Открыть товар ${item.title}`}
                  >
                    {item.title}
                  </Link>
                </h3>
                <div className="catalog-price-row-v2">
                  {item.oldPriceText && <span className="product-price-old-v2">{item.oldPriceText}</span>}
                  <strong className="product-price-v2">{item.priceText || "Цена уточняется"}</strong>
                </div>
              </div>
            ) : (
              <>
                <p className="hero-kicker">{item.brand}</p>
                <h3>
                  <Link href={`/product/${item.handle}`} aria-label={`Открыть товар ${item.title}`}>
                    {item.title}
                  </Link>
                </h3>
                <p className="product-handle">/{item.handle}</p>
                <Link href={`/product/${item.handle}`} className="cta-btn product-btn">
                  Открыть товар
                </Link>
              </>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
