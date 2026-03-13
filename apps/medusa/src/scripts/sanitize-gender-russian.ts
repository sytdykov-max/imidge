import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";

type ProductRecord = {
  id: string;
  title?: string | null;
  handle?: string | null;
  metadata?: Record<string, unknown> | null;
};

function hasApplyFlag(args: string[]) {
  const normalized = new Set(args.map((arg) => arg.trim().toLowerCase()));
  return normalized.has("apply");
}

function inferGenderRu(title: string, handle: string) {
  const vector = `${title} ${handle}`.toLowerCase();
  if (/(unisex|унисекс)/u.test(vector)) return "Унисекс";
  if (/(мужск|male|men|man)/u.test(vector)) return "Мужской";
  if (/(женск|female|women|woman)/u.test(vector)) return "Женский";
  return "";
}

function normalizeGenderValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (/(унисекс|unisex|мужские\s*\/\s*женские|женские\s*\/\s*мужские|мужские\s*\/\s*женские\s*\/\s*унисекс|женские\s*\/\s*мужские\s*\/\s*унисекс|мужские\s*\/\s*унисекс|женские\s*\/\s*унисекс)/u.test(normalized)) {
    return "Унисекс";
  }

  if (/(unknown|неизвест|не\s*указан|не\s*указано|n\/a|none|null)/u.test(normalized)) {
    return "Унисекс";
  }

  if (/(мужск|male|men|man)/u.test(normalized)) {
    return "Мужской";
  }

  if (/(женск|female|women|woman)/u.test(normalized)) {
    return "Женский";
  }

  return "";
}

export default async function sanitizeGenderRussian({ container, args = [] }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const shouldApply = hasApplyFlag(args);

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "metadata"],
  });

  const products = (data ?? []) as ProductRecord[];
  const updates: Array<{ id: string; metadata: Record<string, unknown> }> = [];
  const nextGenderStats = new Map<string, number>();

  for (const product of products) {
    const metadata = (product.metadata ?? {}) as Record<string, unknown>;
    const rawGender =
      (typeof metadata.filter_gender === "string" ? metadata.filter_gender : "") ||
      (typeof metadata.filter_sex === "string" ? metadata.filter_sex : "") ||
      inferGenderRu(product.title ?? "", product.handle ?? "");

    const normalizedGender = normalizeGenderValue(rawGender);
    const currentGender = typeof metadata.filter_gender === "string" ? metadata.filter_gender : "";
    const shouldUpdateGender =
      (normalizedGender && currentGender !== normalizedGender) ||
      (!normalizedGender && Boolean(currentGender));

    if (!shouldUpdateGender) {
      continue;
    }

    const nextMetadata = { ...metadata };
    delete nextMetadata.filter_sex;

    if (normalizedGender) {
      nextMetadata.filter_gender = normalizedGender;
      nextGenderStats.set(normalizedGender, (nextGenderStats.get(normalizedGender) ?? 0) + 1);
    } else {
      delete nextMetadata.filter_gender;
      nextGenderStats.set("<deleted>", (nextGenderStats.get("<deleted>") ?? 0) + 1);
    }

    updates.push({
      id: product.id,
      metadata: nextMetadata,
    });
  }

  logger.info(`Products scanned: ${products.length}`);
  logger.info(`Products to normalize gender: ${updates.length}`);
  logger.info(`Normalized gender stats: ${JSON.stringify([...nextGenderStats.entries()].map(([key, count]) => ({ key, count })))}`);

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
