export type WishlistItem = {
  handle: string;
  title: string;
  brand?: string;
  thumbnail?: string | null;
  priceText?: string;
};

const WISHLIST_STORAGE_KEY = "imidge_wishlist_items";
const WISHLIST_UPDATE_EVENT = "imidge:wishlist-updated";

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeHandle(handle: string) {
  return handle.trim().toLowerCase();
}

function dispatchWishlistUpdated() {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new CustomEvent(WISHLIST_UPDATE_EVENT));
}

export function getWishlistUpdateEventName() {
  return WISHLIST_UPDATE_EVENT;
}

export function getWishlistItems(): WishlistItem[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized: WishlistItem[] = [];

    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const maybeItem = entry as Partial<WishlistItem>;
      if (typeof maybeItem.handle !== "string" || typeof maybeItem.title !== "string") {
        continue;
      }

      const handle = maybeItem.handle.trim();
      const title = maybeItem.title.trim();

      if (!handle || !title) {
        continue;
      }

      normalized.push({
        handle,
        title,
        brand: typeof maybeItem.brand === "string" ? maybeItem.brand : undefined,
        thumbnail: typeof maybeItem.thumbnail === "string" ? maybeItem.thumbnail : null,
        priceText: typeof maybeItem.priceText === "string" ? maybeItem.priceText : undefined,
      });
    }

    return normalized;
  } catch {
    return [];
  }
}

function saveWishlistItems(items: WishlistItem[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
  dispatchWishlistUpdated();
}

export function isInWishlist(handle: string): boolean {
  const needle = normalizeHandle(handle);
  return getWishlistItems().some((item) => normalizeHandle(item.handle) === needle);
}

export function addToWishlist(item: WishlistItem) {
  const current = getWishlistItems();
  const needle = normalizeHandle(item.handle);
  const alreadyExists = current.some((entry) => normalizeHandle(entry.handle) === needle);

  if (alreadyExists) {
    return false;
  }

  saveWishlistItems([item, ...current]);
  return true;
}

export function syncWishlistItemData(item: WishlistItem) {
  const current = getWishlistItems();
  const needle = normalizeHandle(item.handle);
  let changed = false;

  const next = current.map((entry) => {
    if (normalizeHandle(entry.handle) !== needle) {
      return entry;
    }

    const merged: WishlistItem = {
      ...entry,
      title: item.title || entry.title,
      brand: item.brand || entry.brand,
      thumbnail: item.thumbnail || entry.thumbnail,
      priceText: item.priceText || entry.priceText,
    };

    if (
      merged.title !== entry.title ||
      merged.brand !== entry.brand ||
      merged.thumbnail !== entry.thumbnail ||
      merged.priceText !== entry.priceText
    ) {
      changed = true;
    }

    return merged;
  });

  if (!changed) {
    return false;
  }

  saveWishlistItems(next);
  return true;
}

export function removeFromWishlist(handle: string) {
  const needle = normalizeHandle(handle);
  const current = getWishlistItems();
  const next = current.filter((item) => normalizeHandle(item.handle) !== needle);

  if (next.length === current.length) {
    return false;
  }

  saveWishlistItems(next);
  return true;
}

export function toggleWishlistItem(item: WishlistItem) {
  if (isInWishlist(item.handle)) {
    removeFromWishlist(item.handle);
    return false;
  }

  addToWishlist(item);
  return true;
}

export function clearWishlist() {
  saveWishlistItems([]);
}
