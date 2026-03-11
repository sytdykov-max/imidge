"use client";

import { useEffect, useState } from "react";

type ThankYouSummaryItem = {
  id: string;
  title: string;
  quantity: number;
  total: number;
};

type ThankYouOrderSummary = {
  orderId: string;
  createdAt: string;
  customer?: {
    fullName?: string;
    phone?: string;
    telegram?: string;
    comment?: string;
  };
  deliveryAddress?: {
    region?: string;
    city?: string;
    warehouse?: string;
  };
  deliveryMethod: string;
  paymentMethod: string;
  subtotal: number;
  total: number;
  items: ThankYouSummaryItem[];
};

type ThankYouPageClientProps = {
  orderId: string;
};

function money(value = 0) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function deliveryLabel(value: string) {
  return value === "courier" ? "Курьер" : "Новая почта";
}

function paymentLabel(value: string) {
  return value === "card" ? "Оплата картой" : "Наложенный платеж";
}

export function ThankYouPageClient({ orderId }: ThankYouPageClientProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [orderSummary, setOrderSummary] = useState<ThankYouOrderSummary | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("imidgeLastOrderSummary");
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<ThankYouOrderSummary>;
      if (!parsed || parsed.orderId !== orderId || !Array.isArray(parsed.items)) {
        return;
      }

      setOrderSummary({
        orderId: parsed.orderId,
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "",
        customer: {
          fullName: parsed.customer?.fullName,
          phone: parsed.customer?.phone,
          telegram: parsed.customer?.telegram,
          comment: parsed.customer?.comment,
        },
        deliveryAddress: {
          region: parsed.deliveryAddress?.region,
          city: parsed.deliveryAddress?.city,
          warehouse: parsed.deliveryAddress?.warehouse,
        },
        deliveryMethod: typeof parsed.deliveryMethod === "string" ? parsed.deliveryMethod : "nova_poshta",
        paymentMethod: typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : "cod",
        subtotal: typeof parsed.subtotal === "number" ? parsed.subtotal : 0,
        total: typeof parsed.total === "number" ? parsed.total : 0,
        items: parsed.items
          .map((item) => ({
            id: typeof item.id === "string" ? item.id : `item-${Math.random()}`,
            title: typeof item.title === "string" ? item.title : "Товар",
            quantity: typeof item.quantity === "number" ? item.quantity : 1,
            total: typeof item.total === "number" ? item.total : 0,
          }))
          .filter((item) => item.title.trim().length > 0),
      });
    } catch {
      return;
    }
  }, [orderId]);

  const onCopyOrderId = async () => {
    if (!orderId) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(orderId);
      } else {
        const input = document.createElement("input");
        input.value = orderId;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }

      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1200);
    } catch {
      return;
    }
  };

  return (
    <div className="thank-you-meta">
      <p>
        Статус: <strong>Заказ принят</strong>
      </p>
      <div className="thank-you-order-row">
        <p>
          Номер заказа: <strong>{orderId}</strong>
        </p>
        <button type="button" className="thank-you-copy-btn" onClick={onCopyOrderId} aria-label="Скопировать номер заказа">
          ⧉
        </button>
        <span className={`thank-you-copy-state${isCopied ? " show" : ""}`}>Скопировано</span>
      </div>
      <p>
        Подтверждение: в течение <strong>15–30 минут</strong>
      </p>

      {orderSummary && orderSummary.items.length > 0 && (
        <div className="thank-you-summary">
          <h3>Детали заказа</h3>
          <div className="thank-you-summary-list">
            {orderSummary.items.map((item) => (
              <p key={item.id} className="thank-you-summary-line">
                <span>{item.title} × {item.quantity}</span>
                <strong>{money(item.total)}</strong>
              </p>
            ))}
          </div>
          <p className="thank-you-summary-line">
            <span>Доставка</span>
            <strong>Бесплатно</strong>
          </p>
          <p className="thank-you-summary-line">
            <span>Способ доставки</span>
            <strong>{deliveryLabel(orderSummary.deliveryMethod)}</strong>
          </p>
          <p className="thank-you-summary-line">
            <span>Способ оплаты</span>
            <strong>{paymentLabel(orderSummary.paymentMethod)}</strong>
          </p>
          <p className="thank-you-summary-total">
            <span>Итого</span>
            <strong>{money(orderSummary.total || orderSummary.subtotal)}</strong>
          </p>
        </div>
      )}

      {orderSummary?.customer && (
        <div className="thank-you-summary">
          <h3>Данные получателя</h3>
          <p className="thank-you-summary-line">
            <span>ФИО</span>
            <strong>{orderSummary.customer.fullName || "—"}</strong>
          </p>
          <p className="thank-you-summary-line">
            <span>Телефон</span>
            <strong>{orderSummary.customer.phone || "—"}</strong>
          </p>
          {orderSummary.customer.telegram ? (
            <p className="thank-you-summary-line">
              <span>Telegram</span>
              <strong>{orderSummary.customer.telegram}</strong>
            </p>
          ) : null}
          <p className="thank-you-summary-line">
            <span>Область</span>
            <strong>{orderSummary.deliveryAddress?.region || "—"}</strong>
          </p>
          <p className="thank-you-summary-line">
            <span>Населенный пункт</span>
            <strong>{orderSummary.deliveryAddress?.city || "—"}</strong>
          </p>
          <p className="thank-you-summary-line">
            <span>Отделение</span>
            <strong>{orderSummary.deliveryAddress?.warehouse || "—"}</strong>
          </p>
          {orderSummary.customer.comment ? (
            <p className="thank-you-summary-line">
              <span>Комментарий</span>
              <strong>{orderSummary.customer.comment}</strong>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
