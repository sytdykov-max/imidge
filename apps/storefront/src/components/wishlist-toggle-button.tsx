"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import {
  getWishlistUpdateEventName,
  isInWishlist,
  syncWishlistItemData,
  type WishlistItem,
  toggleWishlistItem,
} from "@/lib/wishlist";

type Props = {
  item: WishlistItem;
  mode?: "default" | "compact" | "inline" | "catalogInline";
};

export function WishlistToggleButton({ item, mode = "default" }: Props) {
  const { notify } = useToast();
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    const sync = () => {
      const exists = isInWishlist(item.handle);
      if (exists) {
        syncWishlistItemData(item);
      }
      setSelected(exists);
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(getWishlistUpdateEventName(), sync as EventListener);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(getWishlistUpdateEventName(), sync as EventListener);
    };
  }, [item]);

  const onToggle = () => {
    const nowInWishlist = toggleWishlistItem(item);
    setSelected(nowInWishlist);
    notify({
      type: "success",
      message: nowInWishlist ? "Товар добавлен в избранное" : "Товар удалён из избранного",
    });
  };

  return (
    <button
      type="button"
      className={
        mode === "compact"
          ? `catalog-btn-v2 wishlist-toggle-compact${selected ? " active" : ""}`
          : mode === "catalogInline"
            ? `catalog-btn-v2 wishlist-toggle-catalog-inline${selected ? " active" : ""}`
          : mode === "inline"
            ? `secondary-btn wishlist-toggle-inline${selected ? " active" : ""}`
          : `secondary-btn wishlist-toggle-btn${selected ? " active" : ""}`
      }
      onClick={onToggle}
      aria-pressed={selected}
    >
      {mode === "compact"
        ? selected
          ? "♥ В избранном"
          : "♡ В избранное"
        : selected
          ? "♥ В избранном"
          : "♡ В избранное"}
    </button>
  );
}
