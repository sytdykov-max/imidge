import { promises as fs } from "fs";
import path from "path";
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils";
import { createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows";

type ImportedPrice = {
  currency_code: string;
  amount: number;
};

type ImportedVariant = {
  title: string;
  prices: ImportedPrice[];
};

type ImportedProduct = {
  title: string;
  handle: string;
  description?: string;
  thumbnail?: string;
  images?: Array<{ url: string }>;
  metadata?: Record<string, unknown>;
  variants: ImportedVariant[];
};

type LegacyFilterRecord = {
  handle: string;
  brand?: string;
  category?: string;
  price_range?: string;
  availability?: string;
  legacy_id?: string;
};

type LegacyFiltersPayload = {
  filters?: LegacyFilterRecord[];
};

type FacetNormalizationDictionary = {
  brandAliases?: Record<string, string>;
  categoryAliases?: Record<string, string>;
  priceRangeAliases?: Record<string, string>;
  availabilityAliases?: Record<string, string>;
};

type ProductRecord = {
  id: string;
  handle?: string | null;
};

type ShippingProfileRecord = {
  id: string;
};

function resolveJsonPath(args: string[]) {
  const pathArg = args.find((item) => item.startsWith("path="));
  if (!pathArg) {
    return "./src/scripts/import-products-template.json";
  }

  return pathArg.slice(5);
}

function hasApplyFlag(args: string[]) {
  const normalized = new Set(args.map((arg) => arg.trim().toLowerCase()));
  return normalized.has("apply");
}

function normalizeHandle(handle: string) {
  return handle.trim().toLowerCase();
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

function inferAvailability(variants: ImportedVariant[]) {
  const hasAnyPrice = variants.some((variant) =>
    (variant.prices ?? []).some((price) => typeof price.amount === "number" && price.amount > 0)
  );

  return hasAnyPrice ? "in_stock" : "out_of_stock";
}

async function loadLegacyFiltersByHandle(baseDir: string) {
  const legacyFiltersPath = path.resolve(baseDir, "./src/scripts/legacy-filters.json");

  try {
    const raw = await fs.readFile(legacyFiltersPath, "utf8");
    const parsed = JSON.parse(raw) as LegacyFiltersPayload;
    const index = new Map<string, LegacyFilterRecord>();

    for (const record of parsed.filters ?? []) {
      if (!record?.handle) {
        continue;
      }
      index.set(normalizeHandle(record.handle), record);
    }

    return {
      index,
      path: legacyFiltersPath,
    };
  } catch {
    return {
      index: new Map<string, LegacyFilterRecord>(),
      path: legacyFiltersPath,
    };
  }
}

async function loadFacetDictionary(baseDir: string) {
  const dictPath = path.resolve(baseDir, "../../config/facet-normalization-dictionary.json");

  try {
    const raw = await fs.readFile(dictPath, "utf8");
    const parsed = JSON.parse(raw) as FacetNormalizationDictionary;
    return {
      path: dictPath,
      dictionary: parsed,
    };
  } catch {
    return {
      path: dictPath,
      dictionary: {},
    };
  }
}

function normalizeByAlias(value: string, aliases: Record<string, string> | undefined) {
  const normalized = value.trim();
  if (!normalized) {
    return normalized;
  }

  const lower = normalized.toLowerCase();
  if (!aliases) {
    return normalized;
  }

  return aliases[lower] ?? normalized;
}

function enrichMetadataWithFilters(
  metadata: Record<string, unknown> | undefined,
  filterRecord: LegacyFilterRecord | undefined,
  product: ImportedProduct,
  dictionary: FacetNormalizationDictionary
) {
  const currentMetadata = metadata ?? {};

  const fallbackBrand = inferBrand(product.title, product.handle);
  const fallbackCategory = inferCategory(product.title, product.handle);
  const fallbackAvailability = inferAvailability(product.variants);
  const fallbackLegacyId = typeof currentMetadata.legacy_id === "string"
    ? currentMetadata.legacy_id
    : String(currentMetadata.legacy_id ?? "");

  const rawBrand =
    filterRecord?.brand ??
    (currentMetadata.filter_brand as string | undefined) ??
    fallbackBrand;
  const rawCategory =
    filterRecord?.category ??
    (currentMetadata.filter_category as string | undefined) ??
    fallbackCategory;
  const rawPriceRange =
    filterRecord?.price_range ??
    (currentMetadata.filter_price_range as string | undefined) ??
    "unknown";
  const rawAvailability =
    filterRecord?.availability ??
    (currentMetadata.filter_availability as string | undefined) ??
    fallbackAvailability;

  return {
    ...currentMetadata,
    filter_brand: normalizeByAlias(rawBrand, dictionary.brandAliases),
    filter_category: normalizeByAlias(rawCategory, dictionary.categoryAliases),
    filter_price_range: normalizeByAlias(rawPriceRange, dictionary.priceRangeAliases),
    filter_availability: normalizeByAlias(rawAvailability, dictionary.availabilityAliases),
    legacy_id:
      filterRecord?.legacy_id ??
      fallbackLegacyId,
  };
}

function isValidProduct(input: unknown): input is ImportedProduct {
  if (!input || typeof input !== "object") {
    return false;
  }

  const product = input as Partial<ImportedProduct>;

  if (!product.title || !product.handle || !Array.isArray(product.variants)) {
    return false;
  }

  return product.variants.every((variant) => {
    if (!variant || typeof variant !== "object") {
      return false;
    }

    const entity = variant as Partial<ImportedVariant>;
    if (!entity.title || !Array.isArray(entity.prices) || !entity.prices.length) {
      return false;
    }

    return entity.prices.every((price) => {
      if (!price || typeof price !== "object") {
        return false;
      }

      const value = price as Partial<ImportedPrice>;
      return Boolean(value.currency_code) && typeof value.amount === "number";
    });
  });
}

export default async function importProductsFromJson({ container, args = [] }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

  const relativePath = resolveJsonPath(args);
  const shouldApply = hasApplyFlag(args);
  const fullPath = path.isAbsolute(relativePath)
    ? relativePath
    : path.resolve(process.cwd(), relativePath);

  const fileContent = await fs.readFile(fullPath, "utf8");
  const parsed = JSON.parse(fileContent) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Import file must contain an array of products.");
  }

  const validProducts = parsed.filter(isValidProduct);
  const invalidCount = parsed.length - validProducts.length;

  const uniqueProducts = new Map<string, ImportedProduct>();
  let duplicateHandles = 0;

  for (const product of validProducts) {
    const normalizedHandle = normalizeHandle(product.handle);

    if (uniqueProducts.has(normalizedHandle)) {
      duplicateHandles += 1;
      continue;
    }

    uniqueProducts.set(normalizedHandle, product);
  }

  const productsForImport = [...uniqueProducts.values()];
  const { index: legacyFiltersByHandle, path: legacyFiltersPath } = await loadLegacyFiltersByHandle(process.cwd());
  const { dictionary: facetDictionary, path: facetDictionaryPath } = await loadFacetDictionary(process.cwd());

  const enrichedProductsForImport = productsForImport.map((product) => {
    const filterRecord = legacyFiltersByHandle.get(normalizeHandle(product.handle));
    return {
      ...product,
      metadata: enrichMetadataWithFilters(product.metadata, filterRecord, product, facetDictionary),
    };
  });

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  });

  const existing = (data ?? []) as ProductRecord[];
  const existingByHandle = new Map(
    existing
      .filter((product) => product.handle)
      .map((product) => [normalizeHandle(product.handle!), product.id])
  );

  let toCreate = 0;
  let toUpdate = 0;

  for (const product of enrichedProductsForImport) {
    if (existingByHandle.has(normalizeHandle(product.handle))) {
      toUpdate += 1;
    } else {
      toCreate += 1;
    }
  }

  logger.info(`Import file: ${fullPath}`);
  logger.info(`Products in file: ${parsed.length}`);
  logger.info(`Valid products: ${validProducts.length}`);
  logger.info(`Invalid products: ${invalidCount}`);
  logger.info(`Duplicate handles skipped: ${duplicateHandles}`);
  logger.info(`Products after dedupe: ${productsForImport.length}`);
  logger.info(`Legacy filters index: ${legacyFiltersByHandle.size ? `loaded (${legacyFiltersByHandle.size})` : "not loaded"}`);
  logger.info(`Legacy filters path: ${legacyFiltersPath}`);
  logger.info(`Facet normalization dictionary path: ${facetDictionaryPath}`);
  logger.info(`Will create: ${toCreate}`);
  logger.info(`Will update: ${toUpdate}`);
  logger.info("Update strategy: only top-level product fields (title/description/metadata), variants of existing products are not modified.");

  if (!shouldApply) {
    logger.info("Dry-run mode. Pass 'apply' to proceed with write mode.");
    return;
  }

  const shippingProfiles = (await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })) as ShippingProfileRecord[];

  const defaultShippingProfile = shippingProfiles[0];

  if (!defaultShippingProfile) {
    throw new Error("Default shipping profile not found. Run base seed first.");
  }

  const productsToCreate = enrichedProductsForImport
    .filter((product) => !existingByHandle.has(normalizeHandle(product.handle)))
    .map((product) => {
      const sizeValues = [...new Set(product.variants.map((variant) => variant.title))];

      return {
        title: product.title,
        handle: product.handle,
        description: product.description,
            thumbnail: product.thumbnail ?? product.images?.[0]?.url,
        images: product.images,
        metadata: product.metadata,
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: defaultShippingProfile.id,
        options: [
          {
            title: "Size",
            values: sizeValues,
          },
        ],
        variants: product.variants.map((variant) => ({
          title: variant.title,
          manage_inventory: false,
          options: {
            Size: variant.title,
          },
          prices: variant.prices.map((price) => ({
            currency_code: price.currency_code.toLowerCase(),
            amount: price.amount,
          })),
        })),
      };
    });

  const productsToUpdate = enrichedProductsForImport
    .filter((product) => existingByHandle.has(normalizeHandle(product.handle)))
    .map((product) => ({
      id: existingByHandle.get(normalizeHandle(product.handle))!,
      title: product.title,
      description: product.description,
      thumbnail: product.thumbnail ?? product.images?.[0]?.url,
      images: product.images,
      metadata: product.metadata,
    }));

  const chunkSize = 50;

  for (let index = 0; index < productsToCreate.length; index += chunkSize) {
    const chunk = productsToCreate.slice(index, index + chunkSize);
    await createProductsWorkflow(container).run({
      input: {
        products: chunk,
      },
    });
  }

  for (let index = 0; index < productsToUpdate.length; index += chunkSize) {
    const chunk = productsToUpdate.slice(index, index + chunkSize);
    await updateProductsWorkflow(container).run({
      input: {
        products: chunk,
      },
    });
  }

  logger.info(`Apply complete. Created: ${productsToCreate.length}, Updated: ${productsToUpdate.length}`);
}
