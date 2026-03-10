import { completeCurrentCart } from "@/lib/medusa-browser";

export type CheckoutFormValues = {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
};

export type CheckoutFormErrors = Partial<Record<keyof CheckoutFormValues, string>>;

export type CheckoutSubmitResult = {
  ok: boolean;
  message: string;
  orderId?: string;
  displayId?: number;
};

export function formatCheckoutPhone(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 12);

  let normalized = digits;
  if (!normalized.startsWith("380") && normalized.length >= 10) {
    normalized = `380${normalized.slice(-9)}`;
  }

  if (normalized.length === 0) {
    return "";
  }

  const country = normalized.slice(0, 3);
  const area = normalized.slice(3, 5);
  const part1 = normalized.slice(5, 8);
  const part2 = normalized.slice(8, 10);
  const part3 = normalized.slice(10, 12);

  let formatted = `+${country}`;
  if (area) {
    formatted += ` (${area}`;
  }
  if (area.length === 2) {
    formatted += ")";
  }
  if (part1) {
    formatted += ` ${part1}`;
  }
  if (part2) {
    formatted += `-${part2}`;
  }
  if (part3) {
    formatted += `-${part3}`;
  }

  return formatted;
}

export function validateCheckoutForm(values: CheckoutFormValues): {
  valid: boolean;
  errors: CheckoutFormErrors;
} {
  const errors: CheckoutFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Введите имя";
  }

  const phoneDigits = values.phone.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    errors.phone = "Введите корректный телефон";
  }

  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) {
    errors.email = "Введите корректный email";
  }

  if (!values.city.trim()) {
    errors.city = "Введите город";
  }

  if (!values.address.trim()) {
    errors.address = "Введите адрес";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export async function submitCheckout(values: CheckoutFormValues): Promise<CheckoutSubmitResult> {
  const result = await completeCurrentCart(values);

  if (result?.displayId) {
    return {
      ok: true,
      message: `Заказ #${result.displayId} успешно создан.`,
      orderId: result.orderId,
      displayId: result.displayId,
    };
  }

  if (result?.orderId) {
    return {
      ok: true,
      message: `Заказ создан: ${result.orderId}`,
      orderId: result.orderId,
    };
  }

  return {
    ok: false,
    message: "Не удалось завершить оформление заказа.",
  };
}
