"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearCurrentCart,
  deleteCartLineItem,
  updateCartLineItemQuantity,
} from "@/lib/medusa-browser";
import { DEFAULT_ACCOUNT_PROFILE } from "@/lib/account-profile";
import { useCartStore } from "@/components/cart-store-provider";
import { useToast } from "@/components/toast-provider";

type CartItem = {
  id: string;
  title: string;
  thumbnail?: string | null;
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

type DeliveryOption = {
  ref: string;
  name: string;
};

function normalizeLocationLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/["'`’]/g, "")
    .replace(/\b(область|обл\.?|обл)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findDeliveryOptionByCandidate(options: DeliveryOption[], candidate: string | null) {
  if (!candidate) {
    return null;
  }

  const normalizedCandidate = normalizeLocationLabel(candidate);

  return (
    options.find((option) => option.ref === candidate) ??
    options.find((option) => option.name.toLowerCase() === candidate.toLowerCase()) ??
    options.find((option) => normalizeLocationLabel(option.name) === normalizedCandidate) ??
    options.find((option) => {
      const normalizedName = normalizeLocationLabel(option.name);
      return normalizedName.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedName);
    }) ??
    null
  );
}

function mergeDeliveryOptions(primary: DeliveryOption[], fallback: DeliveryOption[]) {
  const merged: DeliveryOption[] = [];
  const seenKeys = new Set<string>();

  for (const option of [...primary, ...fallback]) {
    const key = `${normalizeLocationLabel(option.name)}|${option.ref}`;
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    merged.push(option);
  }

  return merged;
}

function ensureDeliveryOption(options: DeliveryOption[], refCandidate: string | null, nameCandidate: string | null) {
  const ref = (refCandidate || "").trim();
  const name = (nameCandidate || "").trim();

  if (!ref && !name) {
    return options;
  }

  const existing = options.find(
    (option) =>
      (!!ref && option.ref === ref) ||
      (!!name && normalizeLocationLabel(option.name) === normalizeLocationLabel(name))
  );

  if (existing) {
    return options;
  }

  return [...options, { ref: ref || name, name: name || ref }];
}

const FALLBACK_DELIVERY_REGIONS = [
  {
    name: "Киевская область",
    cities: [
      {
        name: "Киев",
        warehouses: ["Отделение №1", "Отделение №8", "Отделение №21"],
      },
      {
        name: "Борисполь",
        warehouses: ["Отделение №1", "Отделение №2"],
      },
    ],
  },
  {
    name: "Львовская область",
    cities: [
      {
        name: "Львов",
        warehouses: ["Отделение №1", "Отделение №4", "Отделение №12"],
      },
      {
        name: "Дрогобыч",
        warehouses: ["Отделение №1", "Отделение №3"],
      },
    ],
  },
  {
    name: "Одесская область",
    cities: [
      {
        name: "Одесса",
        warehouses: ["Отделение №2", "Отделение №7", "Отделение №18"],
      },
      {
        name: "Черноморск",
        warehouses: ["Отделение №1", "Отделение №2"],
      },
    ],
  },
] as const;

function money(value = 0, currency = "usd") {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(value);
}

function brandFromTitle(title: string) {
  const firstWord = title.trim().split(/\s+/)[0] ?? "";
  if (!firstWord) {
    return "IMIDGE";
  }

  return firstWord.toUpperCase();
}

type CartPageClientProps = {
  isCartRedesign?: boolean;
};

export function CartPageClient({ isCartRedesign = false }: CartPageClientProps) {
  const { cart, loading, refreshCart, setCartSnapshot } = useCartStore();
  const router = useRouter();
  const didInitialRefresh = useRef(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [activeClientTab, setActiveClientTab] = useState<"new" | "registered">("new");
  const [isNovaApiAvailable, setIsNovaApiAvailable] = useState<boolean | null>(null);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);
  const [areaOptions, setAreaOptions] = useState<DeliveryOption[]>([]);
  const [cityOptions, setCityOptions] = useState<DeliveryOption[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<DeliveryOption[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [pendingPrefillRegion, setPendingPrefillRegion] = useState<string | null>(null);
  const [pendingPrefillCity, setPendingPrefillCity] = useState<string | null>(null);
  const [pendingPrefillWarehouse, setPendingPrefillWarehouse] = useState<string | null>(null);
  const [checkoutFullName, setCheckoutFullName] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [checkoutTelegram, setCheckoutTelegram] = useState("");
  const [checkoutDeliveryMethod, setCheckoutDeliveryMethod] = useState("nova_poshta");
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState("cod");
  const [checkoutComment, setCheckoutComment] = useState("");
  const [registeredLogin, setRegisteredLogin] = useState("");
  const [registeredPassword, setRegisteredPassword] = useState("");
  const [registeredStatus, setRegisteredStatus] = useState("");
  const [isRegisteredAuthLoading, setIsRegisteredAuthLoading] = useState(false);
  const [isRegisteredAuthenticated, setIsRegisteredAuthenticated] = useState(false);
  const [isAddressPrefilledFromProfile, setIsAddressPrefilledFromProfile] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    if (didInitialRefresh.current) {
      return;
    }

    didInitialRefresh.current = true;
    refreshCart().catch(() => null);
  }, [refreshCart]);

  useEffect(() => {
    setCheckoutFullName(DEFAULT_ACCOUNT_PROFILE.fullName);
    setCheckoutPhone(DEFAULT_ACCOUNT_PROFILE.phone);
    setCheckoutTelegram(DEFAULT_ACCOUNT_PROFILE.telegram);
    setCheckoutDeliveryMethod(DEFAULT_ACCOUNT_PROFILE.preferredDeliveryMethod);
    setCheckoutPaymentMethod(DEFAULT_ACCOUNT_PROFILE.preferredPaymentMethod);
  }, []);

  const items = useMemo<CartItem[]>(() => (cart?.items ?? []) as CartItem[], [cart]);

  const warehouseSelectOptions = useMemo<DeliveryOption[]>(() => {
    if (!selectedWarehouse) {
      return warehouseOptions;
    }

    const hasSelectedWarehouseOption = warehouseOptions.some((warehouse) => warehouse.ref === selectedWarehouse);
    if (hasSelectedWarehouseOption) {
      return warehouseOptions;
    }

    return [{ ref: selectedWarehouse, name: selectedWarehouse }, ...warehouseOptions];
  }, [selectedWarehouse, warehouseOptions]);

  useEffect(() => {
    let isCancelled = false;

    const fallbackAreas = FALLBACK_DELIVERY_REGIONS.map((region) => ({
      ref: region.name,
      name: region.name,
    }));

    const loadAreas = async () => {
      setIsLoadingAreas(true);

      try {
        const response = await fetch("/api/novaposhta/areas", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Nova Poshta areas are unavailable");
        }

        const payload = (await response.json()) as { areas?: DeliveryOption[] };
        const areas = payload.areas ?? [];
        if (!isCancelled) {
          setAreaOptions(mergeDeliveryOptions(areas, fallbackAreas));
          setIsNovaApiAvailable(areas.length > 0);
        }
      } catch {
        if (!isCancelled) {
          setAreaOptions(fallbackAreas);
          setIsNovaApiAvailable(false);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAreas(false);
        }
      }
    };

    loadAreas().catch(() => null);

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const prefillCityOption = pendingPrefillCity
      ? [{ ref: pendingPrefillCity, name: pendingPrefillCity }]
      : [];
    const prefillWarehouseOption = pendingPrefillWarehouse
      ? [{ ref: pendingPrefillWarehouse, name: pendingPrefillWarehouse }]
      : [];

    if (pendingPrefillCity) {
      setSelectedCity((current) => current || pendingPrefillCity);
      setCityOptions(prefillCityOption);
    } else if (!selectedCity) {
      setCityOptions([]);
    }

    if (pendingPrefillWarehouse) {
      setSelectedWarehouse((current) => current || pendingPrefillWarehouse);
      setWarehouseOptions((current) => mergeDeliveryOptions(current, prefillWarehouseOption));
    } else if (!selectedWarehouse) {
      setWarehouseOptions([]);
    }

    if (!selectedRegion) {
      return;
    }

    let isCancelled = false;

    const selectedRegionName = areaOptions.find((region) => region.ref === selectedRegion)?.name ?? selectedRegion;

    const fallbackCities = (
      FALLBACK_DELIVERY_REGIONS.find((region) => region.name === selectedRegionName)?.cities ?? []
    ).map((city) => ({
      ref: city.name,
      name: city.name,
    }));

    const fallbackCitiesWithPrefill = pendingPrefillCity
      ? mergeDeliveryOptions(fallbackCities, [{ ref: pendingPrefillCity, name: pendingPrefillCity }])
      : fallbackCities;

    const loadCities = async () => {
      setIsLoadingCities(true);

      if (isNovaApiAvailable !== true) {
        if (!isCancelled) {
          setCityOptions(fallbackCitiesWithPrefill);
          setIsLoadingCities(false);
        }
        return;
      }

      try {
        const response = await fetch(`/api/novaposhta/cities?areaRef=${encodeURIComponent(selectedRegion)}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Nova Poshta cities are unavailable");
        }

        const payload = (await response.json()) as { cities?: DeliveryOption[] };
        const cities = payload.cities ?? [];
        if (!isCancelled) {
          setCityOptions(mergeDeliveryOptions(cities, fallbackCitiesWithPrefill));
        }
      } catch {
        if (!isCancelled) {
          setCityOptions(fallbackCitiesWithPrefill);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingCities(false);
        }
      }
    };

    loadCities().catch(() => null);

    return () => {
      isCancelled = true;
    };
  }, [areaOptions, isNovaApiAvailable, selectedCity, selectedRegion, selectedWarehouse]);

  useEffect(() => {
    const prefillWarehouseOption = pendingPrefillWarehouse
      ? [{ ref: pendingPrefillWarehouse, name: pendingPrefillWarehouse }]
      : [];

    if (pendingPrefillWarehouse) {
      setSelectedWarehouse((current) => current || pendingPrefillWarehouse);
      setWarehouseOptions((current) => mergeDeliveryOptions(current, prefillWarehouseOption));
    } else if (!selectedWarehouse) {
      setWarehouseOptions([]);
    }

    if (!selectedRegion || !selectedCity) {
      return;
    }

    let isCancelled = false;

    const selectedRegionName = areaOptions.find((region) => region.ref === selectedRegion)?.name ?? selectedRegion;
    const selectedCityName = cityOptions.find((city) => city.ref === selectedCity)?.name ?? selectedCity;

    const fallbackWarehouses = (
      FALLBACK_DELIVERY_REGIONS
        .find((region) => region.name === selectedRegionName)
        ?.cities.find((city) => city.name === selectedCityName)?.warehouses ?? []
    ).map((warehouse) => ({
      ref: warehouse,
      name: warehouse,
    }));

    const fallbackWarehousesWithPrefill = pendingPrefillWarehouse
      ? mergeDeliveryOptions(fallbackWarehouses, [{ ref: pendingPrefillWarehouse, name: pendingPrefillWarehouse }])
      : fallbackWarehouses;

    const loadWarehouses = async () => {
      setIsLoadingWarehouses(true);

      if (isNovaApiAvailable !== true) {
        if (!isCancelled) {
          setWarehouseOptions(fallbackWarehousesWithPrefill);
          setIsLoadingWarehouses(false);
        }
        return;
      }

      try {
        const response = await fetch(`/api/novaposhta/warehouses?cityRef=${encodeURIComponent(selectedCity)}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Nova Poshta warehouses are unavailable");
        }

        const payload = (await response.json()) as { warehouses?: DeliveryOption[] };
        const warehouses = payload.warehouses ?? [];
        if (!isCancelled) {
          setWarehouseOptions(mergeDeliveryOptions(warehouses, fallbackWarehousesWithPrefill));
        }
      } catch {
        if (!isCancelled) {
          setWarehouseOptions(fallbackWarehousesWithPrefill);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingWarehouses(false);
        }
      }
    };

    loadWarehouses().catch(() => null);

    return () => {
      isCancelled = true;
    };
  }, [areaOptions, cityOptions, isNovaApiAvailable, selectedCity, selectedRegion, selectedWarehouse]);

  useEffect(() => {
    if (!pendingPrefillRegion || areaOptions.length === 0) {
      return;
    }

    const matchedRegion = findDeliveryOptionByCandidate(areaOptions, pendingPrefillRegion);

    if (!matchedRegion) {
      return;
    }

    setSelectedRegion(matchedRegion.ref);
    setPendingPrefillRegion(null);
  }, [areaOptions, pendingPrefillRegion]);

  useEffect(() => {
    if (!pendingPrefillCity || cityOptions.length === 0) {
      return;
    }

    const matchedCity = findDeliveryOptionByCandidate(cityOptions, pendingPrefillCity);

    if (!matchedCity) {
      return;
    }

    setSelectedCity(matchedCity.ref);
    setPendingPrefillCity(null);
  }, [cityOptions, pendingPrefillCity]);

  useEffect(() => {
    if (!pendingPrefillWarehouse || warehouseOptions.length === 0) {
      return;
    }

    const matchedWarehouse = findDeliveryOptionByCandidate(warehouseOptions, pendingPrefillWarehouse);

    if (!matchedWarehouse) {
      return;
    }

    setSelectedWarehouse(matchedWarehouse.ref);
    setPendingPrefillWarehouse(null);
  }, [pendingPrefillWarehouse, warehouseOptions]);

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

  const onRegisteredLogin = async () => {
    if (!registeredLogin.trim() || !registeredPassword.trim()) {
      setRegisteredStatus("Введите логин и пароль.");
      return;
    }

    setIsRegisteredAuthLoading(true);
    setRegisteredStatus("Проверяем данные...");

    try {
      const response = await fetch("/api/account/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login: registeredLogin,
          password: registeredPassword,
        }),
      });

      const payload = (await response.json()) as {
        message?: string;
        profile?: {
          fullName?: string;
          phone?: string;
          email?: string;
          telegram?: string;
          comment?: string;
          preferredDeliveryMethod?: string;
          preferredPaymentMethod?: string;
        };
        priorityAddress?: {
          areaRef?: string;
          areaName?: string;
          cityRef?: string;
          cityName?: string;
          warehouseRef?: string;
          warehouseName?: string;
          recipient?: string;
          phone?: string;
        } | null;
      };

      if (!response.ok || !payload.profile) {
        setIsRegisteredAuthenticated(false);
        setIsAddressPrefilledFromProfile(false);
        setRegisteredStatus(payload.message || "Не удалось войти в аккаунт.");
        return;
      }

      const profile = payload.profile;
      setCheckoutFullName(profile.fullName ?? "");
      setCheckoutPhone(profile.phone ?? "");
      setCheckoutTelegram(profile.telegram ?? "");
      setCheckoutComment(profile.comment ?? "");
      setCheckoutDeliveryMethod(profile.preferredDeliveryMethod === "courier" ? "courier" : "nova_poshta");
      setCheckoutPaymentMethod(profile.preferredPaymentMethod === "card" ? "card" : "cod");

      if (payload.priorityAddress) {
        const priorityAddress = payload.priorityAddress;
        const regionCandidate = priorityAddress.areaRef || priorityAddress.areaName || null;
        const matchedRegion = findDeliveryOptionByCandidate(areaOptions, regionCandidate);

        setAreaOptions((current) =>
          ensureDeliveryOption(current, priorityAddress.areaRef || null, priorityAddress.areaName || null)
        );
        setCityOptions((current) =>
          ensureDeliveryOption(current, priorityAddress.cityRef || null, priorityAddress.cityName || null)
        );
        setWarehouseOptions((current) =>
          ensureDeliveryOption(current, priorityAddress.warehouseRef || null, priorityAddress.warehouseName || null)
        );

        if (matchedRegion) {
          setSelectedRegion(matchedRegion.ref);
        } else {
          setPendingPrefillRegion(regionCandidate);
          setSelectedRegion(priorityAddress.areaRef || priorityAddress.areaName || "");
        }

        setPendingPrefillCity(priorityAddress.cityRef || priorityAddress.cityName || null);
        setPendingPrefillWarehouse(priorityAddress.warehouseName || priorityAddress.warehouseRef || null);
        setSelectedCity(priorityAddress.cityRef || priorityAddress.cityName || "");
        setSelectedWarehouse(priorityAddress.warehouseName || priorityAddress.warehouseRef || "");

        if (priorityAddress.recipient) {
          setCheckoutFullName(priorityAddress.recipient);
        }

        if (priorityAddress.phone) {
          setCheckoutPhone(priorityAddress.phone);
        }

        setIsAddressPrefilledFromProfile(true);
      } else {
        setIsAddressPrefilledFromProfile(false);
      }

      setRegisteredStatus("Данные профиля и приоритетный адрес загружены. Можно продолжать оформление.");
      setRegisteredPassword("");
      setIsRegisteredAuthenticated(true);
      notify({ type: "success", message: "Вход выполнен. Поля автозаполнены из профиля." });
    } catch {
      setIsRegisteredAuthenticated(false);
      setIsAddressPrefilledFromProfile(false);
      setRegisteredStatus("Не удалось войти. Проверьте соединение и повторите попытку.");
    } finally {
      setIsRegisteredAuthLoading(false);
    }
  };

  const onPlaceOrder = async () => {
    if (!checkoutFullName.trim() || !checkoutPhone.trim()) {
      notify({
        type: "warning",
        message: "Заполните ФИО и телефон перед оформлением заказа.",
      });
      return;
    }

    if (!selectedRegion || !selectedCity || !selectedWarehouse) {
      notify({
        type: "warning",
        message: "Выберите область, населённый пункт и отделение Новой почты.",
      });
      return;
    }

    if (!items.length) {
      notify({
        type: "warning",
        message: "Корзина пуста. Добавьте товары перед оформлением.",
      });
      return;
    }

    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const randomPart = String(Math.floor(1000 + Math.random() * 9000));
    const orderId = `IM-${datePart}-${randomPart}`;

    try {
      const selectedRegionName = areaOptions.find((region) => region.ref === selectedRegion)?.name ?? selectedRegion;
      const selectedCityName = cityOptions.find((city) => city.ref === selectedCity)?.name ?? selectedCity;
      const selectedWarehouseName =
        warehouseSelectOptions.find((warehouse) => warehouse.ref === selectedWarehouse)?.name ?? selectedWarehouse;

      localStorage.setItem("imidgeLastOrderId", orderId);
      localStorage.setItem(
        "imidgeLastOrderSummary",
        JSON.stringify({
          orderId,
          createdAt: now.toISOString(),
          customer: {
            fullName: checkoutFullName,
            phone: checkoutPhone,
            telegram: checkoutTelegram,
            comment: checkoutComment,
          },
          deliveryAddress: {
            region: selectedRegionName,
            city: selectedCityName,
            warehouse: selectedWarehouseName,
          },
          deliveryMethod: checkoutDeliveryMethod,
          paymentMethod: checkoutPaymentMethod,
          subtotal: cart?.subtotal ?? 0,
          total: cart?.total ?? cart?.subtotal ?? 0,
          items: items.map((item) => ({
            id: item.id,
            title: item.title,
            quantity: item.quantity,
            total: item.total ?? item.subtotal ?? (item.unit_price ?? 0) * item.quantity,
          })),
        })
      );
    } catch {
      // ignore storage errors
    }

    try {
      const clearedCart = await clearCurrentCart();
      setCartSnapshot(clearedCart as Cart | null);
    } catch {
      setCartSnapshot(null);
    }

    notify({
      type: "success",
      message: "Заказ принят. Перенаправляем на страницу подтверждения.",
      durationMs: 2500,
    });

    router.push(`/thank-you?orderId=${encodeURIComponent(orderId)}${isCartRedesign ? "&v2=1" : ""}`);
  };

  return (
    <>
      {isCartRedesign ? (
        <div className="cart-v2-head">
          <nav className="cart-v2-breadcrumbs" aria-label="Хлебные крошки">
            <Link href="/">Главная</Link>
            <span aria-hidden="true">›</span>
            <span>Корзина</span>
          </nav>
        </div>
      ) : (
        <h1 className="section-title">Корзина</h1>
      )}

      {loading && (
        <p className="section-subtitle" role="status" aria-live="polite">
          Загружаем корзину...
        </p>
      )}

      {!loading && items.length === 0 && (
        <div className="empty-state">
          Корзина пока пуста. <Link href={isCartRedesign ? "/catalog?v2=1" : "/catalog"}>Перейти в каталог</Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className={isCartRedesign ? "cart-layout cart-layout-v2" : "cart-layout"}>
          <div className={isCartRedesign ? "cart-items cart-items-v2" : "cart-items"}>
            {isCartRedesign && (
              <div className="cart-v2-head-row" aria-hidden="true">
                <span>Товар</span>
                <span>Описание</span>
                <span>Цена</span>
                <span>Кол-во</span>
                <span>Сумма</span>
                <span />
              </div>
            )}

            {items.map((item) => {
              const itemTotal = item.total ?? item.subtotal ?? (item.unit_price ?? 0) * item.quantity;
              const unitPrice = item.unit_price ?? (typeof itemTotal === "number" ? Math.round(itemTotal / Math.max(1, item.quantity)) : 0);

              return (
                <article className={isCartRedesign ? "cart-item cart-item-v2" : "cart-item"} key={item.id}>
                  {isCartRedesign && (
                    <div className="cart-v2-thumb" aria-hidden="true">
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnail} alt={item.title} className="cart-v2-thumb-image" />
                      ) : (
                        "IMIDGE"
                      )}
                    </div>
                  )}

                  <div className={isCartRedesign ? "cart-v2-desc" : undefined}>
                    {isCartRedesign && <p className="cart-v2-brand">{brandFromTitle(item.title)}</p>}
                    <h3>{item.title}</h3>
                    <p className="product-handle">{item.variant_title || "Default"}</p>

                    {!isCartRedesign && (
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
                    )}
                  </div>

                  {isCartRedesign && <p className="cart-v2-price">{money(unitPrice, cart?.currency_code)}</p>}

                  <div className={isCartRedesign ? "qty-controls qty-controls-v2" : "qty-controls"}>
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
                  </div>

                  <p className={isCartRedesign ? "cart-v2-sum" : "cart-item-meta"}>
                    {isCartRedesign ? money(itemTotal, cart?.currency_code) : (
                      <>
                        <span>× {item.quantity}</span>
                        <span>{money(itemTotal, cart?.currency_code)}</span>
                      </>
                    )}
                  </p>

                  {isCartRedesign ? (
                    <button
                      type="button"
                      className="cart-v2-remove"
                      aria-label={`Удалить ${item.title} из корзины`}
                      onClick={() => onRemove(item)}
                      disabled={busyItemId === item.id}
                    >
                      ✕
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>

          <aside className={isCartRedesign ? "cart-summary cart-summary-v2" : "cart-summary"}>
            <h3>{isCartRedesign ? "Ваш заказ" : "Итого"}</h3>
            {isCartRedesign ? (
              <>
                <div className="cart-v2-summary-rows">
                  <p className="cart-v2-summary-row">
                    <span>Товары</span>
                    <strong>{money(cart?.subtotal, cart?.currency_code)}</strong>
                  </p>
                  <p className="cart-v2-summary-row">
                    <span>Доставка</span>
                    <strong>Бесплатно</strong>
                  </p>
                </div>

                <p className="cart-v2-summary-total">
                  <span>Итого</span>
                  <strong>{money(cart?.total, cart?.currency_code)}</strong>
                </p>

                <div className="cart-v2-auth-tabs" role="tablist" aria-label="Тип клиента">
                  <button
                    type="button"
                    className={`cart-v2-auth-tab${activeClientTab === "new" ? " active" : ""}`}
                    role="tab"
                    aria-selected={activeClientTab === "new"}
                    onClick={() => setActiveClientTab("new")}
                  >
                    Новый клиент
                  </button>
                  <button
                    type="button"
                    className={`cart-v2-auth-tab${activeClientTab === "registered" ? " active" : ""}`}
                    role="tab"
                    aria-selected={activeClientTab === "registered"}
                    onClick={() => setActiveClientTab("registered")}
                  >
                    Зарегистрированный
                  </button>
                </div>

                {activeClientTab === "new" || (activeClientTab === "registered" && isRegisteredAuthenticated) ? (
                  <form className="cart-v2-auth-form cart-v2-new-form" aria-label="Новый клиент" onSubmit={(event) => event.preventDefault()}>
                    <div className="cart-v2-new-grid">
                      <div>
                        <label className="cart-v2-field-label" htmlFor="cartFullName">ФИО *</label>
                        <input
                          id="cartFullName"
                          className="field"
                          placeholder="Иванов Иван Иванович"
                          autoComplete="name"
                          value={checkoutFullName}
                          onChange={(event) => setCheckoutFullName(event.target.value)}
                        />
                      </div>
                      <div>
                        <label className="cart-v2-field-label" htmlFor="cartNewPhone">Телефон *</label>
                        <input
                          id="cartNewPhone"
                          className="field"
                          placeholder="+380 XX XXX XX XX"
                          autoComplete="tel"
                          value={checkoutPhone}
                          onChange={(event) => setCheckoutPhone(event.target.value)}
                        />
                      </div>
                      <div>
                        <label className="cart-v2-field-label" htmlFor="cartTelegram">Телеграм</label>
                        <input
                          id="cartTelegram"
                          className="field"
                          placeholder="@username"
                          autoComplete="off"
                          value={checkoutTelegram}
                          onChange={(event) => setCheckoutTelegram(event.target.value)}
                        />
                      </div>
                      <div>
                        <label className="cart-v2-field-label" htmlFor="cartDeliveryMethod">Способ доставки *</label>
                        <select
                          id="cartDeliveryMethod"
                          className="field"
                          value={checkoutDeliveryMethod}
                          onChange={(event) => setCheckoutDeliveryMethod(event.target.value)}
                        >
                          <option value="nova_poshta">Новая почта</option>
                          <option value="courier">Курьер</option>
                        </select>
                      </div>
                      <div>
                        <label className="cart-v2-field-label" htmlFor="cartPaymentMethod">Способ оплаты *</label>
                        <select
                          id="cartPaymentMethod"
                          className="field"
                          value={checkoutPaymentMethod}
                          onChange={(event) => setCheckoutPaymentMethod(event.target.value)}
                        >
                          <option value="cod">Наложенный платеж</option>
                          <option value="card">Оплата картой</option>
                        </select>
                      </div>
                    </div>

                    <fieldset className="cart-v2-address-block">
                      <legend>Адрес доставки</legend>
                      {activeClientTab === "registered" && isAddressPrefilledFromProfile && (
                        <p className="cart-v2-field-hint">Адрес подставлен из профиля.</p>
                      )}
                      <div className="cart-v2-new-grid">
                        <div>
                          <label className="cart-v2-field-label" htmlFor="cartRegion">Область *</label>
                          <select
                            id="cartRegion"
                            className="field"
                            value={selectedRegion}
                            onChange={(event) => {
                              setSelectedRegion(event.target.value);
                            }}
                            disabled={isLoadingAreas}
                          >
                            <option value="" disabled>
                              {isLoadingAreas ? "Загрузка областей..." : "Выберите область"}
                            </option>
                            {areaOptions.map((region) => (
                              <option key={region.ref} value={region.ref}>
                                {region.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="cart-v2-field-label" htmlFor="cartCity">Населенный пункт *</label>
                          <select
                            id="cartCity"
                            className="field"
                            value={selectedCity}
                            onChange={(event) => setSelectedCity(event.target.value)}
                            disabled={!selectedRegion || isLoadingCities}
                          >
                            <option value="" disabled>
                              {!selectedRegion
                                ? "Сначала выберите область"
                                : isLoadingCities
                                  ? "Загрузка населённых пунктов..."
                                  : "Выберите населённый пункт"}
                            </option>
                            {cityOptions.map((city) => (
                              <option key={city.ref} value={city.ref}>
                                {city.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="cart-v2-new-span2">
                          <label className="cart-v2-field-label" htmlFor="cartWarehouse">Отделение Новой почты *</label>
                          <select
                            id="cartWarehouse"
                            className="field"
                            value={selectedWarehouse}
                            onChange={(event) => setSelectedWarehouse(event.target.value)}
                            disabled={!selectedCity || isLoadingWarehouses}
                          >
                            <option value="" disabled>
                              {!selectedCity
                                ? "Сначала выберите населённый пункт"
                                : isLoadingWarehouses
                                  ? "Загрузка отделений..."
                                  : "Выберите отделение"}
                            </option>
                            {warehouseSelectOptions.map((warehouse) => (
                              <option key={warehouse.ref} value={warehouse.ref}>
                                {warehouse.name}
                              </option>
                            ))}
                          </select>
                          <p className="cart-v2-field-hint">
                            {isNovaApiAvailable === false
                              ? "Используется резервный список адресов."
                              : selectedCity
                                ? "Список отделений обновлён для выбранного населённого пункта."
                                : "Отделения подгружаются после выбора населённого пункта."}
                          </p>
                        </div>
                      </div>
                    </fieldset>

                    <div className="cart-v2-new-span2">
                      <label className="cart-v2-field-label" htmlFor="cartComment">Комментарий</label>
                      <textarea
                        id="cartComment"
                        className="field cart-v2-comment"
                        placeholder="Удобное время звонка"
                        value={checkoutComment}
                        onChange={(event) => setCheckoutComment(event.target.value)}
                      />
                    </div>

                    <button type="button" className="catalog-btn-v2 primary cart-v2-primary-btn" onClick={onPlaceOrder}>
                      Оформить заказ
                    </button>
                    <Link href="/catalog?v2=1" className="cart-v2-secondary-btn">
                      Продолжить покупки
                    </Link>
                  </form>
                ) : (
                  <form
                    className="cart-v2-auth-form"
                    aria-label="Авторизация в корзине"
                    onSubmit={(event) => {
                      event.preventDefault();
                      onRegisteredLogin().catch(() => null);
                    }}
                  >
                    <label htmlFor="cartPhone">Телефон *</label>
                    <input
                      id="cartPhone"
                      className="field"
                      placeholder="Телефон или Email"
                      autoComplete="username"
                      value={registeredLogin}
                      onChange={(event) => setRegisteredLogin(event.target.value)}
                    />

                    <label htmlFor="cartPassword">Пароль *</label>
                    <input
                      id="cartPassword"
                      type="password"
                      className="field"
                      placeholder="Введите пароль"
                      autoComplete="current-password"
                      value={registeredPassword}
                      onChange={(event) => setRegisteredPassword(event.target.value)}
                    />

                    <a href="#" className="cart-v2-forgot" onClick={(event) => event.preventDefault()}>
                      Забыли пароль?
                    </a>

                    <button type="button" className="cart-v2-google-btn">
                      <span className="cart-v2-google-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false">
                          <path d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.51 5.51 0 0 1-2.39 3.62v3.01h3.88c2.27-2.09 3.55-5.17 3.55-8.66z" fill="#4285F4" />
                          <path d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.76-2.11-6.71-4.94H1.28v3.11A11.99 11.99 0 0 0 12 24z" fill="#34A853" />
                          <path d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.55.38-2.29V6.6H1.28A11.99 11.99 0 0 0 0 12c0 1.93.46 3.76 1.28 5.4l4.01-3.11z" fill="#FBBC05" />
                          <path d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.6l4.01 3.11C6.24 6.88 8.88 4.77 12 4.77z" fill="#EA4335" />
                        </svg>
                      </span>
                      <span>Продолжить через Google</span>
                    </button>

                    <p className="cart-v2-auth-note">Войдите в аккаунт, чтобы использовать сохранённые данные доставки и быстрее оформить заказ.</p>

                    <p className="cart-v2-auth-note" aria-live="polite">{registeredStatus}</p>

                    <button type="submit" className="catalog-btn-v2 primary cart-v2-primary-btn" disabled={isRegisteredAuthLoading}>
                      {isRegisteredAuthLoading ? "Входим..." : "Войти и заполнить"}
                    </button>
                    <Link href="/catalog?v2=1" className="cart-v2-secondary-btn">
                      Продолжить покупки
                    </Link>
                  </form>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
