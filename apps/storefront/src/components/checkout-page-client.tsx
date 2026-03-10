"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatCheckoutPhone,
  submitCheckout,
  type CheckoutFormValues,
  type CheckoutFormErrors,
  validateCheckoutForm,
} from "@/lib/checkout-service";
import { useCartStore } from "@/components/cart-store-provider";
import { useToast } from "@/components/toast-provider";

type CartItem = {
  id: string;
  title: string;
  quantity: number;
  subtotal: number;
};

function money(value = 0, currency = "usd") {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(value);
}

type CheckoutPageClientProps = {
  isCheckoutRedesign?: boolean;
};

export function CheckoutPageClient({ isCheckoutRedesign = false }: CheckoutPageClientProps) {
  const { cart, loading, refreshCart, setCartSnapshot } = useCartStore();
  const [submitting, setSubmitting] = useState(false);
  const { notify } = useToast();
  const router = useRouter();
  const [formValues, setFormValues] = useState<CheckoutFormValues>({
    name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
  });
  const [formErrors, setFormErrors] = useState<CheckoutFormErrors>({});

  useEffect(() => {
    refreshCart().catch(() => null);
  }, [refreshCart]);

  const items = useMemo(() => cart?.items ?? [], [cart]);

  return (
    <>
      {isCheckoutRedesign ? (
        <div className="checkout-v2-head">
          <nav className="checkout-v2-breadcrumbs" aria-label="Хлебные крошки">
            <Link href="/">Главная</Link>
            <span aria-hidden="true">›</span>
            <span>Оформление заказа</span>
          </nav>
          <h1 className="section-title checkout-v2-title">Оформление заказа</h1>
        </div>
      ) : (
        <h1 className="section-title">Checkout</h1>
      )}

      {loading && (
        <p className="section-subtitle" role="status" aria-live="polite">
          Загружаем данные заказа...
        </p>
      )}

      {!loading && items.length === 0 && (
        <div className="empty-state">
          Нет товаров для оформления. <Link href={isCheckoutRedesign ? "/catalog?v2=1" : "/catalog"}>Перейти в каталог</Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className={isCheckoutRedesign ? "checkout-layout checkout-layout-v2" : "checkout-layout"}>
          <form
            className={isCheckoutRedesign ? "checkout-form checkout-form-v2" : "checkout-form"}
            aria-label="Форма оформления заказа"
            onSubmit={async (event) => {
              event.preventDefault();
              if (submitting) {
                return;
              }

              if (items.length === 0) {
                notify({
                  type: "warning",
                  message: "Корзина пуста. Добавьте товары перед оформлением.",
                });
                return;
              }

              const validation = validateCheckoutForm(formValues);
              setFormErrors(validation.errors);

              if (!validation.valid) {
                notify({
                  type: "warning",
                  message: "Проверьте обязательные поля формы.",
                });
                return;
              }

              setSubmitting(true);

              try {
                const result = await submitCheckout(formValues);

                if (result.ok && result.displayId) {
                  notify({
                    type: "success",
                    message: result.message,
                    durationMs: 7000,
                  });
                  setCartSnapshot(null);
                  const orderIdParam = result.orderId ? `&orderId=${encodeURIComponent(result.orderId)}` : "";
                  router.push(
                    `/checkout/success?displayId=${encodeURIComponent(String(result.displayId))}${orderIdParam}${isCheckoutRedesign ? "&v2=1" : ""}`
                  );
                  return;
                }

                if (result.ok && result.orderId) {
                  notify({
                    type: "success",
                    message: result.message,
                    durationMs: 7000,
                  });
                  setCartSnapshot(null);
                  router.push(`/checkout/success?orderId=${encodeURIComponent(result.orderId)}${isCheckoutRedesign ? "&v2=1" : ""}`);
                  return;
                }

                notify({
                  type: "error",
                  message: result.message,
                  durationMs: 6200,
                });
              } catch (error) {
                notify({
                  type: "error",
                  message:
                    error instanceof Error && error.message
                      ? error.message
                      : "Ошибка при создании заказа. Повторите попытку.",
                  durationMs: 6200,
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <h3>{isCheckoutRedesign ? "Контактные данные" : "Контактные данные"}</h3>
            <div className={isCheckoutRedesign ? "checkout-form-grid-v2" : "checkout-form-grid-legacy"}>
              <div className={isCheckoutRedesign ? "checkout-field-v2" : ""}>
                {isCheckoutRedesign && <label htmlFor="checkoutName">Имя</label>}
                <input
                  id="checkoutName"
                  className="field"
                  required
                  placeholder="Имя"
                  aria-label="Имя"
                  autoComplete="name"
                  value={formValues.name}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
            {formErrors.name && <p className="action-message">{formErrors.name}</p>}
              <div className={isCheckoutRedesign ? "checkout-field-v2" : ""}>
                {isCheckoutRedesign && <label htmlFor="checkoutPhone">Телефон</label>}
                <input
                  id="checkoutPhone"
                  className="field"
                  required
                  placeholder="Телефон"
                  aria-label="Телефон"
                  autoComplete="tel"
                  value={formValues.phone}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, phone: formatCheckoutPhone(event.target.value) }))
                  }
                />
              </div>
            {formErrors.phone && <p className="action-message">{formErrors.phone}</p>}
              <div className={isCheckoutRedesign ? "checkout-field-v2 checkout-span-2-v2" : ""}>
                {isCheckoutRedesign && <label htmlFor="checkoutEmail">Email</label>}
                <input
                  id="checkoutEmail"
                  className="field"
                  type="email"
                  required
                  placeholder="Email"
                  aria-label="Email"
                  autoComplete="email"
                  value={formValues.email}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
            {formErrors.email && <p className="action-message">{formErrors.email}</p>}
            </div>

            <h3>Доставка</h3>
            <div className={isCheckoutRedesign ? "checkout-form-grid-v2" : "checkout-form-grid-legacy"}>
              <div className={isCheckoutRedesign ? "checkout-field-v2" : ""}>
                {isCheckoutRedesign && <label htmlFor="checkoutCity">Город</label>}
                <input
                  id="checkoutCity"
                  className="field"
                  required
                  placeholder="Город"
                  aria-label="Город"
                  autoComplete="address-level2"
                  value={formValues.city}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, city: event.target.value }))}
                />
              </div>
            {formErrors.city && <p className="action-message">{formErrors.city}</p>}
              <div className={isCheckoutRedesign ? "checkout-field-v2" : ""}>
                {isCheckoutRedesign && <label htmlFor="checkoutAddress">Адрес</label>}
                <input
                  id="checkoutAddress"
                  className="field"
                  required
                  placeholder="Адрес"
                  aria-label="Адрес"
                  autoComplete="street-address"
                  value={formValues.address}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, address: event.target.value }))}
                />
              </div>
            {formErrors.address && <p className="action-message">{formErrors.address}</p>}
            </div>

            <button type="submit" className="cta-btn checkout-btn" disabled={submitting}>
              {submitting ? "Оформляем..." : "Подтвердить заказ"}
            </button>
            {isCheckoutRedesign && (
              <Link href="/catalog?v2=1" className="checkout-v2-back-link">
                Продолжить покупки
              </Link>
            )}
          </form>

          <aside className={isCheckoutRedesign ? "cart-summary checkout-summary-v2" : "cart-summary"}>
            <h3>Ваш заказ</h3>
            {items.map((item) => (
              <p key={item.id} className="checkout-line">
                <span>
                  {item.title} × {item.quantity}
                </span>
                <strong>{money(item.subtotal, cart?.currency_code)}</strong>
              </p>
            ))}
            <p className="checkout-total">
              <span>К оплате</span>
              <strong>{money(cart?.total, cart?.currency_code)}</strong>
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
