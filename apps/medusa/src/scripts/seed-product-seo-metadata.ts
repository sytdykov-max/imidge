import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";

type ProductRecord = {
  id: string;
  title?: string | null;
  handle?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ProductMetadata = {
  rating_value: number;
  rating_count: number;
  review_count: number;
  review_author: string;
  review_body: string;
  review_rating: number;
};

const KEY_ORDER: Array<keyof ProductMetadata> = [
  "rating_value",
  "rating_count",
  "review_count",
  "review_author",
  "review_body",
  "review_rating",
];

function generateMetadata(product: ProductRecord, index: number): ProductMetadata {
  const names = ["Ольга", "Анна", "Мария", "Екатерина", "Ирина", "Наталья"];
  const ratingValue = Number((4.9 - (index % 4) * 0.1).toFixed(1));
  const ratingCount = 16 + index * 3;
  const reviewCount = Math.max(1, ratingCount - 5);
  const reviewRating = Math.min(5, Math.max(4, Math.round(ratingValue)));
  const author = names[index % names.length];
  const title = product.title?.trim() || product.handle?.trim() || "товар";

  return {
    rating_value: ratingValue,
    rating_count: ratingCount,
    review_count: reviewCount,
    review_author: author,
    review_body: `${title}: качественный материал, комфортная посадка и аккуратный пошив.`,
    review_rating: reviewRating,
  };
}

function isMissing(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function parseFlags(args: string[]) {
  const normalized = new Set(args.map((arg) => arg.trim().toLowerCase()));
  return {
    dryRun: normalized.has("--dry-run") || normalized.has("dry-run"),
    force: normalized.has("--force") || normalized.has("force"),
  };
}

export default async function seedProductSeoMetadata({ container, args = [] }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { dryRun, force } = parseFlags(args);

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "metadata"],
  });

  const products = (data ?? []) as ProductRecord[];

  if (!products.length) {
    logger.info("No products found. Nothing to update.");
    return;
  }

  const updates: Array<{ id: string; metadata: Record<string, unknown> }> = [];

  products.forEach((product, index) => {
    const generated = generateMetadata(product, index);
    const current = (product.metadata ?? {}) as Record<string, unknown>;
    const next = { ...current };
    let changed = false;

    for (const key of KEY_ORDER) {
      if (force || isMissing(next[key])) {
        if (next[key] !== generated[key]) {
          next[key] = generated[key];
          changed = true;
        }
      }
    }

    if (changed) {
      updates.push({
        id: product.id,
        metadata: next,
      });
    }
  });

  logger.info(`Products found: ${products.length}`);
  logger.info(`Products to update: ${updates.length}`);
  logger.info(`Mode: ${dryRun ? "dry-run" : "write"}${force ? " + force" : ""}`);

  if (dryRun || !updates.length) {
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

  logger.info("SEO metadata seeding completed.");
}
