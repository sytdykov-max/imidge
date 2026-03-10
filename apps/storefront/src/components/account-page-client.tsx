"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AccountTab = "profile" | "orders" | "favorites" | "addresses";

type DeliveryOption = {
  ref: string;
  name: string;
};

type AddressRecord = {
  id: string;
  title: string;
  summary: string;
};

type OrderItem = {
  id: string;
  title: string;
  sku: string;
  qty: number;
  priceText: string;
  image: string;
};

type OrderRecord = {
  id: string;
  dateText: string;
  statusText: string;
  totalText: string;
  ttn?: string;
  trackingSteps: string[];
  items: OrderItem[];
};

type FavoriteItem = {
  id: string;
  brand: string;
  title: string;
  priceText: string;
  href: string;
  image: string;
};

const ORDER_HISTORY: OrderRecord[] = [
  {
    id: "№IM-10284",
    dateText: "10.03.2026",
    statusText: "Отправлен",
    totalText: "30 €",
    ttn: "20451099871234",
    trackingSteps: ["Заказ создан", "Передан в службу доставки", "В пути в отделение"],
    items: [
      {
        id: "item-1",
        title: "Medusa Shorts",
        sku: "shorts",
        qty: 1,
        priceText: "30 €",
        image: "https://imidge.com.ua/upload/resize_cache/iblock/f74/600_480_10bcdf2ffa4a6625b617c01ff490c7234/sumka_chanel_model_s1238.jpg",
      },
    ],
  },
  {
    id: "№IM-10211",
    dateText: "26.02.2026",
    statusText: "Завершён",
    totalText: "78 €",
    trackingSteps: ["Заказ получен", "Оплата подтверждена", "Выдан клиенту"],
    items: [
      {
        id: "item-2",
        title: "Medusa Sweatshirt",
        sku: "sweatshirt",
        qty: 1,
        priceText: "48 €",
        image: "https://imidge.com.ua/upload/resize_cache/iblock/bf4/600_480_10bcdf2ffa4a6625b617c01ff490c7234/muzhskie_chasy_longines_model_mx3895.png",
      },
      {
        id: "item-3",
        title: "Medusa T-Shirt",
        sku: "t-shirt",
        qty: 1,
        priceText: "30 €",
        image: "https://imidge.com.ua/upload/resize_cache/iblock/4f7/600_480_10bcdf2ffa4a6625b617c01ff490c7234/remen_celine_model_b239.jpg",
      },
    ],
  },
];

const FAVORITES: FavoriteItem[] = [
  {
    id: "fav-1",
    brand: "Chanel",
    title: "Женская сумка S1238",
    priceText: "13 700 грн",
    href: "/product/shorts?v2=1",
    image: "https://imidge.com.ua/upload/resize_cache/iblock/f74/600_480_10bcdf2ffa4a6625b617c01ff490c7234/sumka_chanel_model_s1238.jpg",
  },
  {
    id: "fav-2",
    brand: "Longines",
    title: "Мужские часы MX3895",
    priceText: "11 500 грн",
    href: "/product/sweatshirt?v2=1",
    image: "https://imidge.com.ua/upload/resize_cache/iblock/bf4/600_480_10bcdf2ffa4a6625b617c01ff490c7234/muzhskie_chasy_longines_model_mx3895.png",
  },
  {
    id: "fav-3",
    brand: "Celine",
    title: "Ремень B239",
    priceText: "3 950 грн",
    href: "/product/t-shirt?v2=1",
    image: "https://imidge.com.ua/upload/resize_cache/iblock/4f7/600_480_10bcdf2ffa4a6625b617c01ff490c7234/remen_celine_model_b239.jpg",
  },
];

export function AccountPageClient() {
  const [activeTab, setActiveTab] = useState<AccountTab>("profile");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(ORDER_HISTORY[0]?.id ?? null);
  const [areaOptions, setAreaOptions] = useState<DeliveryOption[]>([]);
  const [cityOptions, setCityOptions] = useState<DeliveryOption[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<DeliveryOption[]>([]);
  const [selectedAreaRef, setSelectedAreaRef] = useState("");
  const [selectedCityRef, setSelectedCityRef] = useState("");
  const [selectedWarehouseRef, setSelectedWarehouseRef] = useState("");
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);
  const [addressStatus, setAddressStatus] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<AddressRecord[]>([
    {
      id: "addr-1",
      title: "Основной адрес",
      summary: "Киевская область, Киев, Отделение №173 · Получатель: Павел Клиент",
    },
  ]);

  const selectedAreaName = useMemo(
    () => areaOptions.find((area) => area.ref === selectedAreaRef)?.name ?? "",
    [areaOptions, selectedAreaRef]
  );
  const selectedCityName = useMemo(
    () => cityOptions.find((city) => city.ref === selectedCityRef)?.name ?? "",
    [cityOptions, selectedCityRef]
  );
  const selectedWarehouseName = useMemo(
    () => warehouseOptions.find((warehouse) => warehouse.ref === selectedWarehouseRef)?.name ?? "",
    [warehouseOptions, selectedWarehouseRef]
  );

  useEffect(() => {
    let cancelled = false;

    const loadAreas = async () => {
      setIsLoadingAreas(true);
      try {
        const response = await fetch("/api/novaposhta/areas", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Не удалось загрузить области");
        }

        const payload = (await response.json()) as { areas?: DeliveryOption[] };
        if (!cancelled) {
          setAreaOptions(payload.areas ?? []);
        }
      } catch {
        if (!cancelled) {
          setAddressStatus("Не удалось загрузить области доставки.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAreas(false);
        }
      }
    };

    loadAreas().catch(() => null);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedCityRef("");
    setSelectedWarehouseRef("");
    setCityOptions([]);
    setWarehouseOptions([]);

    if (!selectedAreaRef) {
      return;
    }

    let cancelled = false;

    const loadCities = async () => {
      setIsLoadingCities(true);
      try {
        const response = await fetch(`/api/novaposhta/cities?areaRef=${encodeURIComponent(selectedAreaRef)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Не удалось загрузить населённые пункты");
        }

        const payload = (await response.json()) as { cities?: DeliveryOption[] };
        if (!cancelled) {
          setCityOptions(payload.cities ?? []);
        }
      } catch {
        if (!cancelled) {
          setAddressStatus("Не удалось загрузить населённые пункты.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCities(false);
        }
      }
    };

    loadCities().catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [selectedAreaRef]);

  useEffect(() => {
    setSelectedWarehouseRef("");
    setWarehouseOptions([]);

    if (!selectedCityRef) {
      return;
    }

    let cancelled = false;

    const loadWarehouses = async () => {
      setIsLoadingWarehouses(true);
      try {
        const response = await fetch(`/api/novaposhta/warehouses?cityRef=${encodeURIComponent(selectedCityRef)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Не удалось загрузить отделения");
        }

        const payload = (await response.json()) as { warehouses?: DeliveryOption[] };
        if (!cancelled) {
          setWarehouseOptions(payload.warehouses ?? []);
        }
      } catch {
        if (!cancelled) {
          setAddressStatus("Не удалось загрузить отделения Новой почты.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWarehouses(false);
        }
      }
    };

    loadWarehouses().catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [selectedCityRef]);

  const handleAddAddress = () => {
    if (!selectedAreaName || !selectedCityName || !selectedWarehouseName || !recipient.trim() || !phone.trim()) {
      setAddressStatus("Заполните все поля адреса перед добавлением.");
      return;
    }

    const nextAddress: AddressRecord = {
      id: `addr-${Date.now()}`,
      title: `Адрес ${savedAddresses.length + 1}`,
      summary: `${selectedAreaName}, ${selectedCityName}, ${selectedWarehouseName} · Получатель: ${recipient.trim()}`,
    };

    setSavedAddresses((current) => [nextAddress, ...current]);
    setAddressStatus("Адрес добавлен.");
    setRecipient("");
    setPhone("");
  };

  return (
    <section className="section account-section">
      <div className="container">
        <div className="account-breadcrumbs">
          <Link href="/">Главная</Link>
          <span aria-hidden="true">›</span>
          <span>Личный кабинет</span>
        </div>
        <h1 className="account-title">Личный кабинет</h1>

        <div className="account-layout">
          <aside className="account-panel account-side">
            <button type="button" className={`account-tab-btn${activeTab === "profile" ? " active" : ""}`} onClick={() => setActiveTab("profile")}>Профиль</button>
            <button type="button" className={`account-tab-btn${activeTab === "orders" ? " active" : ""}`} onClick={() => setActiveTab("orders")}>Заказы</button>
            <button type="button" className={`account-tab-btn${activeTab === "favorites" ? " active" : ""}`} onClick={() => setActiveTab("favorites")}>Избранное</button>
            <button type="button" className={`account-tab-btn${activeTab === "addresses" ? " active" : ""}`} onClick={() => setActiveTab("addresses")}>Адреса</button>
          </aside>

          <div className="account-panel account-content">
            {activeTab === "profile" && (
              <div>
                <h2 className="account-section-title">Профиль</h2>
                <div className="account-grid-2">
                  <label className="account-field">
                    <span>ФИО</span>
                    <input defaultValue="Павел Клиент" />
                  </label>
                  <label className="account-field">
                    <span>Телефон</span>
                    <input defaultValue="+380 50 993 95 53" />
                  </label>
                  <label className="account-field">
                    <span>Email</span>
                    <input defaultValue="client@example.com" />
                  </label>
                  <label className="account-field">
                    <span>Telegram</span>
                    <input defaultValue="@imidge_client" />
                  </label>
                  <label className="account-field account-span-2">
                    <span>Комментарий к профилю</span>
                    <textarea placeholder="Предпочтения по брендам, размеру, доставке..." />
                  </label>
                </div>
                <div className="account-actions-row">
                  <button type="button" className="account-btn primary">Сохранить профиль</button>
                  <button type="button" className="account-btn">Изменить пароль</button>
                </div>
              </div>
            )}

            {activeTab === "orders" && (
              <div>
                <h2 className="account-section-title">Заказы</h2>
                {ORDER_HISTORY.map((order) => {
                  const expanded = expandedOrderId === order.id;
                  return (
                    <article key={order.id} className="account-order-card">
                      <div className="account-order-head">
                        <p className="account-order-id">{order.id}</p>
                        <p className="account-order-status">{order.dateText} · {order.statusText} · {order.totalText}</p>
                      </div>

                      <div className="account-order-products">
                        {order.items.map((item) => (
                          <div key={item.id} className="account-order-item">
                            <img src={item.image} alt={item.title} className="account-order-photo" />
                            <div>
                              <p className="account-order-item-name">{item.title}</p>
                              <p className="account-order-item-sku">/{item.sku}</p>
                            </div>
                            <p className="account-order-item-qty">{item.qty} × {item.priceText}</p>
                          </div>
                        ))}
                      </div>

                      <div className="account-order-meta">
                        <p className="account-order-ttn">ТТН: <strong>{order.ttn ?? "—"}</strong></p>
                        <button
                          type="button"
                          className="account-btn account-track-btn"
                          onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                        >
                          {expanded ? "Скрыть трекинг" : "Показать трекинг"}
                        </button>
                      </div>

                      {expanded && (
                        <div className="account-track-state">
                          <ul>
                            {order.trackingSteps.map((step) => (
                              <li key={`${order.id}-${step}`}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {activeTab === "favorites" && (
              <div>
                <h2 className="account-section-title">Избранное</h2>
                <div className="account-favorites-grid">
                  {FAVORITES.map((item) => (
                    <article className="account-fav-card" key={item.id}>
                      <Link href={item.href} aria-label={`Открыть товар ${item.title}`}>
                        <img src={item.image} alt={item.title} className="account-fav-image" />
                      </Link>
                      <div className="account-fav-body">
                        <p className="account-fav-brand">{item.brand}</p>
                        <p className="account-fav-name">
                          <Link href={item.href}>{item.title}</Link>
                        </p>
                        <p className="account-fav-price">{item.priceText}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "addresses" && (
              <div>
                <h2 className="account-section-title">Адреса доставки</h2>

                <div className="account-address-list">
                  {savedAddresses.map((address) => (
                    <article key={address.id} className="account-address-card">
                      <h4>{address.title}</h4>
                      <p>{address.summary}</p>
                    </article>
                  ))}
                </div>

                <div className="account-grid-2">
                  <label className="account-field">
                    <span>Область</span>
                    <select value={selectedAreaRef} onChange={(event) => setSelectedAreaRef(event.target.value)} disabled={isLoadingAreas}>
                      <option value="">{isLoadingAreas ? "Загрузка областей..." : "Выберите область"}</option>
                      {areaOptions.map((area) => (
                        <option key={area.ref} value={area.ref}>{area.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="account-field">
                    <span>Населенный пункт</span>
                    <select value={selectedCityRef} onChange={(event) => setSelectedCityRef(event.target.value)} disabled={!selectedAreaRef || isLoadingCities}>
                      <option value="">
                        {!selectedAreaRef
                          ? "Сначала выберите область"
                          : isLoadingCities
                            ? "Загрузка населённых пунктов..."
                            : "Выберите населённый пункт"}
                      </option>
                      {cityOptions.map((city) => (
                        <option key={city.ref} value={city.ref}>{city.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="account-field account-span-2">
                    <span>Отделение Новой почты</span>
                    <select value={selectedWarehouseRef} onChange={(event) => setSelectedWarehouseRef(event.target.value)} disabled={!selectedCityRef || isLoadingWarehouses}>
                      <option value="">
                        {!selectedCityRef
                          ? "Сначала выберите населённый пункт"
                          : isLoadingWarehouses
                            ? "Загрузка отделений..."
                            : "Выберите отделение"}
                      </option>
                      {warehouseOptions.map((warehouse) => (
                        <option key={warehouse.ref} value={warehouse.ref}>{warehouse.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="account-field">
                    <span>Получатель</span>
                    <input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="ФИО" />
                  </label>
                  <label className="account-field">
                    <span>Телефон</span>
                    <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+380..." />
                  </label>
                </div>

                <div className="account-actions-row">
                  <button type="button" className="account-btn primary" onClick={handleAddAddress}>Добавить адрес</button>
                </div>
                <p className="account-address-status" aria-live="polite">{addressStatus}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
