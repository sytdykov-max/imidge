"use client";

import { type ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addVariantToCart } from "@/lib/medusa-browser";
import { useCartStore } from "@/components/cart-store-provider";
import { useToast } from "@/components/toast-provider";

type ProductOptionDefinition = {
  id: string;
  title: string;
  values: string[];
};

type ProductVariantOption = {
  optionId?: string;
  value?: string;
};

type ProductVariantSelection = {
  id: string;
  isPurchasable: boolean;
  options: ProductVariantOption[];
};

type Props = {
  variantId?: string;
  disabledReason?: string;
  optionDefinitions?: ProductOptionDefinition[];
  variants?: ProductVariantSelection[];
  replacePrimaryButton?: ReactNode;
};

function normalizeOptionValue(value: string) {
  return value.trim().toLowerCase();
}

function getVariantOptionValue(variant: ProductVariantSelection, optionId: string) {
  const value = variant.options.find((option) => option.optionId === optionId)?.value;
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function AddToCartButton({
  variantId,
  disabledReason,
  optionDefinitions = [],
  variants = [],
  replacePrimaryButton,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const firstVariantWithOptions = variants.find((variant) => variant.id === variantId) ?? variants[0];
    const initialSelection: Record<string, string> = {};

    for (const definition of optionDefinitions) {
      const fromVariant = firstVariantWithOptions?.options.find(
        (option) => option.optionId === definition.id && typeof option.value === "string" && option.value.trim().length > 0
      )?.value;
      const fallback = definition.values[0];
      if (fromVariant || fallback) {
        initialSelection[definition.id] = fromVariant ?? fallback;
      }
    }

    return initialSelection;
  });
  const router = useRouter();
  const { optimisticAdjustItemCount, setCartSnapshot } = useCartStore();
  const { notify } = useToast();

  const hasOptionSelection = optionDefinitions.length > 0 && variants.length > 0;

  const selectedVariant = useMemo(() => {
    if (!hasOptionSelection) {
      return undefined;
    }

    return variants.find((variant) => {
      for (const definition of optionDefinitions) {
        const selectedValue = selectedOptions[definition.id];
        if (!selectedValue) {
          return false;
        }

        const variantOptionValue = getVariantOptionValue(variant, definition.id);
        if (!variantOptionValue) {
          return false;
        }

        if (normalizeOptionValue(variantOptionValue) !== normalizeOptionValue(selectedValue)) {
          return false;
        }
      }

      return true;
    });
  }, [hasOptionSelection, optionDefinitions, selectedOptions, variants]);

  const availabilityByOptionValue = useMemo(() => {
    const result: Record<string, Record<string, boolean>> = {};

    if (!hasOptionSelection) {
      return result;
    }

    for (const definition of optionDefinitions) {
      const valueAvailability: Record<string, boolean> = {};

      for (const value of definition.values) {
        const isAvailable = variants.some((variant) => {
          if (!variant.isPurchasable) {
            return false;
          }

          for (const currentDefinition of optionDefinitions) {
            const expectedValue =
              currentDefinition.id === definition.id
                ? value
                : selectedOptions[currentDefinition.id];

            if (!expectedValue) {
              continue;
            }

            const variantValue = getVariantOptionValue(variant, currentDefinition.id);
            if (!variantValue) {
              return false;
            }

            if (normalizeOptionValue(variantValue) !== normalizeOptionValue(expectedValue)) {
              return false;
            }
          }

          return true;
        });

        valueAvailability[value] = isAvailable;
      }

      result[definition.id] = valueAvailability;
    }

    return result;
  }, [hasOptionSelection, optionDefinitions, selectedOptions, variants]);

  const activeVariantId = hasOptionSelection ? selectedVariant?.id : variantId;

  const activeDisabledReason = hasOptionSelection
    ? !selectedVariant
      ? "Выберите доступную комбинацию параметров"
      : !selectedVariant.isPurchasable
        ? "Выбранная вариация сейчас недоступна"
        : undefined
    : !variantId
      ? disabledReason
      : undefined;

  const onSelectOption = (optionId: string, value: string) => {
    setSelectedOptions((current) => ({
      ...current,
      [optionId]: value,
    }));
  };

  const onAdd = async () => {
    if (!activeVariantId || loading) {
      return;
    }

    setLoading(true);
    const rollbackOptimisticCount = optimisticAdjustItemCount(1);

    try {
      const cart = await addVariantToCart(activeVariantId, 1);
      setCartSnapshot(cart);
      notify({
        type: "success",
        message: "Товар добавлен в корзину",
      });
      router.refresh();
    } catch (error) {
      rollbackOptimisticCount();
      const errorMessage =
        error instanceof Error && error.message ? error.message : "Не удалось добавить товар";

      notify({
        type: "error",
        message: `Не удалось добавить товар (${errorMessage})`,
        actionLabel: "Повторить",
        onAction: onAdd,
        durationMs: 6200,
      });

      if (error instanceof Error && error.message) {
        console.warn(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {hasOptionSelection && (
        <div className="product-variant-picker" aria-label="Выбор вариации товара">
          {optionDefinitions.map((definition) => (
            <div key={definition.id} className="product-variant-group">
              <p className="product-variant-label">
                {definition.title}: <span>{selectedOptions[definition.id] ?? "—"}</span>
              </p>
              <div className="product-variant-values">
                {definition.values.map((value) => {
                  const isActive = selectedOptions[definition.id] === value;
                  const isAvailable = availabilityByOptionValue[definition.id]?.[value] ?? true;

                  return (
                    <button
                      key={`${definition.id}-${value}`}
                      type="button"
                      className={`product-variant-value${isActive ? " active" : ""}${!isAvailable ? " disabled" : ""}`}
                      onClick={() => onSelectOption(definition.id, value)}
                      disabled={!isAvailable && !isActive}
                      aria-pressed={isActive}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="product-actions-block">
        {replacePrimaryButton ?? (
          <button className="cta-btn" type="button" onClick={onAdd} disabled={!activeVariantId || loading || Boolean(activeDisabledReason)}>
            {loading ? "Добавляем..." : "Добавить в корзину"}
          </button>
        )}
        <button className="secondary-btn" type="button" disabled>
          Купить в 1 клик
        </button>
      </div>

      {replacePrimaryButton ? (
        <button
          className="cta-btn product-add-fullwidth-btn"
          type="button"
          onClick={onAdd}
          disabled={!activeVariantId || loading || Boolean(activeDisabledReason)}
        >
          {loading ? "Добавляем..." : "Добавить в корзину"}
        </button>
      ) : null}

      {activeDisabledReason && <p className="action-message">{activeDisabledReason}</p>}
    </div>
  );
}
