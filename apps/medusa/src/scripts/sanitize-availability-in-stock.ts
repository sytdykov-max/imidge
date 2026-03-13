import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";

type ProductRecord = {
  id: string;
  metadata?: Record<string, unknown> | null;
};

function hasApplyFlag(args: string[]) {
  const normalized = new Set(args.map((arg) => arg.trim().toLowerCase()));
  return normalized.has("apply");
}

export default async function sanitizeAvailabilityInStock({ container, args = [] }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const shouldApply = hasApplyFlag(args);

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "metadata"],
  });

  const products = (data ?? []) as ProductRecord[];
  const updates: Array<{ id: string; metadata: Record<string, unknown> }> = [];

  for (const product of products) {
    const metadata = (product.metadata ?? {}) as Record<string, unknown>;
    const current = typeof metadata.filter_availability === "string"
      ? metadata.filter_availability
      : "";

    if (current === "in_stock") {
      continue;
    }

    updates.push({
      id: product.id,
      metadata: {
        ...metadata,
        filter_availability: "in_stock",
      },
    });
  }

  logger.info(`Products scanned: ${products.length}`);
  logger.info(`Products to normalize availability: ${updates.length}`);

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
