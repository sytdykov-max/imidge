import { promises as fs } from "fs";
import path from "path";

type ImportedProduct = {
  title?: string;
  handle?: string;
  metadata?: Record<string, unknown>;
  variants?: Array<{
    prices?: Array<{
      amount?: number;
      currency_code?: string;
    }>;
  }>;
};

type LegacyFilterRecord = {
  legacy_id: string;
  handle: string;
  brand: string;
  category: string;
  price_range: "lt_100" | "100_300" | "300_600" | "600_1000" | "gte_1000" | "unknown";
  availability: "in_stock" | "out_of_stock";
  attributes: Record<string, unknown>;
  currency: string;
  min_price: number | null;
};

function normalizeHandle(handle: string, index: number) {
  const normalized = String(handle ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || `legacy-fallback-${index + 1}`;
}

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

function extractBrandFromTitle(title: string) {
  const titleBrandMatch = title.match(/(?:часы|часов|watch|watches)\s+([A-Za-zА-Яа-я0-9-]+)/iu);
  const titleBrand = titleBrandMatch?.[1]?.trim();
  return titleBrand ? normalizeBrandLabel(titleBrand) : "";
}

function extractBrandFromHandle(handle: string) {
  const handleBrandMatch = handle.match(/(?:kopiya-chasov-|watch-)([a-z0-9-]+)/i);
  const handleBrandRaw = handleBrandMatch?.[1]?.split("-")?.[0];
  return handleBrandRaw ? normalizeBrandLabel(handleBrandRaw) : "";
}

function inferCategory({ title, handle }: { title: string; handle: string }) {
  const vector = `${title} ${handle}`.toLowerCase();

  if (/(часы|часов|watch|watches|chasov)/u.test(vector)) {
    return "Часы";
  }

  if (/(сумк|bag|bags|handbag|shopper|рюкзак|клатч|портмоне|кошел)/u.test(vector)) {
    return "Сумки";
  }

  if (/(футбол|t-shirt|tee|рубаш|сороч|поло)/u.test(vector)) {
    return "Одежда";
  }

  return "Каталог";
}

function getMinPrice(product: ImportedProduct) {
  const prices = (product.variants ?? [])
    .flatMap((variant) => variant.prices ?? [])
    .filter((price) => typeof price?.amount === "number" && Number.isFinite(price.amount) && price.amount > 0)
    .map((price) => ({
      amount: Number(price.amount),
      currency: String(price.currency_code ?? "").toLowerCase(),
    }));

  if (!prices.length) {
    return { minPrice: null, currency: "unknown" };
  }

  const best = prices.reduce((left, right) => (right.amount < left.amount ? right : left));
  return {
    minPrice: best.amount,
    currency: best.currency || "unknown",
  };
}

function toPriceRange(minPrice: number | null): LegacyFilterRecord["price_range"] {
  if (typeof minPrice !== "number" || !Number.isFinite(minPrice) || minPrice <= 0) {
    return "unknown";
  }

  if (minPrice < 100) return "lt_100";
  if (minPrice < 300) return "100_300";
  if (minPrice < 600) return "300_600";
  if (minPrice < 1000) return "600_1000";
  return "gte_1000";
}

async function run() {
  const scriptsDir = path.resolve(process.cwd(), "src/scripts");
  const productsPath = path.resolve(scriptsDir, "my-products.json");
  const outputPath = path.resolve(scriptsDir, "legacy-filters.json");

  const raw = await fs.readFile(productsPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("my-products.json must contain an array.");
  }

  const products = parsed as ImportedProduct[];

  const filters: LegacyFilterRecord[] = products.map((product, index) => {
    const title = String(product.title ?? "").trim();
    const handle = normalizeHandle(String(product.handle ?? ""), index);
    const metadata = product.metadata ?? {};

    const metadataBrand = typeof metadata.filter_brand === "string" ? metadata.filter_brand.trim() : "";
    const brand = metadataBrand || extractBrandFromTitle(title) || extractBrandFromHandle(handle) || "Без бренда";

    const metadataCategory = typeof metadata.filter_category === "string" ? metadata.filter_category.trim() : "";
    const category = metadataCategory || inferCategory({ title, handle });

    const { minPrice, currency } = getMinPrice(product);
    const legacyId = typeof metadata.legacy_id === "string" ? metadata.legacy_id : String(metadata.legacy_id ?? "");

    return {
      legacy_id: legacyId,
      handle,
      brand,
      category,
      price_range: toPriceRange(minPrice),
      availability: "in_stock",
      attributes: {},
      currency,
      min_price: minPrice,
    };
  });

  const payload = {
    generated_at: new Date().toISOString(),
    source: "my-products.json fallback extractor",
    schema_version: "1.0.0",
    filters,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Generated fallback filter records: ${filters.length}`);
  console.log(`Output: ${outputPath}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
