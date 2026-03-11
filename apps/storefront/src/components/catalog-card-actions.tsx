"use client";

import { useState } from "react";
import Link from "next/link";
import { addVariantToCart } from "@/lib/medusa-browser";
import { useCartStore } from "@/components/cart-store-provider";
import { useToast } from "@/components/toast-provider";
import { WishlistToggleButton } from "@/components/wishlist-toggle-button";

type Props = {
  href: string;
  variantId?: string;
  wishlistItem: {
    handle: string;
    title: string;
    brand?: string;
    thumbnail?: string | null;
    priceText?: string;
  };
};

export function CatalogCardActions({ href, variantId, wishlistItem }: Props) {
  const [loading, setLoading] = useState(false);
  const { optimisticAdjustItemCount, setCartSnapshot } = useCartStore();
  const { notify } = useToast();

  const onAddToCart = async () => {
    if (!variantId || loading) {
      return;
    }

    setLoading(true);
    const rollbackOptimisticCount = optimisticAdjustItemCount(1);

    try {
      const cart = await addVariantToCart(variantId, 1);
      setCartSnapshot(cart);
      notify({
        type: "success",
        message: "Товар добавлен в корзину",
      });
    } catch (error) {
      rollbackOptimisticCount();
      const errorMessage =
        error instanceof Error && error.message ? error.message : "Не удалось добавить товар";

      notify({
        type: "error",
        message: `Не удалось добавить товар (${errorMessage})`,
        durationMs: 6200,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="catalog-actions-block-v2">
      <div className="catalog-actions-v2 catalog-actions-v2-top">
        <WishlistToggleButton mode="catalogInline" item={wishlistItem} />
        <Link href={href} className="catalog-btn-v2">
          Подробнее
        </Link>
      </div>

      <button
        type="button"
        className="catalog-btn-v2 primary catalog-btn-v2-large"
        onClick={onAddToCart}
        disabled={!variantId || loading}
      >
        {loading ? "Добавляем..." : variantId ? "Добавить в корзину" : "Нет в наличии"}
      </button>
    </div>
  );
}
