import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";

type ProductRecord = {
  id: string;
  handle?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
};

function normalizeBrandLabel(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "Без бренда";
  }

  if (/^[A-Za-z]{2,5}$/.test(compact)) {
    return compact.toUpperCase();
  }

  return compact.charAt(0).toUpperCase() + compact.slice(1).toLowerCase();
}

function inferBrand(title: string, handle: string) {
  const titleBrandMatch = title.match(/(?:часы|часов|watch|watches)\s+([A-Za-zА-Яа-я0-9-]+)/iu);
  const titleBrand = titleBrandMatch?.[1]?.trim();
  if (titleBrand) {
    return normalizeBrandLabel(titleBrand);
  }

  const handleBrandMatch = handle.match(/(?:kopiya-chasov-|watch-)([a-z0-9-]+)/i);
  const handleBrandRaw = handleBrandMatch?.[1]?.split("-")?.[0];
  if (handleBrandRaw) {
    return normalizeBrandLabel(handleBrandRaw);
  }

  if (/(shorts|sweat|t-shirt|tee|plate|dress)/i.test(`${title} ${handle}`)) {
    return "Без бренда";
  }

  return "Без бренда";
}

function inferCategory(title: string, handle: string) {
  const vector = `${title} ${handle}`.toLowerCase();

  if (/(часы|часов|watch|watches|chasov)/u.test(vector)) {
    return "Часы";
  }

  if (/(сумк|bag|bags|handbag|shopper|рюкзак|клатч|портмоне|кошел)/u.test(vector)) {
    return "Сумки";
  }

  if (/(футбол|t-shirt|tee|рубаш|сороч|поло|plate|dress|shorts|sweat)/u.test(vector)) {
    return "Одежда";
  }

  return "Каталог";
}

function pickString(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
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

export default async function backfillFilterMetadata({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "metadata"],
  });

  const products = (data ?? []) as ProductRecord[];

  const updates = products
    .map((product) => {
      const metadata = product.metadata ?? {};
      const title = String(product.title ?? "");
      const handle = String(product.handle ?? "");

      const currentBrand = pickString(metadata, ["filter_brand", "brand", "legacy_brand"]);
      const currentCategory = pickString(metadata, ["filter_category", "legacy_category", "category"]);
      const currentPriceRange = pickString(metadata, ["filter_price_range"]);
      const currentAvailability = pickString(metadata, ["filter_availability"]);

      const nextBrand = currentBrand || inferBrand(title, handle);
      const nextCategory = currentCategory || inferCategory(title, handle);
      const nextPriceRange = currentPriceRange || "unknown";
      const nextAvailability = currentAvailability || "out_of_stock";

      if (currentBrand && currentCategory && currentPriceRange && currentAvailability) {
        return null;
      }

      return {
        id: product.id,
        metadata: {
          ...metadata,
          filter_brand: nextBrand,
          filter_category: nextCategory,
          filter_price_range: nextPriceRange,
          filter_availability: nextAvailability,
        },
      };
    })
    .filter(Boolean) as Array<{ id: string; metadata: Record<string, unknown> }>;

  logger.info(`Products scanned: ${products.length}`);
  logger.info(`Products to backfill: ${updates.length}`);

  if (!updates.length) {
    logger.info("No products require metadata backfill.");
    return;
  }

  const chunkSize = 100;

  for (let index = 0; index < updates.length; index += chunkSize) {
    const chunk = updates.slice(index, index + chunkSize);
    await updateProductsWorkflow(container).run({
      input: {
        products: chunk,
      },
    });
  }

  logger.info(`Backfill complete. Updated products: ${updates.length}`);
}
