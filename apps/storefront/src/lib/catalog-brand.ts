import type { StoreProduct } from "@/lib/medusa-store";

function readMetadataString(product: StoreProduct, keys: string[]) {
  const metadata = product.metadata;
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function toDisplayBrandFromHandle(handle: string) {
  if (!handle) {
    return "Без бренда";
  }

  const upper = handle.toUpperCase();
  if (handle.length <= 4) {
    return upper;
  }

  return `${upper.charAt(0)}${handle.slice(1).toLowerCase()}`;
}

export function normalizeBrandLabel(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "Без бренда";
  }

  if (/^[A-Za-z]{2,5}$/.test(compact)) {
    return compact.toUpperCase();
  }

  return compact.charAt(0).toUpperCase() + compact.slice(1).toLowerCase();
}

export function extractProductBrand(product: StoreProduct) {
  const metadataBrand = readMetadataString(product, [
    "filter_brand",
    "brand",
    "legacy_brand",
  ]);
  if (metadataBrand) {
    return normalizeBrandLabel(metadataBrand);
  }

  const titleBrandMatch = product.title.match(/(?:часы|часов|watch|watches)\s+([A-Za-zА-Яа-я0-9-]+)/iu);
  const titleBrand = titleBrandMatch?.[1]?.trim();
  if (titleBrand) {
    return normalizeBrandLabel(titleBrand);
  }

  const handleBrandMatch = product.handle.match(/(?:kopiya-chasov-|watch-)([a-z0-9-]+)/i);
  const handleBrandRaw = handleBrandMatch?.[1]?.split("-")?.[0];
  if (handleBrandRaw) {
    return normalizeBrandLabel(toDisplayBrandFromHandle(handleBrandRaw));
  }

  const collectionBrand = product.collection?.title?.trim();
  if (collectionBrand) {
    return normalizeBrandLabel(collectionBrand);
  }

  const typeBrand = product.type?.value?.trim();
  if (typeBrand) {
    return normalizeBrandLabel(typeBrand);
  }

  return normalizeBrandLabel("Без бренда");
}
