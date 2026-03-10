import rawRules from "@/lib/catalog-category-rules.json";

type CategoryLabel = {
  label: string;
  source: "mapped" | "fallback";
};

type Rule = {
  label: string;
  keywords: string[];
};

const rules: Rule[] = (rawRules as Rule[])
  .filter((rule) => rule?.label && Array.isArray(rule.keywords))
  .map((rule) => ({
    label: rule.label,
    keywords: rule.keywords.map((keyword) => keyword.toLowerCase()),
  }));

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function readMetadataCategory(metadata?: Record<string, unknown> | null) {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  const candidates = ["filter_category", "legacy_category", "category"];
  for (const key of candidates) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export function mapCatalogCategory(input: {
  title?: string | null;
  handle?: string | null;
  type?: string | null;
  collection?: string | null;
  metadata?: Record<string, unknown> | null;
}): CategoryLabel {
  const metadataCategory = readMetadataCategory(input.metadata);
  if (metadataCategory) {
    return {
      label: metadataCategory,
      source: "mapped",
    };
  }

  const vector = [input.title, input.handle, input.type, input.collection]
    .map(normalize)
    .filter(Boolean)
    .join(" ");

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => vector.includes(keyword))) {
      return {
        label: rule.label,
        source: "mapped",
      };
    }
  }

  return {
    label: "Каталог",
    source: "fallback",
  };
}
