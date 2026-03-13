import { promises as fs } from "fs";
import path from "path";

type ImportedProduct = {
  title?: string;
  handle?: string;
  description?: string;
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

type DirtyReport = {
  generated_at: string;
  total_rows: number;
  unknown_brand_count: number;
  generic_category_count: number;
  unknown_price_count: number;
  samples: {
    unknown_brand_handles: string[];
    generic_category_handles: string[];
    unknown_price_handles: string[];
  };
};

type HandleOverride = {
  brand?: string;
  category?: string;
};

const HANDLE_OVERRIDES: Record<string, HandleOverride> = {
  constellationmonogramm: {
    brand: "Vertu",
    category: "Электроника",
  },
  ascentxblack: {
    brand: "Vertu",
    category: "Электроника",
  },
};

const BRAND_AS_PREFIX = new Set(["vertu", "nokia", "mobiado", "iphone", "ipod"]);

const CATEGORY_PREFIX_MAP: Array<{ prefixes: string[]; category: string }> = [
  { prefixes: ["kopiya-chasov", "chasy", "muzhskie-chasy", "zhenskie-chasy"], category: "Часы" },
  { prefixes: ["sumka", "sumki", "koshelek", "barsetka", "ryukzak", "klatch", "vizitnitsa", "portmone", "klyuchnitsa"], category: "Сумки" },
  { prefixes: ["krossovki", "kedy", "tufli", "botinki", "sapogi", "lofery", "mokasiny", "obuv"], category: "Обувь" },
  { prefixes: ["futbolka", "futbolki", "futbolok", "sweatshirt", "hoodie", "shorts", "rubashka", "rubashki", "plate", "dress", "bryuki", "pants", "trousers", "shorts"], category: "Одежда" },
  {
    prefixes: [
      "remen",
      "ruchka",
      "zazhigalka",
      "zaponki",
      "brelok",
      "sharf",
      "zont",
      "zazhim",
      "korobka-dlya-chasov",
      "korobka-dlya-ruchki",
      "nastolnyy-nabor",
      "brendovyy-paket",
      "brendovoy-paket",
      "brendovyy",
      "podstavka-dlya-ruchek",
      "kremniy",
      "nasadka",
      "gazovyy-balon",
      "sharikovyy-sterzhen",
      "podstavka-dlya-chasov",
      "kozhanyy-chekhol-dlya-zazhigalki",
      "dokumenty-dlya-chasov",
      "korobki-dlya-chasov",
      "manikyurnyy-nabor",
      "bloknot",
      "chekhol-dlya-ipad",
      "zonty",
      "zastezhka",
      "nakladka-na-rant",
      "mekhanizm",
      "kreplenie-dlya-remnya",
      "zavodnaya-koronka",
      "nakladka-na-zastezhku",
      "steklo",
      "zveno-dlya-brasleta",
      "nakladka-na-koronku",
      "knopka",
      "zastezhki-v-assortimente",
      "braslet",
      "platok",
    ],
    category: "Аксессуары",
  },
  { prefixes: ["nastennye-chasy"], category: "Часы" },
  { prefixes: ["vertu", "nokia", "mobiado", "iphone", "ipod", "telefon", "smartfon"], category: "Электроника" },
];

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

function isUsefulBrand(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized !== "без бренда";
}

function isUsefulCategory(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized !== "каталог";
}

function toTitleLabelFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 2) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ")
    .trim();
}

function inferBrandFromHandlePattern(handle: string) {
  const beforeModel = handle.split("-model-")[0]?.trim();
  if (!beforeModel) {
    return "";
  }

  const categoryPrefix = CATEGORY_PREFIX_MAP
    .flatMap((entry) => entry.prefixes)
    .find((prefix) => beforeModel.startsWith(`${prefix}-`) || beforeModel === prefix);

  if (!categoryPrefix) {
    return "";
  }

  const brandSlug = beforeModel.slice(categoryPrefix.length).replace(/^-+/, "").trim();
  if (!brandSlug) {
    if (BRAND_AS_PREFIX.has(categoryPrefix)) {
      return normalizeBrandLabel(toTitleLabelFromSlug(categoryPrefix));
    }
    return "";
  }

  return normalizeBrandLabel(toTitleLabelFromSlug(brandSlug));
}

function getHandleOverride(handle: string) {
  return HANDLE_OVERRIDES[handle] ?? null;
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

  for (const mapping of CATEGORY_PREFIX_MAP) {
    if (mapping.prefixes.some((prefix) => handle.startsWith(`${prefix}-`) || handle === prefix)) {
      return mapping.category;
    }
  }

  if (/(часы|часов|watch|watches|chasov)/u.test(vector)) {
    return "Часы";
  }

  if (/(сумк|bag|bags|handbag|shopper|рюкзак|клатч|портмоне|кошел|sumk|ryukzak|barsetka|vizitnitsa)/u.test(vector)) {
    return "Сумки";
  }

  if (/(кроссовк|кед|туфл|ботин|сапог|loafers|sneaker|krossovki|kedy|tufli)/u.test(vector)) {
    return "Обувь";
  }

  if (/(футбол|t-shirt|tee|рубаш|сороч|поло|futbol|sweat|hoodie|plate|dress|bryuki|pants|trousers|shorts)/u.test(vector)) {
    return "Одежда";
  }

  if (/(ремен|зажигал|запонк|брел|зонт|шарф|ручк|remen|zazhigalka|zaponki|brelok|zont|sharf|ruchka|zazhim)/u.test(vector)) {
    return "Аксессуары";
  }

  return "Каталог";
}

function inferExtraAttributes({
  title,
  handle,
  description,
  category,
}: {
  title: string;
  handle: string;
  description: string;
  category: string;
}) {
  const vector = `${title} ${handle} ${description}`.toLowerCase();
  const attributes: Record<string, unknown> = {};
  const likelyWatchCategory = category === "Часы" || /(часы|watch|watches|chasov)/u.test(vector);

  if (/(муж|muzh|men|mens|male)/u.test(vector)) {
    attributes.filter_gender = "Мужские";
  } else if (/(жен|zhensk|women|female|ladies)/u.test(vector)) {
    attributes.filter_gender = "Женские";
  } else if (/(унисекс|unisex)/u.test(vector)) {
    attributes.filter_gender = "Унисекс";
  }

  if (/(классик|classic)/u.test(vector)) {
    attributes.filter_style = "Классический";
  } else if (/(sport|спортив)/u.test(vector)) {
    attributes.filter_style = "Спортивный";
  } else if (/(casual|повседнев)/u.test(vector)) {
    attributes.filter_style = "Повседневный";
  } else if (/(fashion|модн|дизайнер)/u.test(vector)) {
    attributes.filter_style = "Fashion";
  }

  if (likelyWatchCategory) {
    if (/(automatic|автомат|mechanical|механик)/u.test(vector)) {
      attributes.filter_mechanism = "Механический";
    } else if (/(quartz|кварц)/u.test(vector)) {
      attributes.filter_mechanism = "Кварцевый";
    } else if (/(electronic|электрон)/u.test(vector)) {
      attributes.filter_mechanism = "Электронный";
    }

    if (/(swiss|швейцар|switzerland)/u.test(vector)) {
      attributes.filter_mechanism_origin = "Швейцария";
      attributes.filter_assembly_country = "Швейцария";
    } else if (/(japan|япон|japanese)/u.test(vector)) {
      attributes.filter_mechanism_origin = "Япония";
      attributes.filter_assembly_country = "Япония";
    } else if (/(china|китай|chinese)/u.test(vector)) {
      attributes.filter_mechanism_origin = "Китай";
      attributes.filter_assembly_country = "Китай";
    } else if (/(germany|герман)/u.test(vector)) {
      attributes.filter_assembly_country = "Германия";
    }

    if (/(steel|сталь)/u.test(vector)) {
      attributes.filter_case_material = "Сталь";
    } else if (/(gold|золот)/u.test(vector)) {
      attributes.filter_case_material = "Золото";
    } else if (/(ceramic|керамик)/u.test(vector)) {
      attributes.filter_case_material = "Керамика";
    } else if (/(titan|титан)/u.test(vector)) {
      attributes.filter_case_material = "Титан";
    } else if (/(carbon|карбон)/u.test(vector)) {
      attributes.filter_case_material = "Карбон";
    }

    const mmMatch = vector.match(/\b(\d{2})(?:[.,]\d)?\s?(?:mm|мм)\b/u);
    if (mmMatch?.[1]) {
      const size = Number(mmMatch[1]);
      attributes.filter_case_size_mm = `${size} мм`;

      if (Number.isFinite(size)) {
        if (size <= 36) {
          attributes.filter_size = "До 36 мм";
        } else if (size <= 40) {
          attributes.filter_size = "37-40 мм";
        } else if (size <= 44) {
          attributes.filter_size = "41-44 мм";
        } else {
          attributes.filter_size = "45+ мм";
        }
      }
    }

    if (/(кругл|round)/u.test(vector)) {
      attributes.filter_case_shape = "Круглая";
    } else if (/(квадрат|square)/u.test(vector)) {
      attributes.filter_case_shape = "Квадратная";
    } else if (/(прямоуг|rect)/u.test(vector)) {
      attributes.filter_case_shape = "Прямоугольная";
    } else if (/(бочк|tonneau)/u.test(vector)) {
      attributes.filter_case_shape = "Бочкообразная";
    }

    if (/(черн|black)/u.test(vector)) {
      attributes.filter_case_color = "Черный";
    } else if (/(бел|white)/u.test(vector)) {
      attributes.filter_case_color = "Белый";
    } else if (/(золот|gold)/u.test(vector)) {
      attributes.filter_case_color = "Золотой";
    } else if (/(серебр|silver)/u.test(vector)) {
      attributes.filter_case_color = "Серебристый";
    } else if (/(син|blue)/u.test(vector)) {
      attributes.filter_case_color = "Синий";
    } else if (/(красн|red)/u.test(vector)) {
      attributes.filter_case_color = "Красный";
    } else if (/(зелен|green)/u.test(vector)) {
      attributes.filter_case_color = "Зеленый";
    }

    if (/(сапфир|sapphire)/u.test(vector)) {
      attributes.filter_glass = "Сапфировое";
    } else if (/(минерал|mineral|hardlex)/u.test(vector)) {
      attributes.filter_glass = "Минеральное";
    } else if (/(акрил|acrylic)/u.test(vector)) {
      attributes.filter_glass = "Акриловое";
    }

    const waterMatch = vector.match(/\b(\d{1,3})\s?(?:м|m)\b/u);
    if (waterMatch?.[1]) {
      attributes.filter_water_resistance = `${waterMatch[1]} м`;
    } else {
      const atmMatch = vector.match(/\b(\d{1,2})\s?(?:atm|bar)\b/u);
      if (atmMatch?.[1]) {
        attributes.filter_water_resistance = `${atmMatch[1]} ATM`;
      }
    }

    const featureSet = new Set<string>();
    if (/(хронограф|chronograph)/u.test(vector)) featureSet.add("Хронограф");
    if (/(\bgmt\b)/u.test(vector)) featureSet.add("GMT");
    if (/(календар|calendar|date|дата)/u.test(vector)) featureSet.add("Календарь");
    if (/(турбийон|tourbillon)/u.test(vector)) featureSet.add("Турбийон");
    if (/(луна|moon)/u.test(vector)) featureSet.add("Фаза луны");
    if (/(тахиметр|tachymeter)/u.test(vector)) featureSet.add("Тахиметр");
    if (featureSet.size > 0) {
      attributes.filter_extra_functions = Array.from(featureSet).join(", ");
    }
  }

  return attributes;
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
  const dirtyReportPath = path.resolve(scriptsDir, "legacy-filters-dirty-report.json");

  const raw = await fs.readFile(productsPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("my-products.json must contain an array.");
  }

  const products = parsed as ImportedProduct[];

  const unknownBrandHandles: string[] = [];
  const genericCategoryHandles: string[] = [];
  const unknownPriceHandles: string[] = [];

  const filters: LegacyFilterRecord[] = products.map((product, index) => {
    const title = String(product.title ?? "").trim();
    const handle = normalizeHandle(String(product.handle ?? ""), index);
    const description = String(product.description ?? "");
    const metadata = product.metadata ?? {};
    const override = getHandleOverride(handle);

    const metadataBrandRaw = typeof metadata.filter_brand === "string" ? metadata.filter_brand.trim() : "";
    const metadataBrand = isUsefulBrand(metadataBrandRaw) ? metadataBrandRaw : "";
    const brand =
      override?.brand ||
      metadataBrand ||
      extractBrandFromTitle(title) ||
      inferBrandFromHandlePattern(handle) ||
      extractBrandFromHandle(handle) ||
      "Без бренда";

    const metadataCategoryRaw = typeof metadata.filter_category === "string" ? metadata.filter_category.trim() : "";
    const metadataCategory = isUsefulCategory(metadataCategoryRaw) ? metadataCategoryRaw : "";
    const category = override?.category || metadataCategory || inferCategory({ title, handle });

    const { minPrice, currency } = getMinPrice(product);
    const legacyId = typeof metadata.legacy_id === "string" ? metadata.legacy_id : String(metadata.legacy_id ?? "");

    const record: LegacyFilterRecord = {
      legacy_id: legacyId,
      handle,
      brand,
      category,
      price_range: toPriceRange(minPrice),
      availability: "in_stock",
      attributes: inferExtraAttributes({ title, handle, description, category }),
      currency,
      min_price: minPrice,
    };

    if (record.brand === "Без бренда") {
      unknownBrandHandles.push(handle);
    }

    if (record.category === "Каталог") {
      genericCategoryHandles.push(handle);
    }

    if (record.price_range === "unknown") {
      unknownPriceHandles.push(handle);
    }

    return record;
  });

  const payload = {
    generated_at: new Date().toISOString(),
    source: "my-products.json fallback extractor",
    schema_version: "1.0.0",
    filters,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const dirtyReport: DirtyReport = {
    generated_at: new Date().toISOString(),
    total_rows: filters.length,
    unknown_brand_count: unknownBrandHandles.length,
    generic_category_count: genericCategoryHandles.length,
    unknown_price_count: unknownPriceHandles.length,
    samples: {
      unknown_brand_handles: unknownBrandHandles.slice(0, 50),
      generic_category_handles: genericCategoryHandles.slice(0, 50),
      unknown_price_handles: unknownPriceHandles.slice(0, 50),
    },
  };

  await fs.writeFile(dirtyReportPath, `${JSON.stringify(dirtyReport, null, 2)}\n`, "utf8");

  console.log(`Generated fallback filter records: ${filters.length}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Dirty report: ${dirtyReportPath}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
