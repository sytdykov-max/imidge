import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

type ProductRecord = {
  id: string;
  metadata?: Record<string, unknown> | null;
};

const REQUIRED_FACETS = [
  "filter_brand",
  "filter_category",
  "filter_price_range",
  "filter_availability",
] as const;

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function sortMapEntriesDesc(input: Map<string, number>, take: number) {
  return [...input.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([key, count]) => ({ key, count }));
}

export default async function reportFilterMetadata({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "metadata"],
  });

  const products = (data ?? []) as ProductRecord[];

  const missingCounts = new Map<string, number>(REQUIRED_FACETS.map((facet) => [facet, 0]));
  const missingAnyIds: string[] = [];
  const brandCount = new Map<string, number>();
  const categoryCount = new Map<string, number>();
  const priceRangeCount = new Map<string, number>();
  const availabilityCount = new Map<string, number>();

  for (const product of products) {
    const metadata = product.metadata ?? {};
    let missingAny = false;

    for (const facet of REQUIRED_FACETS) {
      const value = asNonEmptyString(metadata[facet]);
      if (!value) {
        missingCounts.set(facet, (missingCounts.get(facet) ?? 0) + 1);
        missingAny = true;
      }
    }

    if (missingAny) {
      missingAnyIds.push(product.id);
      continue;
    }

    const brand = asNonEmptyString(metadata.filter_brand);
    const category = asNonEmptyString(metadata.filter_category);
    const priceRange = asNonEmptyString(metadata.filter_price_range);
    const availability = asNonEmptyString(metadata.filter_availability);

    brandCount.set(brand, (brandCount.get(brand) ?? 0) + 1);
    categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1);
    priceRangeCount.set(priceRange, (priceRangeCount.get(priceRange) ?? 0) + 1);
    availabilityCount.set(availability, (availabilityCount.get(availability) ?? 0) + 1);
  }

  logger.info("Filter metadata migration report");
  logger.info(`Products scanned: ${products.length}`);
  logger.info(`Products with missing required facets: ${missingAnyIds.length}`);

  for (const facet of REQUIRED_FACETS) {
    logger.info(`Missing ${facet}: ${missingCounts.get(facet) ?? 0}`);
  }

  logger.info(`Top brands: ${JSON.stringify(sortMapEntriesDesc(brandCount, 15))}`);
  logger.info(`Top categories: ${JSON.stringify(sortMapEntriesDesc(categoryCount, 15))}`);
  logger.info(`Price ranges: ${JSON.stringify(sortMapEntriesDesc(priceRangeCount, 10))}`);
  logger.info(`Availability: ${JSON.stringify(sortMapEntriesDesc(availabilityCount, 10))}`);
}
