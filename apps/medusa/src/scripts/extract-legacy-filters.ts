import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const cp866Decoder = new TextDecoder("ibm866");
const cp1251Decoder = new TextDecoder("windows-1251");
const ALLOWED_CURRENCIES = new Set(["uah", "usd", "eur"]);

type RawRow = {
  legacyId: string;
  title: string;
  handleRaw: string;
  sectionName: string;
  sectionCode: string;
  currency: string;
  minPriceRaw: string;
  quantityRaw: string;
};

type RawPropertyRow = {
  legacyId: string;
  handleRaw: string;
  propertyCode: string;
  propertyValue: string;
};
const RESERVED_FILTER_KEYS = new Set([
  "filter_brand",
  "filter_category",
  "filter_price_range",
  "filter_availability",
]);
const PROPERTY_CODE_BLACKLIST = new Set([
  "CML2_LINK",
  "MORE_PHOTO",
  "vote_count",
  "vote_sum",
  "rating",
  "PRICE_SORT",
  "SORT_TYPE_PRODUCT",
  "METKA",
  "NOTE",
  "PRICE_OPT",
  "LINK_YOUTUBE",
  "LINK_MEDIA",
  "FULL_REVIEW",
  "ARTICLE_LINK",
  "ALT_PREV",
  "ALT_OSN",
]);

type FilterRecord = {
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

function inferGender(title: string, handle: string) {
  const vector = `${title} ${handle}`.toLowerCase();
  if (/(unisex|унисекс)/u.test(vector)) return "Унисекс";
  if (/(мужск|male|men|man)/u.test(vector)) return "Мужской";
  if (/(женск|female|women|woman)/u.test(vector)) return "Женский";
  return "";
}

function normalizeGenderLabel(value: string) {
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

function inferProductType(title: string, category: string) {
  const vector = `${title} ${category}`.toLowerCase();
  if (/(часы|часов|watch|watches|chasov)/u.test(vector)) return "watch";
  if (/(сумк|bag|bags|handbag|клатч|рюкзак)/u.test(vector)) return "bag";
  if (/(футбол|shirt|dress|plate|shorts|sweat)/u.test(vector)) return "apparel";
  return "other";
}

function inferCategoryFromTypeProduct(typeProduct: string) {
  const vector = fixMojibake(typeProduct).toLowerCase();

  if (/(часы|watch|часов)/u.test(vector)) return "Часы";
  if (/(барсет|barset)/u.test(vector)) return "Барсетки";
  if (/(клатч|klatch|clutch)/u.test(vector)) return "Клатчи";
  if (/(рюкзак|ryukzak|backpack)/u.test(vector)) return "Рюкзаки";
  if (/(портмон|portmone)/u.test(vector)) return "Портмоне";
  if (/(визитниц|vizitnits|cardholder|business\s*card)/u.test(vector)) return "Визитницы";
  if (/(кошел|koshel|wallet)/u.test(vector)) return "Кошельки";
  if (/(ремен|ремн|belt)/u.test(vector)) return "Ремни";
  if (/(чехл|обложк|ipad\s*case|ipad\s*cover|кейс\s*ipad)/u.test(vector)) return "Чехлы/Обложки iPad";
  if (/(телефон|смартфон|smartphone|mobile\s*phone|iphone|nokia|mobiado|vertu|ipod)/u.test(vector)) return "Телефоны";
  if (/(сумк|bag)/u.test(vector)) return "Сумки";
  if (/(футбол|рубаш|поло|dress|shirt|shorts|шорт|плать|одеж|джинс|штаны|брюк|свитер|толстов|куртк|жилет|майк|галстук|шарф|платк|кепк|шапк|костюм|ветровк|постельн|белье)/u.test(vector)) return "Одежда";
  if (/(кед|кроссов|ботин|туфл|сандал|шлепан|обув)/u.test(vector)) return "Обувь";
  if (/(зажигал|ручк|зонт|аксессуар|accessor|блокнот|брелок|ключниц|зажим|маникюр|гильотин|пепельниц|хьюмидор|коробк|сертификат|бижутер|пакет|застежк|сѓс‡|рµрјр|ручк)/u.test(vector)) return "Аксессуары";
  if (/(electronics|электрон)/u.test(vector)) return "Электроника";

  return "";
}

const CATEGORY_PREFIX_MAP: Array<{ category: string; prefixes: string[] }> = [
  {
    category: "Часы",
    prefixes: ["kopiya-chasov", "chasy", "muzhskie-chasy", "zhenskie-chasy", "nastennye-chasy", "watch"],
  },
  {
    category: "Барсетки",
    prefixes: ["barsetka"],
  },
  {
    category: "Клатчи",
    prefixes: ["klatch", "clutch"],
  },
  {
    category: "Рюкзаки",
    prefixes: ["ryukzak", "backpack"],
  },
  {
    category: "Портмоне",
    prefixes: ["portmone"],
  },
  {
    category: "Визитницы",
    prefixes: ["vizitnitsa", "cardholder", "business-card"],
  },
  {
    category: "Кошельки",
    prefixes: ["koshelek", "wallet"],
  },
  {
    category: "Ремни",
    prefixes: ["remen", "belt"],
  },
  {
    category: "Чехлы/Обложки iPad",
    prefixes: ["chehol-ipad", "oblozhka-ipad", "ipad-case", "ipad-cover", "case-for-ipad", "cover-for-ipad"],
  },
  {
    category: "Телефоны",
    prefixes: ["telefon", "smartfon", "smartphone", "iphone", "nokia", "mobiado", "vertu", "ipod"],
  },
  {
    category: "Сумки",
    prefixes: ["sumka", "sumki", "bag"],
  },
  {
    category: "Одежда",
    prefixes: ["futbolka", "rubashka", "polo", "plate", "dress", "shorts", "hoodie", "sweatshirt", "odezhda"],
  },
  {
    category: "Обувь",
    prefixes: ["krossovki", "kedy", "tufli", "botinki", "sapogi", "obuv", "shoes"],
  },
  {
    category: "Аксессуары",
    prefixes: [
      "remen",
      "zazhigalka",
      "ruchka",
      "zont",
      "zaponki",
      "brelok",
      "braslet",
      "korobka-dlya-chasov",
      "zastezhka",
      "aksessuary",
      "accessories",
    ],
  },
  {
    category: "Электроника",
    prefixes: ["vertu", "nokia", "mobiado", "iphone", "ipod", "telefon", "smartfon", "electronics"],
  },
];

function inferCategoryFromHandle(handle: string) {
  const normalizedHandle = handle.toLowerCase();

  for (const mapping of CATEGORY_PREFIX_MAP) {
    if (mapping.prefixes.some((prefix) => normalizedHandle === prefix || normalizedHandle.startsWith(`${prefix}-`))) {
      return mapping.category;
    }
  }

  return "";
}

function inferCategoryFromText(title: string, handle: string) {
  const vector = `${title} ${handle}`.toLowerCase();

  if (/(часы|часов|watch|watches|chasov)/u.test(vector)) return "Часы";
  if (/(барсет|barset)/u.test(vector)) return "Барсетки";
  if (/(клатч|klatch|clutch)/u.test(vector)) return "Клатчи";
  if (/(рюкзак|ryukzak|backpack)/u.test(vector)) return "Рюкзаки";
  if (/(портмон|portmone)/u.test(vector)) return "Портмоне";
  if (/(визитниц|vizitnits|vizitnitsa|cardholder|business\s*card)/u.test(vector)) return "Визитницы";
  if (/(кошел|koshel|wallet)/u.test(vector)) return "Кошельки";
  if (/(ремен|ремн|belt)/u.test(vector)) return "Ремни";
  if (/(чехл|обложк|ipad\s*case|ipad\s*cover|кейс\s*ipad)/u.test(vector)) return "Чехлы/Обложки iPad";
  if (/(телефон|смартфон|smartphone|mobile\s*phone|iphone|nokia|mobiado|vertu|ipod)/u.test(vector)) return "Телефоны";
  if (/(сумк|bag|bags|handbag|chemodan|чемодан)/u.test(vector)) return "Сумки";
  if (/(футбол|рубаш|поло|dress|shirt|shorts|шорт|plate|плать|hoodie|sweat|одеж|kurtka|dzhins|bryuki|sviter|tolstovk|galstuk|sharf|platok|kepk|shapka|kostyum|vetrovk|zhilet|maika|postelnog|belya|белье|постельн)/u.test(vector)) return "Одежда";
  if (/(кроссовк|кед|туфл|ботин|сапог|shoes|sneaker|krossov|kedy|tufli|sandali|slantsy)/u.test(vector)) return "Обувь";
  if (/(зажигал|ручк|зонт|запонк|аксессуар|accessor|bloknot|brelok|klyuchnitsa|zazhim|manikyurn|gilotina|pepelnitsa|humidor|khyumidor|korobka|sertifikat|bijuteri|paket|sterzhen)/u.test(vector)) return "Аксессуары";
  if (/(electronics|электрон)/u.test(vector)) return "Электроника";

  return "";
}

function isGenericCategory(category: string) {
  return /^(без категории|каталог|catalog|неактивные)$/iu.test(category);
}

function inferSaleFlag(title: string) {
  return /(акци|sale|discount|скидк)/iu.test(title);
}

function inferNewFlag(title: string) {
  return /(новин|new|latest)/iu.test(title);
}

function scoreDecodedText(value: string) {
  const replacementCount = (value.match(/�/g) ?? []).length;
  const cyrillicCount = (value.match(/[А-Яа-яЁё]/g) ?? []).length;
  const mojibakeCount = (value.match(/[╨╤▒▓░]/g) ?? []).length;
  const brokenRuPatternCount = (value.match(/Р[А-Яа-яЁё]/g) ?? []).length;

  return cyrillicCount * 2 - replacementCount * 10 - mojibakeCount * 6 - brokenRuPatternCount * 4;
}

function decodeBestTextFromHex(hexValue: string) {
  if (!hexValue) {
    return "";
  }

  const bytes = Buffer.from(hexValue, "hex");
  const candidates = [
    bytes.toString("utf8"),
    cp866Decoder.decode(bytes),
    cp1251Decoder.decode(bytes),
  ];

  let best: { value: string; score: number } | null = null;

  for (const candidate of candidates) {
    const score = scoreDecodedText(candidate);
    if (!best || score > best.score) {
      best = { value: candidate, score };
    }
  }

  return best?.value ?? "";
}

function fixMojibake(value: string) {
  if (!value) {
    return value;
  }

  const repaired = Buffer.from(value, "latin1").toString("utf8");
  const originalScore = scoreDecodedText(value);
  const repairedScore = scoreDecodedText(repaired);

  return repairedScore > originalScore + 1 ? repaired : value;
}

function normalizeLabel(value: string, fallback: string) {
  const normalized = fixMojibake(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || fallback;
}

function normalizeHandle(handle: string, legacyId: string) {
  const normalized = handle
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || `legacy-${legacyId}`;
}

function sanitizePropertyValue(value: string) {
  return normalizeLabel(value, "")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s*\/\s*/g, " ")
    .trim();
}

function toFilterKeyFromPropertyCode(propertyCode: string) {
  const key = propertyCode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!key) {
    return "";
  }

  return `filter_${key}`;
}

function mergeAttributeValue(existing: unknown, next: string) {
  if (typeof existing !== "string" || !existing.trim()) {
    return next;
  }

  if (existing === next) {
    return existing;
  }

  const uniqueValues = new Set([
    ...existing.split(" / ").map((item) => item.trim()).filter(Boolean),
    next,
  ]);

  return [...uniqueValues].slice(0, 4).join(" / ");
}

async function loadPropertyAttributesByHandle(mysqlExe: string) {
  const sql = `
SET NAMES utf8mb4;
SELECT CONCAT_WS('\t',
  e.ID,
  HEX(IFNULL(e.CODE, '')),
  HEX(IFNULL(p.CODE, '')),
  HEX(IFNULL(TRIM(COALESCE(pe.VALUE, ep.VALUE)), ''))
) AS row_tsv
FROM b_iblock_element e
JOIN b_iblock_element_property ep ON ep.IBLOCK_ELEMENT_ID = e.ID
JOIN b_iblock_property p ON p.ID = ep.IBLOCK_PROPERTY_ID
LEFT JOIN b_iblock_property_enum pe ON pe.ID = ep.VALUE_ENUM
WHERE e.IBLOCK_ID = 26
  AND e.ACTIVE = 'Y'
  AND p.IBLOCK_ID = 26
  AND p.ACTIVE = 'Y'
  AND p.CODE IS NOT NULL
  AND p.CODE <> ''
  AND TRIM(COALESCE(pe.VALUE, ep.VALUE, '')) <> ''
ORDER BY e.ID;
`;

  const { stdout } = await execFileAsync(
    mysqlExe,
    [
      "-u",
      "root",
      "-D",
      "dbimidge",
      "--default-character-set=utf8mb4",
      "--batch",
      "--raw",
      "--skip-column-names",
      "-e",
      sql,
    ],
    {
      encoding: "buffer",
      maxBuffer: 200 * 1024 * 1024,
      windowsHide: true,
    }
  );

  const rows: RawPropertyRow[] = (stdout as Buffer)
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [legacyId = "", handleHex = "", propertyCodeHex = "", propertyValueHex = ""] = line.split("\t");
      return {
        legacyId,
        handleRaw: decodeBestTextFromHex(handleHex),
        propertyCode: decodeBestTextFromHex(propertyCodeHex),
        propertyValue: decodeBestTextFromHex(propertyValueHex),
      };
    });

  const attributesByHandle = new Map<string, Record<string, string>>();

  for (const row of rows) {
    const handle = normalizeHandle(row.handleRaw, row.legacyId);
    const propertyCode = row.propertyCode.trim();
    const propertyValue = sanitizePropertyValue(row.propertyValue);

    if (!propertyCode || !propertyValue || PROPERTY_CODE_BLACKLIST.has(propertyCode)) {
      continue;
    }

    const filterKey = toFilterKeyFromPropertyCode(propertyCode);
    if (!filterKey || RESERVED_FILTER_KEYS.has(filterKey)) {
      continue;
    }

    const current = attributesByHandle.get(handle) ?? {};
    current[filterKey] = mergeAttributeValue(current[filterKey], propertyValue);
    attributesByHandle.set(handle, current);
  }

  return attributesByHandle;
}

function toDisplayBrandFromHandle(handle: string) {
  if (!handle) {
    return "Без бренда";
  }

  const upper = handle.toUpperCase();
  if (handle.length <= 4) {
    return upper;
  }

  return `${upper.charAt(0)}${handle.slice(1).toLowerCase()}`;
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

function toTitleWordsFromSlug(slug: string) {
  const compact = slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) {
    return "";
  }

  return compact
    .split(" ")
    .filter(Boolean)
    .map((word) => (/^[a-z]{1,3}$/i.test(word) ? word.toUpperCase() : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`))
    .join(" ");
}

function inferIpadCaseBrandFromHandle(normalizedHandle: string) {
  const brandMatch = normalizedHandle.match(/(?:chekhol-dlya-ipad-|ipad-case-|ipad-cover-)([a-z0-9-]+?)-model-/i);
  if (!brandMatch) {
    return "";
  }

  const slug = brandMatch[1]
    .replace(/(?:^|-)ipad(?:-|$)/gi, "-")
    .replace(/(?:^|-)case(?:-|$)/gi, "-")
    .replace(/(?:^|-)cover(?:-|$)/gi, "-")
    .replace(/(?:^|-)chekhol(?:-|$)/gi, "-")
    .replace(/(?:^|-)oblozhka(?:-|$)/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug || /^(model|unknown|bez-brenda|no-brand)$/i.test(slug)) {
    return "";
  }

  return toTitleWordsFromSlug(slug);
}

function extractBrand(title: string, normalizedHandle: string, category: string) {
  const titleBrandMatch = title.match(/(?:часы|часов|watch|watches)\s+([A-Za-zА-Яа-я0-9-]+)/iu);
  const titleBrand = titleBrandMatch?.[1]?.trim();
  if (titleBrand) {
    return normalizeBrandLabel(titleBrand);
  }

  const handleBrandMatch = normalizedHandle.match(/(?:kopiya-chasov-|watch-)([a-z0-9-]+)/i);
  const handleBrandRaw = handleBrandMatch?.[1]?.split("-")?.[0];
  if (handleBrandRaw) {
    return normalizeBrandLabel(toDisplayBrandFromHandle(handleBrandRaw));
  }

  if (category === "Чехлы/Обложки iPad") {
    const ipadBrand = inferIpadCaseBrandFromHandle(normalizedHandle);
    if (ipadBrand) {
      return ipadBrand;
    }
  }

  return "Без бренда";
}

function toPriceRange(minPrice: number | null): FilterRecord["price_range"] {
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
  const mysqlExe = "C:/xampp/mysql/bin/mysql.exe";
  const propertyAttributesByHandle = await loadPropertyAttributesByHandle(mysqlExe);

  const sql = `
SET NAMES utf8mb4;
SELECT CONCAT_WS('\t',
  e.ID,
  HEX(IFNULL(e.NAME, '')),
  HEX(IFNULL(e.CODE, '')),
  HEX(IFNULL(s.NAME, '')),
  HEX(IFNULL(s.CODE, '')),
  IFNULL(p.CURRENCY, ''),
  IFNULL(MIN(p.PRICE), ''),
  IFNULL(cp.QUANTITY, '')
) AS row_tsv
FROM b_iblock_element e
LEFT JOIN b_catalog_price p ON p.PRODUCT_ID = e.ID
LEFT JOIN b_iblock_section_element se ON se.IBLOCK_ELEMENT_ID = e.ID
LEFT JOIN b_iblock_section s ON s.ID = se.IBLOCK_SECTION_ID
LEFT JOIN b_catalog_product cp ON cp.ID = e.ID
WHERE e.IBLOCK_ID = 26
  AND e.ACTIVE = 'Y'
GROUP BY e.ID, e.NAME, e.CODE, s.NAME, s.CODE, p.CURRENCY, cp.QUANTITY
ORDER BY e.ID;
`;

  const { stdout } = await execFileAsync(
    mysqlExe,
    [
      "-u",
      "root",
      "-D",
      "dbimidge",
      "--default-character-set=utf8mb4",
      "--batch",
      "--raw",
      "--skip-column-names",
      "-e",
      sql,
    ],
    {
      encoding: "buffer",
      maxBuffer: 200 * 1024 * 1024,
      windowsHide: true,
    }
  );

  const rows: RawRow[] = (stdout as Buffer)
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [
        legacyId = "",
        titleHex = "",
        handleHex = "",
        sectionNameHex = "",
        sectionCodeHex = "",
        currency = "",
        minPriceRaw = "",
        quantityRaw = "",
      ] = line.split("\t");

      return {
        legacyId,
        title: decodeBestTextFromHex(titleHex),
        handleRaw: decodeBestTextFromHex(handleHex),
        sectionName: decodeBestTextFromHex(sectionNameHex),
        sectionCode: decodeBestTextFromHex(sectionCodeHex),
        currency,
        minPriceRaw,
        quantityRaw,
      };
    });

  const filtersByHandle = new Map<string, FilterRecord>();
  const dirty = {
    duplicate_handles: [] as string[],
    empty_handle_source_codes: [] as string[],
    invalid_currencies: [] as Array<{ legacy_id: string; currency: string }>,
    invalid_prices: [] as Array<{ legacy_id: string; min_price_raw: string }>,
    missing_brand: [] as string[],
    missing_category: [] as string[],
  };

  for (const row of rows) {
    const sourceHandle = normalizeLabel(row.handleRaw, "");
    if (!sourceHandle) {
      dirty.empty_handle_source_codes.push(row.legacyId);
    }

    const handle = normalizeHandle(sourceHandle, row.legacyId);
    const title = normalizeLabel(row.title, `Товар ${row.legacyId}`);
    const category = normalizeLabel(row.sectionName || row.sectionCode, "Без категории");
    const propertyAttributes = propertyAttributesByHandle.get(handle) ?? {};

    const typeProductValue = typeof propertyAttributes.filter_type_product === "string"
      ? propertyAttributes.filter_type_product
      : "";
    const inferredCategoryFromTypeProduct = inferCategoryFromTypeProduct(typeProductValue);
    const inferredCategoryFromHandle = inferCategoryFromHandle(handle);
    const inferredCategoryFromText = inferCategoryFromText(title, handle);
    const inferredCategory = inferredCategoryFromTypeProduct || inferredCategoryFromHandle || inferredCategoryFromText || "";
    const normalizedCategory = (isGenericCategory(category) || /^сумки$/iu.test(category))
      ? inferredCategory || category
      : category;
    const brand = extractBrand(title, handle, normalizedCategory);

    const minPrice = Number(row.minPriceRaw);
    const validPrice = Number.isFinite(minPrice) && minPrice > 0 ? minPrice : null;
    if (validPrice === null && row.minPriceRaw.trim() !== "") {
      dirty.invalid_prices.push({ legacy_id: row.legacyId, min_price_raw: row.minPriceRaw });
    }

    const currency = (row.currency || "").trim().toLowerCase();
    const normalizedCurrency = currency || "unknown";
    if (currency && !ALLOWED_CURRENCIES.has(currency)) {
      dirty.invalid_currencies.push({ legacy_id: row.legacyId, currency });
    }

    const quantity = Number(row.quantityRaw);
    const availability: FilterRecord["availability"] = Number.isFinite(quantity) && quantity > 0 ? "in_stock" : "out_of_stock";

    const rawGender =
      (typeof propertyAttributes.filter_gender === "string" ? propertyAttributes.filter_gender : "") ||
      (typeof propertyAttributes.filter_sex === "string" ? propertyAttributes.filter_sex : "") ||
      inferGender(title, handle);
    const normalizedGender = normalizeGenderLabel(rawGender);
    const {
      filter_gender: _legacyFilterGender,
      filter_sex: _legacyFilterSex,
      ...cleanPropertyAttributes
    } = propertyAttributes;

    const nextRecord: FilterRecord = {
      legacy_id: row.legacyId,
      handle,
      brand,
      category: normalizedCategory,
      price_range: toPriceRange(validPrice),
      availability,
      attributes: {
        ...(normalizedGender ? { filter_gender: normalizedGender } : {}),
        filter_type: inferProductType(title, normalizedCategory),
        filter_is_sale: inferSaleFlag(title),
        filter_is_new: inferNewFlag(title),
        legacy_section_code: normalizeLabel(row.sectionCode, ""),
        ...cleanPropertyAttributes,
      },
      currency: normalizedCurrency,
      min_price: validPrice,
    };

    if (!brand || brand === "Без бренда") {
      dirty.missing_brand.push(row.legacyId);
    }

    if (!normalizedCategory || normalizedCategory === "Без категории") {
      dirty.missing_category.push(row.legacyId);
    }

    if (filtersByHandle.has(handle)) {
      dirty.duplicate_handles.push(handle);
      const previous = filtersByHandle.get(handle)!;
      const previousScore = (previous.min_price ?? Infinity);
      const nextScore = (nextRecord.min_price ?? Infinity);
      if (nextScore < previousScore) {
        filtersByHandle.set(handle, nextRecord);
      }
      continue;
    }

    filtersByHandle.set(handle, nextRecord);
  }

  const filters = [...filtersByHandle.values()].sort((a, b) => a.handle.localeCompare(b.handle));

  const dirtyReport = {
    generated_at: new Date().toISOString(),
    total_rows: rows.length,
    unique_handles: filters.length,
    duplicate_handles_count: dirty.duplicate_handles.length,
    empty_handle_source_codes_count: dirty.empty_handle_source_codes.length,
    invalid_currencies_count: dirty.invalid_currencies.length,
    invalid_prices_count: dirty.invalid_prices.length,
    missing_brand_count: dirty.missing_brand.length,
    missing_category_count: dirty.missing_category.length,
    samples: {
      duplicate_handles: dirty.duplicate_handles.slice(0, 50),
      empty_handle_source_codes: dirty.empty_handle_source_codes.slice(0, 50),
      invalid_currencies: dirty.invalid_currencies.slice(0, 50),
      invalid_prices: dirty.invalid_prices.slice(0, 50),
      missing_brand: dirty.missing_brand.slice(0, 50),
      missing_category: dirty.missing_category.slice(0, 50),
    },
  };

  const outputFiltersPath = path.resolve(process.cwd(), "src/scripts/legacy-filters.json");
  const outputDirtyPath = path.resolve(process.cwd(), "src/scripts/legacy-filters-dirty-report.json");

  await fs.writeFile(
    outputFiltersPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        source: "imidge.com.ua legacy db (iblock 26)",
        schema_version: "1.0.0",
        filters,
      },
      null,
      2
    ),
    "utf8"
  );

  await fs.writeFile(outputDirtyPath, JSON.stringify(dirtyReport, null, 2), "utf8");

  console.log(`Extracted filter records: ${filters.length}`);
  console.log(`Filters artifact: ${outputFiltersPath}`);
  console.log(`Dirty data report: ${outputDirtyPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
