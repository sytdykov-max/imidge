const NOVA_POSHTA_ENDPOINT = "https://api.novaposhta.ua/v2.0/json/";

type NovaPoshtaEnvelope<T> = {
  success?: boolean;
  data?: T[];
  errors?: string[];
  warnings?: string[];
};

type NovaPoshtaMethod = {
  modelName: string;
  calledMethod: string;
  methodProperties?: Record<string, unknown>;
};

export type NovaPoshtaArea = {
  Ref: string;
  Description: string;
};

export type NovaPoshtaCity = {
  Ref: string;
  Description: string;
};

export type NovaPoshtaWarehouse = {
  Ref: string;
  Description: string;
};

function getApiKey() {
  return (
    process.env.NOVA_POSHTA_API_KEY ??
    process.env.NOVAPOSHTA_API_KEY ??
    process.env.NP_API_KEY ??
    ""
  ).trim();
}

export function hasNovaPoshtaApiKey() {
  return Boolean(getApiKey());
}

export async function callNovaPoshta<T>({ modelName, calledMethod, methodProperties = {} }: NovaPoshtaMethod): Promise<T[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("NOVA_POSHTA_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(NOVA_POSHTA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey,
        modelName,
        calledMethod,
        methodProperties,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Nova Poshta HTTP ${response.status}`);
    }

    const payload = (await response.json()) as NovaPoshtaEnvelope<T>;
    if (!payload.success) {
      const reason = payload.errors?.[0] ?? payload.warnings?.[0] ?? "Nova Poshta request failed";
      throw new Error(reason);
    }

    return payload.data ?? [];
  } finally {
    clearTimeout(timeout);
  }
}