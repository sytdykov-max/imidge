const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL as string;
const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string;
const STORE_API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_STORE_API_TIMEOUT_MS ?? 12000);

type Region = {
  id: string;
  currency_code?: string;
  countries?: Array<{
    iso_2?: string;
  }>;
};

type Cart = {
  id: string;
  region_id?: string;
  currency_code: string;
  shipping_methods?: Array<{ id: string }>;
  items?: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    thumbnail?: string | null;
    variant_title?: string | null;
    variant_id?: string;
  }>;
  subtotal?: number;
  total?: number;
};

type CartResponse = {
  cart: Cart;
};

type ShippingOptionsResponse = {
  shipping_options: Array<{
    id: string;
  }>;
};

type PaymentCollectionResponse = {
  payment_collection: {
    id: string;
  };
};

type CartUpdateResponse = {
  cart: Cart;
};

type CompleteCartResponse = {
  type: string;
  order?: {
    id: string;
    display_id?: number;
  };
};

type CheckoutInput = {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
};

type CartNoticeType = "info" | "warning" | "success" | "error";

type CartNotice = {
  type: CartNoticeType;
  message: string;
  at: string;
};

type CartDebugEntry = {
  at: string;
  event: string;
  details?: Record<string, unknown>;
};

type StoreErrorPayload = {
  message?: string;
  error?: string;
  type?: string;
};

const CART_NOTICE_STORAGE_KEY = "imidge_cart_notice";
const CART_DEBUG_LOG_STORAGE_KEY = "imidge_cart_debug_log";

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function storeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!backendUrl || !publishableKey) {
    throw new Error("Missing NEXT_PUBLIC_MEDUSA_BACKEND_URL or NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY");
  }

  const requestId = createRequestId();
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId =
    controller && Number.isFinite(STORE_API_TIMEOUT_MS) && STORE_API_TIMEOUT_MS > 0
      ? setTimeout(() => controller.abort(), STORE_API_TIMEOUT_MS)
      : null;

  let response: Response;
  try {
    response = await fetch(`${backendUrl}${path}`, {
      ...init,
      signal: controller?.signal,
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": publishableKey,
        "x-request-id": requestId,
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Store API timeout [${requestId}] after ${STORE_API_TIMEOUT_MS}ms`);
    }

    throw new Error(`Store API network error [${requestId}]`);
  }

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const payload = await response.text();
    let details = "";

    try {
      const parsed = JSON.parse(payload) as StoreErrorPayload;
      details = parsed.message || parsed.error || parsed.type || "";
    } catch {
      details = payload?.trim() ?? "";
    }

    const suffix = details ? `: ${details}` : "";
    throw new Error(`Store API error ${response.status} [${requestId}]${suffix}`);
  }

  return (await response.json()) as T;
}

async function resolveCheckoutCountryCode(cartId: string): Promise<string> {
  const fallbackCountryCode = "ua";

  try {
    const cartData = await storeFetch<CartResponse>(`/store/carts/${cartId}`);
    const regionId = cartData.cart.region_id;
    if (!regionId) {
      return fallbackCountryCode;
    }

    const regionsData = await storeFetch<{ regions: Array<{ id: string; countries?: Array<{ iso_2?: string }> }> }>(
      "/store/regions?limit=100"
    );
    const matchedRegion = (regionsData.regions ?? []).find((region) => region.id === regionId);
    const iso2 = matchedRegion?.countries?.[0]?.iso_2?.toLowerCase();
    if (iso2) {
      return iso2;
    }

    pushCartDebug("checkout_country_fallback", {
      cartId,
      regionId,
      reason: "region_country_not_found",
      fallbackCountryCode,
    });

    return fallbackCountryCode;
  } catch (error) {
    pushCartDebug("checkout_country_fallback", {
      cartId,
      reason: error instanceof Error ? error.message : "unknown",
      fallbackCountryCode,
    });
    return fallbackCountryCode;
  }
}

async function getFirstRegionId(): Promise<string> {
  const data = await storeFetch<{ regions: Region[] }>("/store/regions?limit=100");
  const regions = data.regions ?? [];
  const preferredRegion =
    regions.find((region) =>
      (region.countries ?? []).some((country) => country.iso_2?.toLowerCase() === "ua")
    ) || regions.find((region) => region.currency_code?.toLowerCase() === "uah") || regions[0];
  const regionId = preferredRegion?.id;

  if (!regionId) {
    throw new Error("No region found in Medusa store");
  }

  return regionId;
}

async function getAllRegionIds(): Promise<string[]> {
  const data = await storeFetch<{ regions: Region[] }>("/store/regions?limit=100");
  const regions = data.regions ?? [];
  const preferredRegion =
    regions.find((region) =>
      (region.countries ?? []).some((country) => country.iso_2?.toLowerCase() === "ua")
    ) || regions.find((region) => region.currency_code?.toLowerCase() === "uah") || null;

  const orderedRegionIds = [
    ...(preferredRegion ? [preferredRegion.id] : []),
    ...regions.map((region) => region.id).filter((id) => id !== preferredRegion?.id),
  ];

  return orderedRegionIds.filter(Boolean);
}

function pushCartDebug(event: string, details?: Record<string, unknown>) {
  const entry: CartDebugEntry = {
    at: new Date().toISOString(),
    event,
    details,
  };

  if (typeof window !== "undefined") {
    try {
      const current = JSON.parse(localStorage.getItem(CART_DEBUG_LOG_STORAGE_KEY) ?? "[]") as CartDebugEntry[];
      localStorage.setItem(CART_DEBUG_LOG_STORAGE_KEY, JSON.stringify([...current.slice(-39), entry]));
    } catch {
      // no-op
    }
  }

  try {
    console.debug("[cart-debug]", event, details ?? {});
  } catch {
    // no-op
  }
}

function setCartNotice(type: CartNoticeType, message: string) {
  if (typeof window === "undefined") {
    return;
  }

  const notice: CartNotice = {
    type,
    message,
    at: new Date().toISOString(),
  };

  localStorage.setItem(CART_NOTICE_STORAGE_KEY, JSON.stringify(notice));
}

export function consumeCartNotice(): CartNotice | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(CART_NOTICE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  localStorage.removeItem(CART_NOTICE_STORAGE_KEY);

  try {
    return JSON.parse(raw) as CartNotice;
  } catch {
    return null;
  }
}

export function getCartDebugLog(): CartDebugEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(localStorage.getItem(CART_DEBUG_LOG_STORAGE_KEY) ?? "[]") as CartDebugEntry[];
  } catch {
    return [];
  }
}

function validateCheckoutInput(input: CheckoutInput) {
  const errors: string[] = [];

  if (!input.name.trim()) {
    errors.push("Введите имя");
  }

  if (!input.email.trim() || !/^\S+@\S+\.\S+$/.test(input.email.trim())) {
    errors.push("Введите корректный email");
  }

  const phoneDigits = input.phone.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    errors.push("Введите корректный телефон");
  }

  if (!input.city.trim()) {
    errors.push("Введите город");
  }

  if (!input.address.trim()) {
    errors.push("Введите адрес");
  }

  if (errors.length > 0) {
    throw new Error(errors.join(". "));
  }
}

async function attachCheckoutDataToCart(cartId: string, input: CheckoutInput): Promise<void> {
  const safeName = input.name.trim();
  const countryCode = await resolveCheckoutCountryCode(cartId);

  await storeFetch<CartUpdateResponse>(`/store/carts/${cartId}`, {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim(),
      shipping_address: {
        first_name: safeName,
        phone: input.phone.trim(),
        city: input.city.trim(),
        address_1: input.address.trim(),
        country_code: countryCode,
      },
      billing_address: {
        first_name: safeName,
        phone: input.phone.trim(),
        city: input.city.trim(),
        address_1: input.address.trim(),
        country_code: countryCode,
      },
    }),
  });
}

async function createCartInRegion(regionId: string): Promise<Cart> {
  const created = await storeFetch<CartResponse>("/store/carts", {
    method: "POST",
    body: JSON.stringify({ region_id: regionId }),
  });

  return created.cart;
}

async function migrateItemsToCart(params: {
  items: Array<{ variant_id?: string; quantity?: number }>;
  targetCartId: string;
}): Promise<{ migratedCount: number; skippedCount: number }> {
  let migratedCount = 0;
  let skippedCount = 0;

  for (const item of params.items) {
    if (!item.variant_id || !item.quantity || item.quantity < 1) {
      skippedCount += 1;
      continue;
    }

    try {
      await storeFetch(`/store/carts/${params.targetCartId}/line-items`, {
        method: "POST",
        body: JSON.stringify({ variant_id: item.variant_id, quantity: item.quantity }),
      });
      migratedCount += 1;
    } catch {
      skippedCount += 1;
    }
  }

  return { migratedCount, skippedCount };
}

async function tryAddVariantInFallbackRegion(params: {
  currentCartId: string;
  variantId: string;
  quantity: number;
}): Promise<Cart | null> {
  const currentCart = await storeFetch<CartResponse>(`/store/carts/${params.currentCartId}`);
  const existingItems = currentCart.cart.items ?? [];

  const currentRegionId = currentCart.cart.region_id;
  const regionIds = await getAllRegionIds();

  for (const regionId of regionIds) {
    if (regionId === currentRegionId) {
      continue;
    }

    try {
      const createdCart = await createCartInRegion(regionId);

      const migration = await migrateItemsToCart({
        items: existingItems,
        targetCartId: createdCart.id,
      });

      const nextCartId = createdCart.id;
      const added = await storeFetch<CartResponse>(`/store/carts/${nextCartId}/line-items`, {
        method: "POST",
        body: JSON.stringify({ variant_id: params.variantId, quantity: params.quantity }),
      });

      localStorage.setItem("imidge_cart_id", nextCartId);

      if (migration.migratedCount > 0 || migration.skippedCount > 0) {
        if (migration.skippedCount > 0) {
          setCartNotice(
            "warning",
            `Корзина переведена в другой регион. Перенесено позиций: ${migration.migratedCount}, пропущено: ${migration.skippedCount}.`
          );
        } else {
          setCartNotice("info", "Корзина переведена в другой регион из-за несовместимости валюты.");
        }
      }

      pushCartDebug("cart_region_migrated", {
        fromRegionId: currentRegionId,
        toRegionId: regionId,
        oldCartId: params.currentCartId,
        newCartId: nextCartId,
        migratedCount: migration.migratedCount,
        skippedCount: migration.skippedCount,
      });

      return added.cart;
    } catch {
      continue;
    }
  }

  return null;
}

export async function ensureCartId(): Promise<string> {
  const existingId = localStorage.getItem("imidge_cart_id");

  if (existingId) {
    try {
      await storeFetch<CartResponse>(`/store/carts/${existingId}`);
      return existingId;
    } catch (error) {
      pushCartDebug("cart_invalid_recreate", {
        cartId: existingId,
        reason: error instanceof Error ? error.message : "unknown",
      });
      setCartNotice("warning", "Корзина была обновлена из-за устаревшего идентификатора.");
      localStorage.removeItem("imidge_cart_id");
    }
  }

  const regionId = await getFirstRegionId();
  const created = await createCartInRegion(regionId);

  pushCartDebug("cart_created", {
    cartId: created.id,
    regionId,
    reason: existingId ? "recreated_after_invalid" : "initial",
  });

  localStorage.setItem("imidge_cart_id", created.id);
  return created.id;
}

export function getCurrentCartId(): string | null {
  return localStorage.getItem("imidge_cart_id");
}

export async function addVariantToCart(variantId: string, quantity = 1): Promise<Cart> {
  const cartId = await ensureCartId();

  try {
    const response = await storeFetch<CartResponse>(`/store/carts/${cartId}/line-items`, {
      method: "POST",
      body: JSON.stringify({ variant_id: variantId, quantity }),
    });

    if (response?.cart) {
      return response.cart;
    }

    const cart = await storeFetch<CartResponse>(`/store/carts/${cartId}`);
    return cart.cart;
  } catch (error) {
    const fallbackCart = await tryAddVariantInFallbackRegion({
      currentCartId: cartId,
      variantId,
      quantity,
    });

    if (fallbackCart) {
      return fallbackCart;
    }

    if (error instanceof Error && error.message.includes("Store API error 500")) {
      throw new Error("Товар недоступен для заказа: цена не настроена для доступных регионов.");
    }

    throw error;
  }
}

export async function getCurrentCart(): Promise<Cart | null> {
  const cartId = localStorage.getItem("imidge_cart_id");
  if (!cartId) return null;

  try {
    const data = await storeFetch<CartResponse>(`/store/carts/${cartId}`);
    return data.cart;
  } catch (error) {
    pushCartDebug("cart_fetch_failed", {
      cartId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    setCartNotice("warning", "Корзина была сброшена и будет создана заново при следующем добавлении.");
    localStorage.removeItem("imidge_cart_id");
    return null;
  }
}

export async function updateCartLineItemQuantity(
  lineItemId: string,
  quantity: number
): Promise<Cart | null> {
  const cartId = getCurrentCartId();
  if (!cartId) {
    return null;
  }

  const data = await storeFetch<CartResponse>(`/store/carts/${cartId}/line-items/${lineItemId}`, {
    method: "POST",
    body: JSON.stringify({ quantity }),
  });

  return data.cart;
}

export async function deleteCartLineItem(lineItemId: string): Promise<Cart | null> {
  const cartId = getCurrentCartId();
  if (!cartId) {
    return null;
  }

  await storeFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });

  const data = await storeFetch<CartResponse>(`/store/carts/${cartId}`);
  return data.cart;
}

export async function clearCurrentCart(): Promise<Cart | null> {
  const cartId = getCurrentCartId();
  if (!cartId) {
    return null;
  }

  const cartData = await storeFetch<CartResponse>(`/store/carts/${cartId}`);
  const items = cartData.cart.items ?? [];

  for (const item of items) {
    await storeFetch(`/store/carts/${cartId}/line-items/${item.id}`, {
      method: "DELETE",
      body: JSON.stringify({}),
    });
  }

  const cleared = await storeFetch<CartResponse>(`/store/carts/${cartId}`);
  return cleared.cart;
}

export async function completeCurrentCart(
  checkoutInput?: CheckoutInput
): Promise<{ orderId: string; displayId?: number } | null> {
  const cartId = getCurrentCartId();
  if (!cartId) {
    return null;
  }

  if (checkoutInput) {
    validateCheckoutInput(checkoutInput);

    try {
      await attachCheckoutDataToCart(cartId, checkoutInput);
    } catch (error) {
      pushCartDebug("checkout_attach_data_failed", {
        cartId,
        reason: error instanceof Error ? error.message : "unknown",
      });
      throw new Error("Не удалось сохранить контактные данные заказа.");
    }
  }

  const cartResponse = await storeFetch<CartResponse>(`/store/carts/${cartId}`);
  const hasShipping = (cartResponse.cart.shipping_methods?.length ?? 0) > 0;

  if (!hasShipping) {
    let shippingOptions: ShippingOptionsResponse;

    try {
      shippingOptions = await storeFetch<ShippingOptionsResponse>(
        `/store/shipping-options?cart_id=${cartId}`
      );
    } catch (error) {
      pushCartDebug("checkout_shipping_options_failed", {
        cartId,
        reason: error instanceof Error ? error.message : "unknown",
      });
      throw new Error("Не удалось получить способы доставки для корзины.");
    }

    const shippingOptionId = shippingOptions.shipping_options?.[0]?.id;

    if (!shippingOptionId) {
      pushCartDebug("checkout_shipping_options_empty", {
        cartId,
        currency: cartResponse.cart.currency_code,
        itemsCount: cartResponse.cart.items?.length ?? 0,
      });
      throw new Error("Не удалось подобрать способ доставки для текущей корзины.");
    }

    try {
      await storeFetch(`/store/carts/${cartId}/shipping-methods`, {
        method: "POST",
        body: JSON.stringify({ option_id: shippingOptionId }),
      });
    } catch (error) {
      pushCartDebug("checkout_shipping_method_apply_failed", {
        cartId,
        optionId: shippingOptionId,
        reason: error instanceof Error ? error.message : "unknown",
      });
      throw new Error("Не удалось применить выбранный способ доставки.");
    }
  }

  let paymentCollection: PaymentCollectionResponse;
  try {
    paymentCollection = await storeFetch<PaymentCollectionResponse>(
      "/store/payment-collections",
      {
        method: "POST",
        body: JSON.stringify({ cart_id: cartId }),
      }
    );
  } catch (error) {
    pushCartDebug("checkout_payment_collection_failed", {
      cartId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    throw new Error("Не удалось подготовить оплату для заказа.");
  }

  try {
    await storeFetch(`/store/payment-collections/${paymentCollection.payment_collection.id}/payment-sessions`, {
      method: "POST",
      body: JSON.stringify({ provider_id: "pp_system_default" }),
    });
  } catch (error) {
    pushCartDebug("checkout_payment_session_failed", {
      cartId,
      paymentCollectionId: paymentCollection.payment_collection.id,
      reason: error instanceof Error ? error.message : "unknown",
    });
    throw new Error("Не удалось создать платежную сессию. Повторите попытку позже.");
  }

  const completed = await storeFetch<CompleteCartResponse>(`/store/carts/${cartId}/complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  if (completed.type === "order" && completed.order?.id) {
    localStorage.removeItem("imidge_cart_id");
    return { orderId: completed.order.id, displayId: completed.order.display_id };
  }

  return null;
}
