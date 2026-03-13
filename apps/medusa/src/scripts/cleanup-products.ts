import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows";

type ProductRecord = {
  id: string;
  handle?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
};

type CleanupMode = "test-only" | "all";

type ReservationItemRecord = {
  id: string;
  inventory_item_id?: string;
};

function hasApplyFlag(args: string[]) {
  const normalized = new Set(args.map((arg) => arg.trim().toLowerCase()));
  return normalized.has("apply");
}

function resolveMode(args: string[]): CleanupMode {
  const modeArg = args.find((arg) => arg.startsWith("mode="));
  const mode = modeArg?.slice(5).trim().toLowerCase();

  if (mode === "all") {
    return "all";
  }

  return "test-only";
}

function hasNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isLegacyProduct(product: ProductRecord) {
  const metadata = product.metadata ?? {};

  const legacyId = metadata.legacy_id;
  const legacySource = metadata.legacy_source;

  if (hasNonEmptyString(legacyId)) {
    return true;
  }

  if (hasNonEmptyString(legacySource) && String(legacySource).toLowerCase().includes("bitrix")) {
    return true;
  }

  return false;
}

function shouldDelete(product: ProductRecord, mode: CleanupMode) {
  if (mode === "all") {
    return true;
  }

  return !isLegacyProduct(product);
}

function extractErrorReason(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function extractInventoryItemIds(reason: string) {
  return [...new Set(reason.match(/iitem_[A-Za-z0-9]+/g) ?? [])];
}

export default async function cleanupProducts({ container, args = [] }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const inventoryModuleService = container.resolve(Modules.INVENTORY);

  const shouldApply = hasApplyFlag(args);
  const mode = resolveMode(args);

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "metadata"],
  });

  const products = (data ?? []) as ProductRecord[];
  const targets = products.filter((product) => shouldDelete(product, mode));
  const keep = products.length - targets.length;

  logger.info(`Cleanup mode: ${mode}`);
  logger.info(`Products scanned: ${products.length}`);
  logger.info(`Products selected for deletion: ${targets.length}`);
  logger.info(`Products kept: ${keep}`);

  if (targets.length) {
    const sample = targets
      .slice(0, 20)
      .map((p) => `${p.handle ?? "(no-handle)"} [${p.id}]`)
      .join(", ");
    logger.info(`Deletion sample (up to 20): ${sample}`);
  }

  if (!shouldApply) {
    logger.info("Dry-run mode. Pass 'apply' to delete selected products.");
    return;
  }

  if (!targets.length) {
    logger.info("Nothing to delete.");
    return;
  }

  const failed: Array<{ id: string; handle: string; reason: string }> = [];
  let deleted = 0;

  for (const product of targets) {
    try {
      await deleteProductsWorkflow(container).run({
        input: {
          ids: [product.id],
        },
      });
      deleted += 1;
    } catch (error) {
      const reason = extractErrorReason(error);
      const blockedInventoryItemIds = extractInventoryItemIds(reason);

      if (blockedInventoryItemIds.length) {
        try {
          const reservations = (await inventoryModuleService.listReservationItems({
            inventory_item_id: blockedInventoryItemIds,
          })) as ReservationItemRecord[];

          const reservationIds = reservations.map((item) => item.id).filter(Boolean);

          if (reservationIds.length) {
            await inventoryModuleService.deleteReservationItems(reservationIds);
            logger.info(
              `Removed reservations for ${product.handle ?? "(no-handle)"}: ${reservationIds.length}`
            );

            await deleteProductsWorkflow(container).run({
              input: {
                ids: [product.id],
              },
            });

            deleted += 1;
            continue;
          }
        } catch (reservationError) {
          const reservationReason = extractErrorReason(reservationError);
          failed.push({
            id: product.id,
            handle: product.handle ?? "(no-handle)",
            reason: `${reason} | reservation cleanup failed: ${reservationReason}`,
          });
          continue;
        }
      }

      failed.push({
        id: product.id,
        handle: product.handle ?? "(no-handle)",
        reason,
      });
    }
  }

  logger.info(`Cleanup complete. Deleted products: ${deleted}`);

  if (failed.length) {
    logger.warn(`Failed to delete products: ${failed.length}`);
    for (const item of failed) {
      logger.warn(`Delete failed: ${item.handle} [${item.id}] -> ${item.reason}`);
    }
  }
}
