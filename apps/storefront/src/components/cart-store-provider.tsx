"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { consumeCartNotice, getCurrentCart } from "@/lib/medusa-browser";
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

type CartStoreContextValue = {
  cart: Cart | null;
  itemCount: number;
  loading: boolean;
  refreshCart: () => Promise<void>;
  setCartSnapshot: (nextCart: Cart | null) => void;
  optimisticAdjustItemCount: (delta: number) => () => void;
};

const CartStoreContext = createContext<CartStoreContextValue | null>(null);

function getItemCount(cart: Cart | null): number {
  return (cart?.items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}

export function CartStoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimisticDelta, setOptimisticDelta] = useState(0);
  const { notify } = useToast();

  const refreshCart = useCallback(async () => {
    const nextCart = (await getCurrentCart()) as Cart | null;
    setCart(nextCart);
    setOptimisticDelta(0);

    const notice = consumeCartNotice();
    if (notice) {
      notify({
        type: notice.type,
        message: notice.message,
        durationMs: 6800,
      });
    }
  }, [notify]);

  useEffect(() => {
    let active = true;

    refreshCart()
      .catch(() => {
        if (active) {
          setCart(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshCart]);

  const setCartSnapshot = useCallback((nextCart: Cart | null) => {
    setCart(nextCart);
    setOptimisticDelta(0);
  }, []);

  const optimisticAdjustItemCount = useCallback((delta: number) => {
    setOptimisticDelta((current) => current + delta);

    return () => {
      setOptimisticDelta((current) => current - delta);
    };
  }, []);

  const itemCount = Math.max(0, getItemCount(cart) + optimisticDelta);

  const value = useMemo<CartStoreContextValue>(
    () => ({
      cart,
      itemCount,
      loading,
      refreshCart,
      setCartSnapshot,
      optimisticAdjustItemCount,
    }),
    [cart, itemCount, loading, refreshCart, setCartSnapshot, optimisticAdjustItemCount]
  );

  return <CartStoreContext.Provider value={value}>{children}</CartStoreContext.Provider>;
}

export function useCartStore() {
  const context = useContext(CartStoreContext);
  if (!context) {
    throw new Error("useCartStore must be used within CartStoreProvider");
  }

  return context;
}
