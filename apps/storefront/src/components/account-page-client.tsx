"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getWishlistItems, getWishlistUpdateEventName, type WishlistItem } from "@/lib/wishlist";
import { DEFAULT_ACCOUNT_PROFILE } from "@/lib/account-profile";
import { DEFAULT_ACCOUNT_ADDRESSES, type AccountAddress } from "@/lib/account-addresses";

type AccountTab = "profile" | "orders" | "favorites" | "addresses";

type DeliveryOption = {
  ref: string;
  name: string;
};

type AddressRecord = AccountAddress;

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
  items: OrderItem[];
};

type FavoriteItem = WishlistItem & { id: string };

const ORDER_HISTORY: OrderRecord[] = [
  {
    id: "№IM-10284",
    dateText: "10.03.2026",
    statusText: "Отправлен",
    totalText: "30 €",
    ttn: "20451099871234",
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

export function AccountPageClient() {
  const [activeTab, setActiveTab] = useState<AccountTab>("profile");
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [profileFullName, setProfileFullName] = useState(DEFAULT_ACCOUNT_PROFILE.fullName);
  const [profilePhone, setProfilePhone] = useState(DEFAULT_ACCOUNT_PROFILE.phone);
  const [profileEmail, setProfileEmail] = useState(DEFAULT_ACCOUNT_PROFILE.email);
  const [profileTelegram, setProfileTelegram] = useState(DEFAULT_ACCOUNT_PROFILE.telegram);
  const [profileComment, setProfileComment] = useState(DEFAULT_ACCOUNT_PROFILE.comment);
  const [profilePreferredDeliveryMethod, setProfilePreferredDeliveryMethod] = useState(
    DEFAULT_ACCOUNT_PROFILE.preferredDeliveryMethod
  );
  const [profilePreferredPaymentMethod, setProfilePreferredPaymentMethod] = useState(
    DEFAULT_ACCOUNT_PROFILE.preferredPaymentMethod
  );
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [areaOptions, setAreaOptions] = useState<DeliveryOption[]>([]);
  const [cityOptions, setCityOptions] = useState<DeliveryOption[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<DeliveryOption[]>([]);
  const [selectedAreaRef, setSelectedAreaRef] = useState("");
  const [selectedCityRef, setSelectedCityRef] = useState("");
  const [selectedWarehouseRef, setSelectedWarehouseRef] = useState("");
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);
  const [addressStatus, setAddressStatus] = useState("");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<AddressRecord[]>(DEFAULT_ACCOUNT_ADDRESSES);
  const [isAddressesLoaded, setIsAddressesLoaded] = useState(false);

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
  const orderedAddresses = useMemo(() => {
    const priorityAddress = savedAddresses.find((address) => address.isPriority);
    if (!priorityAddress) {
      return savedAddresses;
    }

    const otherAddresses = savedAddresses.filter((address) => address.id !== priorityAddress.id);
    return [priorityAddress, ...otherAddresses];
  }, [savedAddresses]);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const response = await fetch("/api/account/profile", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          profile?: {
            fullName?: string;
            phone?: string;
            email?: string;
            telegram?: string;
            comment?: string;
            preferredDeliveryMethod?: string;
            preferredPaymentMethod?: string;
          };
        };

        if (cancelled || !payload.profile) {
          return;
        }

        setProfileFullName(payload.profile.fullName ?? DEFAULT_ACCOUNT_PROFILE.fullName);
        setProfilePhone(payload.profile.phone ?? DEFAULT_ACCOUNT_PROFILE.phone);
        setProfileEmail(payload.profile.email ?? DEFAULT_ACCOUNT_PROFILE.email);
        setProfileTelegram(payload.profile.telegram ?? DEFAULT_ACCOUNT_PROFILE.telegram);
        setProfileComment(payload.profile.comment ?? DEFAULT_ACCOUNT_PROFILE.comment);
        setProfilePreferredDeliveryMethod(
          payload.profile.preferredDeliveryMethod === "courier" || payload.profile.preferredDeliveryMethod === "nova_poshta"
            ? payload.profile.preferredDeliveryMethod
            : DEFAULT_ACCOUNT_PROFILE.preferredDeliveryMethod
        );
        setProfilePreferredPaymentMethod(
          payload.profile.preferredPaymentMethod === "card" || payload.profile.preferredPaymentMethod === "cod"
            ? payload.profile.preferredPaymentMethod
            : DEFAULT_ACCOUNT_PROFILE.preferredPaymentMethod
        );
      } catch {
        return;
      }
    };

    loadProfile().catch(() => null);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAddresses = async () => {
      try {
        const response = await fetch("/api/account/addresses", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { addresses?: AddressRecord[] };
        if (!cancelled && Array.isArray(payload.addresses) && payload.addresses.length > 0) {
          setSavedAddresses(payload.addresses);
        }
      } catch {
        return;
      } finally {
        if (!cancelled) {
          setIsAddressesLoaded(true);
        }
      }
    };

    loadAddresses().catch(() => null);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAddressesLoaded) {
      return;
    }

    fetch("/api/account/addresses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(savedAddresses),
    }).catch(() => null);
  }, [isAddressesLoaded, savedAddresses]);

  useEffect(() => {
    const syncFavorites = () => {
      const nextItems = getWishlistItems().map((item, index) => ({
        ...item,
        id: `${item.handle}-${index}`,
      }));
      setFavoriteItems(nextItems);
    };

    syncFavorites();
    window.addEventListener("storage", syncFavorites);
    window.addEventListener(getWishlistUpdateEventName(), syncFavorites as EventListener);

    return () => {
      window.removeEventListener("storage", syncFavorites);
      window.removeEventListener(getWishlistUpdateEventName(), syncFavorites as EventListener);
    };
  }, []);

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

  const resetAddressForm = () => {
    setSelectedAreaRef("");
    setSelectedCityRef("");
    setSelectedWarehouseRef("");
    setCityOptions([]);
    setWarehouseOptions([]);
    setEditingAddressId(null);
  };

  const handleSaveAddress = () => {
    if (!selectedAreaName || !selectedCityName || !selectedWarehouseName) {
      setAddressStatus("Заполните все поля адреса перед добавлением.");
      return;
    }

    const recipientFromProfile = profileFullName.trim() || DEFAULT_ACCOUNT_PROFILE.fullName;
    const phoneFromProfile = profilePhone.trim() || DEFAULT_ACCOUNT_PROFILE.phone;

    if (editingAddressId) {
      setSavedAddresses((current) =>
        current.map((address) =>
          address.id === editingAddressId
            ? {
                ...address,
                areaRef: selectedAreaRef,
                areaName: selectedAreaName,
                cityRef: selectedCityRef,
                cityName: selectedCityName,
                warehouseRef: selectedWarehouseRef,
                warehouseName: selectedWarehouseName,
                recipient: recipientFromProfile,
                phone: phoneFromProfile,
              }
            : address
        )
      );
      setAddressStatus("Адрес обновлён.");
      resetAddressForm();
      return;
    }

    const hasPriority = savedAddresses.some((address) => address.isPriority);
    const nextAddress: AddressRecord = {
      id: `addr-${Date.now()}`,
      areaRef: selectedAreaRef,
      areaName: selectedAreaName,
      cityRef: selectedCityRef,
      cityName: selectedCityName,
      warehouseRef: selectedWarehouseRef,
      warehouseName: selectedWarehouseName,
      recipient: recipientFromProfile,
      phone: phoneFromProfile,
      isPriority: !hasPriority,
    };

    setSavedAddresses((current) => [nextAddress, ...current]);
    setAddressStatus("Адрес добавлен.");
    resetAddressForm();
  };

  const handleSetPriority = (addressId: string) => {
    setSavedAddresses((current) => {
      const updated = current.map((address) => ({
        ...address,
        isPriority: address.id === addressId,
      }));

      return [...updated].sort((first, second) => Number(second.isPriority) - Number(first.isPriority));
    });
    setAddressStatus("Приоритетный адрес обновлён.");
  };

  const handleDeleteAddress = (addressId: string) => {
    setSavedAddresses((current) => {
      const filtered = current.filter((address) => address.id !== addressId);
      if (filtered.length === 0) {
        return filtered;
      }

      if (filtered.some((address) => address.isPriority)) {
        return filtered;
      }

      const [firstAddress, ...rest] = filtered;
      return [{ ...firstAddress, isPriority: true }, ...rest];
    });

    if (editingAddressId === addressId) {
      resetAddressForm();
    }

    setAddressStatus("Адрес удалён.");
  };

  const handleEditAddress = (address: AddressRecord) => {
    setEditingAddressId(address.id);
    setSelectedAreaRef(address.areaRef);
    setSelectedCityRef(address.cityRef);
    setSelectedWarehouseRef(address.warehouseRef);
    setAddressStatus(
      address.areaRef && address.cityRef && address.warehouseRef
        ? "Режим редактирования адреса."
        : "Режим редактирования: выберите область, населённый пункт и отделение из списков."
    );
  };

  const handleSaveProfile = async () => {
    const hasOldPassword = oldPassword.length > 0;
    const hasNewPassword = newPassword.length > 0;

    if (hasOldPassword !== hasNewPassword) {
      setProfileStatus("Для смены пароля заполните поля «Старый пароль» и «Новый пароль».");
      return;
    }

    if (hasOldPassword && hasNewPassword && newPassword.length < 8) {
      setProfileStatus("Новый пароль должен содержать минимум 8 символов.");
      return;
    }

    if (hasOldPassword && hasNewPassword && oldPassword === newPassword) {
      setProfileStatus("Новый пароль должен отличаться от старого.");
      return;
    }

    setIsProfileSaving(true);
    setProfileStatus("Сохраняем изменения...");

    try {
      const profileResponse = await fetch("/api/account/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: profileFullName,
          phone: profilePhone,
          email: profileEmail,
          telegram: profileTelegram,
          comment: profileComment,
          preferredDeliveryMethod: profilePreferredDeliveryMethod,
          preferredPaymentMethod: profilePreferredPaymentMethod,
        }),
      });

      const profilePayload = (await profileResponse.json()) as { message?: string };
      if (!profileResponse.ok) {
        setProfileStatus(profilePayload.message || "Не удалось сохранить профиль.");
        return;
      }

      setSavedAddresses((current) =>
        current.map((address) => ({
          ...address,
          recipient: profileFullName.trim() || DEFAULT_ACCOUNT_PROFILE.fullName,
          phone: profilePhone.trim() || DEFAULT_ACCOUNT_PROFILE.phone,
        }))
      );

      if (!hasOldPassword && !hasNewPassword) {
        setProfileStatus("Профиль сохранён.");
        return;
      }

      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setProfileStatus(payload.message || "Не удалось изменить пароль.");
        return;
      }

      setOldPassword("");
      setNewPassword("");
      setProfileStatus("Профиль сохранён. Пароль успешно изменён.");
    } catch {
      setProfileStatus("Не удалось изменить пароль. Проверьте соединение и попробуйте снова.");
    } finally {
      setIsProfileSaving(false);
    }
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
                    <input value={profileFullName} onChange={(event) => setProfileFullName(event.target.value)} />
                  </label>
                  <label className="account-field">
                    <span>Телефон</span>
                    <input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} autoComplete="tel" />
                  </label>
                  <label className="account-field">
                    <span>Email</span>
                    <input value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} autoComplete="email" />
                  </label>
                  <label className="account-field">
                    <span>Telegram</span>
                    <input value={profileTelegram} onChange={(event) => setProfileTelegram(event.target.value)} />
                  </label>
                  <label className="account-field">
                    <span>Способ доставки по умолчанию</span>
                    <select
                      value={profilePreferredDeliveryMethod}
                      onChange={(event) => setProfilePreferredDeliveryMethod(event.target.value)}
                    >
                      <option value="nova_poshta">Новая почта</option>
                      <option value="courier">Курьер</option>
                    </select>
                  </label>
                  <label className="account-field">
                    <span>Способ оплаты по умолчанию</span>
                    <select
                      value={profilePreferredPaymentMethod}
                      onChange={(event) => setProfilePreferredPaymentMethod(event.target.value)}
                    >
                      <option value="cod">Наложенный платеж</option>
                      <option value="card">Оплата картой</option>
                    </select>
                  </label>
                  <label className="account-field account-span-2">
                    <span>Комментарий к профилю</span>
                    <textarea
                      value={profileComment}
                      onChange={(event) => setProfileComment(event.target.value)}
                      placeholder="Предпочтения по брендам, размеру, доставке..."
                    />
                  </label>
                  <label className="account-field">
                    <span>Старый пароль</span>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(event) => setOldPassword(event.target.value)}
                      autoComplete="current-password"
                      placeholder="Введите старый пароль"
                    />
                  </label>
                  <label className="account-field">
                    <span>Новый пароль</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      placeholder="Минимум 8 символов"
                    />
                  </label>
                </div>
                <div className="account-actions-row">
                  <button type="button" className="account-btn primary" onClick={handleSaveProfile} disabled={isProfileSaving}>
                    {isProfileSaving ? "Сохраняем..." : "Сохранить профиль"}
                  </button>
                </div>
                <p className="account-profile-status" aria-live="polite">{profileStatus}</p>
              </div>
            )}

            {activeTab === "orders" && (
              <div>
                <h2 className="account-section-title">Заказы</h2>
                {ORDER_HISTORY.map((order) => {
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
                        <p className="account-order-ttn">
                          ТТН:{" "}
                          {order.ttn ? (
                            <a
                              href={`https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(order.ttn)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {order.ttn}
                            </a>
                          ) : (
                            <strong>—</strong>
                          )}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {activeTab === "favorites" && (
              <div>
                <h2 className="account-section-title">Избранное</h2>
                {favoriteItems.length === 0 ? (
                  <p className="account-empty-note">В избранном пока пусто. Добавьте товары из каталога.</p>
                ) : (
                  <div className="account-favorites-grid">
                    {favoriteItems.map((item) => {
                      const href = `/product/${item.handle}?v2=1`;

                      return (
                        <article className="account-fav-card" key={item.id}>
                          <Link href={href} aria-label={`Открыть товар ${item.title}`}>
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt={item.title} className="account-fav-image" />
                            ) : (
                              <div className="account-fav-image account-fav-image-placeholder">IMIDGE</div>
                            )}
                          </Link>
                          <div className="account-fav-body">
                            <p className="account-fav-brand">{item.brand || "Без бренда"}</p>
                            <p className="account-fav-name">
                              <Link href={href}>{item.title}</Link>
                            </p>
                            {item.priceText ? <p className="account-fav-price">{item.priceText}</p> : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "addresses" && (
              <div>
                <h2 className="account-section-title">Адреса доставки</h2>
                <p className="account-address-status">Получатель и телефон автоматически берутся из раздела «Профиль».</p>

                <div className="account-address-list">
                  {orderedAddresses.map((address) => (
                    <article key={address.id} className="account-address-card">
                      <div className="account-address-card-head">
                        <div>
                          <h4>{address.isPriority ? "Приоритетный адрес" : "Дополнительный адрес"}</h4>
                          <p>
                            {address.areaName}, {address.cityName}, {address.warehouseName}
                          </p>
                        </div>
                        <div className="account-address-actions">
                          {!address.isPriority && (
                            <button type="button" className="account-btn" onClick={() => handleSetPriority(address.id)}>
                              Сделать приоритетным
                            </button>
                          )}
                          <button type="button" className="account-btn" onClick={() => handleEditAddress(address)}>
                            Редактировать
                          </button>
                          <button type="button" className="account-btn" onClick={() => handleDeleteAddress(address.id)}>
                            Удалить
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="account-address-form-box">
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
                  </div>

                  <div className="account-actions-row">
                    <button type="button" className="account-btn primary" onClick={handleSaveAddress}>
                      {editingAddressId ? "Сохранить адрес" : "Добавить адрес"}
                    </button>
                    {editingAddressId && (
                      <button type="button" className="account-btn" onClick={resetAddressForm}>
                        Отменить
                      </button>
                    )}
                  </div>
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
