"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  clearCurrentCart,
  deleteCartLineItem,
  updateCartLineItemQuantity,
} from "@/lib/medusa-browser";
import { useCartStore } from "@/components/cart-store-provider";
import { useToast } from "@/components/toast-provider";

type CartItem = {
  id: string;
  title: string;
  quantity: number;
  unit_price?: number;
  subtotal?: number;
  total?: number;
  variant_title?: string | null;
};

type Cart = {
  currency_code: string;
  subtotal?: number;
  total?: number;
  items?: CartItem[];
};

function money(value = 0, currency = "usd") {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(value);
}

export function CartPageClient() {
  const { cart, loading, refreshCart, setCartSnapshot } = useCartStore();
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const { notify } = useToast();

  useEffect(() => {
    refreshCart().catch(() => null);
  }, [refreshCart]);

  const items = useMemo(() => cart?.items ?? [], [cart]);

  const onChangeQuantity = async (item: CartItem, nextQty: number) => {
    if (nextQty < 1 || busyItemId) {
      return;
    }

    setBusyItemId(item.id);
    try {
      const updatedCart = await updateCartLineItemQuantity(item.id, nextQty);
      setCartSnapshot(updatedCart as Cart | null);
    } catch {
      notify({
        type: "error",
        message: "Не удалось обновить количество.",
        actionLabel: "Повторить",
        onAction: () => onChangeQuantity(item, nextQty),
        durationMs: 6200,
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const onRemove = async (item: CartItem) => {
    if (busyItemId) {
      return;
    }

    setBusyItemId(item.id);
    try {
      const updatedCart = await deleteCartLineItem(item.id);
      setCartSnapshot(updatedCart as Cart | null);
      notify({
        type: "success",
        message: "Товар удалён из корзины.",
      });
    } catch {
      notify({
        type: "error",
        message: "Не удалось удалить товар из корзины.",
        actionLabel: "Повторить",
        onAction: () => onRemove(item),
        durationMs: 6200,
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const onClearCart = async () => {
    if (busyItemId) {
      return;
    }

    setBusyItemId("__clear__");

    try {
      const clearedCart = await clearCurrentCart();
      setCartSnapshot(clearedCart as Cart | null);
      notify({
        type: "success",
        message: "Корзина очищена.",
      });
    } catch {
      notify({
        type: "error",
        message: "Не удалось очистить корзину.",
        actionLabel: "Повторить",
        onAction: onClearCart,
        durationMs: 6200,
      });
    } finally {
      setBusyItemId(null);
    }
  };

  return (
    <>
      <h1 className="section-title">Корзина</h1>

      {loading && (
        <p className="section-subtitle" role="status" aria-live="polite">
          Загружаем корзину...
        </p>
      )}

      {!loading && items.length === 0 && (
        <div className="empty-state">
          Корзина пока пуста. <Link href="/catalog">Перейти в каталог</Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="cart-layout">
          <div className="cart-items">
            {items.map((item) => (
              <article className="cart-item" key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <p className="product-handle">{item.variant_title || "Default"}</p>

                  <div className="qty-controls">
                    <button
                      type="button"
                      className="qty-btn"
                      aria-label={`Уменьшить количество ${item.title}`}
                      onClick={() => onChangeQuantity(item, item.quantity - 1)}
                      disabled={busyItemId === item.id || item.quantity <= 1}
                    >
                      −
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button
                      type="button"
                      className="qty-btn"
                      aria-label={`Увеличить количество ${item.title}`}
                      onClick={() => onChangeQuantity(item, item.quantity + 1)}
                      disabled={busyItemId === item.id}
                    >
                      +
                    </button>

                    <button
                      type="button"
                      className="remove-btn"
                      aria-label={`Удалить ${item.title} из корзины`}
                      onClick={() => onRemove(item)}
                      disabled={busyItemId === item.id}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
                <div className="cart-item-meta">
                  <span>× {item.quantity}</span>
                  <span>{money(item.total ?? item.subtotal ?? (item.unit_price ?? 0) * item.quantity, cart?.currency_code)}</span>
                </div>
              </article>
            ))}
          </div>

          <aside className="cart-summary">
            <h3>Итого</h3>
            <p>
              Сумма: <strong>{money(cart?.subtotal, cart?.currency_code)}</strong>
            </p>
            <p>
              К оплате: <strong>{money(cart?.total, cart?.currency_code)}</strong>
            </p>
            <button type="button" className="secondary-btn" onClick={onClearCart} disabled={Boolean(busyItemId)}>
              {busyItemId === "__clear__" ? "Очищаем..." : "Очистить корзину"}
            </button>
            <Link href="/checkout" className="cta-btn checkout-btn">
              {busyItemId ? "Обновляем корзину..." : "Оформить заказ"}
            </Link>
          </aside>
        </div>
      )}
    </>
  );
}
