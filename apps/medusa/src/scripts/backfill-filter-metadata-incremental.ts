import { promises as fs } from "fs";
import path from "path";
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";

type ProductRecord = {
  id: string;
  handle?: string | null;
  title?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type Checkpoint = {
  lastProcessedAt: string;
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

async function loadCheckpoint(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Checkpoint;
    return parsed;
  } catch {
    return {
      lastProcessedAt: new Date(0).toISOString(),
    };
  }
}

async function saveCheckpoint(filePath: string, checkpoint: Checkpoint) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}

function hasMissingRequiredFacets(metadata: Record<string, unknown> | null | undefined) {
  const required = ["filter_brand", "filter_category", "filter_price_range", "filter_availability"];
  return required.some((facet) => {
    const value = metadata?.[facet];
    return typeof value === "string" ? !value.trim() : value === null || value === undefined;
  });
}

export default async function backfillFilterMetadataIncremental({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const checkpointPath = path.resolve(process.cwd(), "../../logs/filter-backfill-checkpoint.json");
  const checkpoint = await loadCheckpoint(checkpointPath);
  const now = Date.now();
  const lookbackHours = Number(process.env.FILTER_BACKFILL_LOOKBACK_HOURS ?? 48);
  const lookbackMs = Number.isFinite(lookbackHours) && lookbackHours > 0 ? lookbackHours * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;

  const parsedCheckpointTs = Date.parse(checkpoint.lastProcessedAt);
  const checkpointTs = Number.isFinite(parsedCheckpointTs) && parsedCheckpointTs > Date.parse("1971-01-01T00:00:00.000Z")
    ? parsedCheckpointTs
    : now - lookbackMs;

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "updated_at", "metadata"],
  });

  const products = (data ?? []) as ProductRecord[];

  const nowIso = new Date(now).toISOString();

  const updates = products
    .filter((product) => {
      const updatedAt = Date.parse(String(product.updated_at ?? ""));
      const changedSinceCheckpoint = Number.isFinite(updatedAt) ? updatedAt > checkpointTs : false;
      const missingRequired = hasMissingRequiredFacets(product.metadata);
      return changedSinceCheckpoint || missingRequired;
    })
    .map((product) => {
      const metadata = product.metadata ?? {};
      const title = String(product.title ?? "");
      const handle = String(product.handle ?? "");

      const currentBrand = pickString(metadata, ["filter_brand", "brand", "legacy_brand"]);
      const currentCategory = pickString(metadata, ["filter_category", "legacy_category", "category"]);
      const currentPriceRange = pickString(metadata, ["filter_price_range"]);
      const currentAvailability = pickString(metadata, ["filter_availability"]);

      return {
        id: product.id,
        metadata: {
          ...metadata,
          filter_brand: currentBrand || inferBrand(title, handle),
          filter_category: currentCategory || inferCategory(title, handle),
          filter_price_range: currentPriceRange || "unknown",
          filter_availability: currentAvailability || "out_of_stock",
        },
      };
    });

  logger.info(`Checkpoint lastProcessedAt: ${checkpoint.lastProcessedAt}`);
  logger.info(`Lookback hours: ${lookbackHours}`);
  logger.info(`Products scanned: ${products.length}`);
  logger.info(`Products to backfill (incremental): ${updates.length}`);

  if (updates.length) {
    const chunkSize = 100;

    for (let index = 0; index < updates.length; index += chunkSize) {
      const chunk = updates.slice(index, index + chunkSize);
      await updateProductsWorkflow(container).run({
        input: {
          products: chunk,
        },
      });
    }
  }

  await saveCheckpoint(checkpointPath, {
    lastProcessedAt: nowIso,
  });

  logger.info(`Incremental backfill complete. Updated products: ${updates.length}`);
  logger.info(`Checkpoint updated: ${nowIso}`);
}
