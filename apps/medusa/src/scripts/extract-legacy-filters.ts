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
  if (/(мужск|male|men|man)/u.test(vector)) return "male";
  if (/(женск|female|women|woman)/u.test(vector)) return "female";
  if (/(unisex|унисекс)/u.test(vector)) return "unisex";
  return "unknown";
}

function inferProductType(title: string, category: string) {
  const vector = `${title} ${category}`.toLowerCase();
  if (/(часы|часов|watch|watches|chasov)/u.test(vector)) return "watch";
  if (/(сумк|bag|bags|handbag|клатч|рюкзак)/u.test(vector)) return "bag";
  if (/(футбол|shirt|dress|plate|shorts|sweat)/u.test(vector)) return "apparel";
  return "other";
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

function extractBrand(title: string, normalizedHandle: string) {
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
    const brand = extractBrand(title, handle);

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

    const nextRecord: FilterRecord = {
      legacy_id: row.legacyId,
      handle,
      brand,
      category,
      price_range: toPriceRange(validPrice),
      availability,
      attributes: {
        filter_gender: inferGender(title, handle),
        filter_type: inferProductType(title, category),
        filter_is_sale: inferSaleFlag(title),
        filter_is_new: inferNewFlag(title),
        legacy_section_code: normalizeLabel(row.sectionCode, ""),
      },
      currency: normalizedCurrency,
      min_price: validPrice,
    };

    if (!brand || brand === "Без бренда") {
      dirty.missing_brand.push(row.legacyId);
    }

    if (!category || category === "Без категории") {
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
