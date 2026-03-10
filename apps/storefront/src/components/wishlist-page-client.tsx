"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  clearWishlist,
  getWishlistItems,
  getWishlistUpdateEventName,
  removeFromWishlist,
  type WishlistItem,
} from "@/lib/wishlist";

type ProductLike = WishlistItem & { id: string };

export function WishlistPageClient() {
  const [items, setItems] = useState<ProductLike[]>([]);

  useEffect(() => {
    const sync = () => {
      const nextItems = getWishlistItems().map((item, index) => ({
        ...item,
        id: `${item.handle}-${index}`,
      }));
      setItems(nextItems);
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(getWishlistUpdateEventName(), sync as EventListener);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(getWishlistUpdateEventName(), sync as EventListener);
    };
  }, []);

  const onRemove = (handle: string) => {
    removeFromWishlist(handle);
    setItems((current) => current.filter((item) => item.handle !== handle));
  };

  const onClear = () => {
    clearWishlist();
    setItems([]);
  };

  return (
    <>
      <div className="wishlist-header">
        <h1 className="section-title">Избранное</h1>
        {items.length > 0 && (
          <button type="button" className="secondary-btn" onClick={onClear}>
            Очистить избранное
          </button>
        )}
      </div>

      {items.length === 0 && (
        <div className="empty-state">
          В избранном пока пусто. <Link href="/catalog?v2=1">Перейти в каталог</Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="catalog-grid catalog-grid-v2">
          {items.map((item) => (
            <article className="product-card product-card-v2" key={item.id}>
              <div className="product-image-wrap product-image-wrap-v2">
                {item.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnail} alt={item.title} className="product-image" />
                ) : (
                  <div className="product-image placeholder">IMIDGE</div>
                )}
              </div>

              <div className="catalog-card-body-v2">
                <p className="product-kicker-v2">Избранное</p>
                <h3 className="product-title-v2">{item.title}</h3>
                {item.priceText ? (
                  <div className="catalog-price-row-v2">
                    <strong className="product-price-v2">{item.priceText}</strong>
                  </div>
                ) : null}
                <div className="catalog-actions-v2">
                  <Link href={`/product/${item.handle}?v2=1`} className="catalog-btn-v2 primary">
                    Открыть
                  </Link>
                  <button type="button" className="catalog-btn-v2" onClick={() => onRemove(item.handle)}>
                    Удалить
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
