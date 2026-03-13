import { promises as fs } from "fs";
import path from "path";
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";

type LegacyFilterRecord = {
  handle?: string;
  category?: string;
};

type LegacyFiltersPayload = {
  filters?: LegacyFilterRecord[];
};

type ProductRecord = {
  id: string;
  handle?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
};

function hasApplyFlag(args: string[]) {
  const normalized = new Set(args.map((arg) => arg.trim().toLowerCase()));
  return normalized.has("apply");
}

function normalizeHandle(handle: string) {
  return handle.trim().toLowerCase();
}

function inferCategory(title: string, handle: string) {
  const vector = `${title} ${handle}`.toLowerCase();

  if (/(часы|часов|watch|watches|chasov)/u.test(vector)) return "Часы";
  if (/(барсет|barset)/u.test(vector)) return "Барсетки";
  if (/(клатч|klatch|clutch)/u.test(vector)) return "Клатчи";
  if (/(рюкзак|ryukzak|backpack)/u.test(vector)) return "Рюкзаки";
  if (/(портмон|portmone)/u.test(vector)) return "Портмоне";
  if (/(визитниц|vizitnits|vizitnitsa|cardholder|business\s*card)/u.test(vector)) return "Визитницы";
  if (/(кошел|koshel|wallet)/u.test(vector)) return "Кошельки";
  if (/(сумк|bag|bags|handbag|chemodan|чемодан)/u.test(vector)) return "Сумки";
  if (/(футбол|рубаш|поло|dress|shirt|shorts|шорт|plate|плать|hoodie|sweat|одеж|kurtka|dzhins|bryuki|sviter|tolstovk|galstuk|sharf|platok|kepk|shapka|kostyum|vetrovk|zhilet|maika|postelnog|belya|белье|постельн)/u.test(vector)) return "Одежда";
  if (/(кроссовк|кед|туфл|ботин|сапог|shoes|sneaker|krossov|kedy|tufli|sandali|slantsy)/u.test(vector)) return "Обувь";
  if (/(ремен|зажигал|ручк|зонт|запонк|аксессуар|accessor|bloknot|brelok|klyuchnitsa|zazhim|manikyurn|gilotina|pepelnitsa|humidor|khyumidor|korobka|chekhol|oblozhka|sertifikat|bijuteri|paket|sterzhen)/u.test(vector)) return "Аксессуары";
  if (/(vertu|nokia|mobiado|iphone|ipod|телефон|smartphone)/u.test(vector)) return "Электроника";

  return "";
}

async function loadLegacyData(baseDir: string) {
  const legacyFiltersPath = path.resolve(baseDir, "./src/scripts/legacy-filters.json");
  const raw = await fs.readFile(legacyFiltersPath, "utf8");
  const parsed = JSON.parse(raw) as LegacyFiltersPayload;

  const byHandle = new Map<string, string>();
  const categories = new Set<string>();

  for (const record of parsed.filters ?? []) {
    const handle = typeof record.handle === "string" ? normalizeHandle(record.handle) : "";
    const category = typeof record.category === "string" ? record.category.trim() : "";

    if (handle && category) {
      byHandle.set(handle, category);
      categories.add(category);
    }
  }

  return { byHandle, categories, legacyFiltersPath };
}

export default async function sanitizeNonLegacyCategories({ container, args = [] }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const shouldApply = hasApplyFlag(args);

  const { byHandle, categories, legacyFiltersPath } = await loadLegacyData(process.cwd());
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "metadata"],
  });

  const products = (data ?? []) as ProductRecord[];
  const updates: Array<{ id: string; metadata: Record<string, unknown> }> = [];
  const replacementStats = new Map<string, number>();

  for (const product of products) {
    const currentMetadata = (product.metadata ?? {}) as Record<string, unknown>;
    const currentCategoryRaw = typeof currentMetadata.filter_category === "string"
      ? currentMetadata.filter_category
      : "";
    const currentCategory = currentCategoryRaw.trim();

    if (!currentCategory || categories.has(currentCategory)) {
      continue;
    }

    const normalizedHandle = product.handle ? normalizeHandle(product.handle) : "";
    const categoryFromLegacy = normalizedHandle ? byHandle.get(normalizedHandle) ?? "" : "";
    const categoryFromInference = inferCategory(product.title ?? "", product.handle ?? "");
    const nextCategory = [categoryFromLegacy, categoryFromInference].find((value) => value && categories.has(value)) ?? "";

    if (!nextCategory) {
      continue;
    }

    const metadata = {
      ...currentMetadata,
      filter_category: nextCategory,
    };

    updates.push({
      id: product.id,
      metadata,
    });

    const statKey = `${currentCategory} -> ${nextCategory}`;
    replacementStats.set(statKey, (replacementStats.get(statKey) ?? 0) + 1);
  }

  logger.info(`Legacy filters path: ${legacyFiltersPath}`);
  logger.info(`Legacy category whitelist size: ${categories.size}`);
  logger.info(`Products scanned: ${products.length}`);
  logger.info(`Products to sanitize: ${updates.length}`);
  logger.info(`Replacements: ${JSON.stringify([...replacementStats.entries()].map(([key, count]) => ({ key, count })))}`);

  if (!shouldApply) {
    logger.info("Dry-run mode. Pass 'apply' to proceed with write mode.");
    return;
  }

  const chunkSize = 50;
  for (let index = 0; index < updates.length; index += chunkSize) {
    const chunk = updates.slice(index, index + chunkSize);
    await updateProductsWorkflow(container).run({
      input: {
        products: chunk,
      },
    });
  }

  logger.info(`Apply complete. Updated: ${updates.length}`);
}
