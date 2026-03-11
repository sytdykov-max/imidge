export type AccountProfile = {
  fullName: string;
  phone: string;
  email: string;
  telegram: string;
  comment: string;
  preferredDeliveryMethod: string;
  preferredPaymentMethod: string;
};

export const DEFAULT_ACCOUNT_PROFILE: AccountProfile = {
  fullName: "Павел Клиент",
  phone: "+380 50 993 95 53",
  email: "client@example.com",
  telegram: "@imidge_client",
  comment: "",
  preferredDeliveryMethod: "nova_poshta",
  preferredPaymentMethod: "cod",
};

export function normalizeAccountProfile(raw: unknown): AccountProfile {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_ACCOUNT_PROFILE };
  }

  const payload = raw as Partial<AccountProfile>;

  return {
    fullName: typeof payload.fullName === "string" && payload.fullName.trim() ? payload.fullName.trim() : DEFAULT_ACCOUNT_PROFILE.fullName,
    phone: typeof payload.phone === "string" && payload.phone.trim() ? payload.phone.trim() : DEFAULT_ACCOUNT_PROFILE.phone,
    email: typeof payload.email === "string" && payload.email.trim() ? payload.email.trim() : DEFAULT_ACCOUNT_PROFILE.email,
    telegram: typeof payload.telegram === "string" ? payload.telegram.trim() : "",
    comment: typeof payload.comment === "string" ? payload.comment.trim() : "",
    preferredDeliveryMethod:
      payload.preferredDeliveryMethod === "courier" || payload.preferredDeliveryMethod === "nova_poshta"
        ? payload.preferredDeliveryMethod
        : DEFAULT_ACCOUNT_PROFILE.preferredDeliveryMethod,
    preferredPaymentMethod:
      payload.preferredPaymentMethod === "card" || payload.preferredPaymentMethod === "cod"
        ? payload.preferredPaymentMethod
        : DEFAULT_ACCOUNT_PROFILE.preferredPaymentMethod,
  };
}
