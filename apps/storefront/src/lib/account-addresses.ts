export type AccountAddress = {
  id: string;
  areaRef: string;
  areaName: string;
  cityRef: string;
  cityName: string;
  warehouseRef: string;
  warehouseName: string;
  recipient: string;
  phone: string;
  isPriority: boolean;
};

export const DEFAULT_ACCOUNT_ADDRESSES: AccountAddress[] = [
  {
    id: "addr-1",
    areaRef: "",
    areaName: "Киевская обл.",
    cityRef: "",
    cityName: "Киев",
    warehouseRef: "",
    warehouseName: "Отделение №12, ул. Крещатик, 10",
    recipient: "Павел Клиент",
    phone: "+380509939553",
    isPriority: true,
  },
  {
    id: "addr-2",
    areaRef: "",
    areaName: "Днепропетровская обл.",
    cityRef: "",
    cityName: "Днепр",
    warehouseRef: "",
    warehouseName: "Отделение №3, просп. Дмитрия Яворницкого, 81",
    recipient: "Павел Клиент",
    phone: "+380509939553",
    isPriority: false,
  },
];

function normalizeAddressEntry(raw: unknown, fallbackId: string): AccountAddress | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const payload = raw as Partial<AccountAddress>;

  const id = typeof payload.id === "string" && payload.id.trim() ? payload.id.trim() : fallbackId;
  const areaRef = typeof payload.areaRef === "string" ? payload.areaRef.trim() : "";
  const areaName = typeof payload.areaName === "string" ? payload.areaName.trim() : "";
  const cityRef = typeof payload.cityRef === "string" ? payload.cityRef.trim() : "";
  const cityName = typeof payload.cityName === "string" ? payload.cityName.trim() : "";
  const warehouseRef = typeof payload.warehouseRef === "string" ? payload.warehouseRef.trim() : "";
  const warehouseName = typeof payload.warehouseName === "string" ? payload.warehouseName.trim() : "";
  const recipient = typeof payload.recipient === "string" ? payload.recipient.trim() : "";
  const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";

  if (!areaName || !cityName || !warehouseName || !recipient || !phone) {
    return null;
  }

  return {
    id,
    areaRef,
    areaName,
    cityRef,
    cityName,
    warehouseRef,
    warehouseName,
    recipient,
    phone,
    isPriority: payload.isPriority === true,
  };
}

export function normalizeAccountAddresses(raw: unknown): AccountAddress[] {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_ACCOUNT_ADDRESSES];
  }

  const normalized = raw
    .map((entry, index) => normalizeAddressEntry(entry, `addr-${index + 1}`))
    .filter((entry): entry is AccountAddress => Boolean(entry));

  if (normalized.length === 0) {
    return [...DEFAULT_ACCOUNT_ADDRESSES];
  }

  const hasPriority = normalized.some((address) => address.isPriority);
  if (!hasPriority) {
    normalized[0] = { ...normalized[0], isPriority: true };
  }

  return [...normalized].sort((first, second) => Number(second.isPriority) - Number(first.isPriority));
}

export function getPriorityAddress(addresses: AccountAddress[]) {
  return addresses.find((address) => address.isPriority) ?? addresses[0] ?? null;
}
