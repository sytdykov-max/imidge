import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const cp866Decoder = new TextDecoder("ibm866");
const cp1251Decoder = new TextDecoder("windows-1251");

type Row = {
  legacyId: string;
  title: string;
  handle: string;
  description: string;
  thumbnailUrl: string;
  imageUrl: string;
  currency: string;
  price: string;
};

type ImportedProduct = {
  title: string;
  handle: string;
  description: string;
  thumbnail?: string;
  images?: Array<{ url: string }>;
  metadata: Record<string, unknown>;
  variants: Array<{
    title: string;
    prices: Array<{
      currency_code: string;
      amount: number;
    }>;
  }>;
};

function cleanText(input: string) {
  const withoutTags = input.replace(/<[^>]*>/g, " ");
  const withoutControlChars = withoutTags.replace(/[\u0000-\u001F\u007F]/g, " ");
  return withoutControlChars.replace(/\s+/g, " ").trim();
}

function fixMojibake(value: string) {
  if (!value) {
    return value;
  }

  const repaired = Buffer.from(value, "latin1").toString("utf8");
  const originalScore = scoreDecodedText(value);
  const repairedScore = scoreDecodedText(repaired);

  if (repairedScore > originalScore + 1) {
    return repaired;
  }

  return value;
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

  if (!best) {
    return "";
  }

  return best.value;
}

function normalizeHandle(handle: string, legacyId: string) {
  const normalized = handle
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (normalized) {
    return normalized;
  }

  return `legacy-${legacyId}`;
}

async function run() {
  const mysqlExe = "C:/xampp/mysql/bin/mysql.exe";

  const sql = `
SET NAMES utf8mb4;
SELECT CONCAT_WS('\t',
  e.ID,
  HEX(e.NAME),
  HEX(e.CODE),
  HEX(IFNULL(NULLIF(e.DETAIL_TEXT,''), IFNULL(e.PREVIEW_TEXT,''))),
  HEX(IFNULL(CONCAT('https://imidge.com.ua/upload/', f_preview.SUBDIR, '/', f_preview.FILE_NAME), '')),
  HEX(IFNULL(CONCAT('https://imidge.com.ua/upload/', f_detail.SUBDIR, '/', f_detail.FILE_NAME), '')),
  p.CURRENCY,
  MIN(p.PRICE)
) AS row_tsv
FROM b_iblock_element e
JOIN b_catalog_price p ON p.PRODUCT_ID = e.ID
LEFT JOIN b_file f_preview ON f_preview.ID = NULLIF(e.PREVIEW_PICTURE, 0)
LEFT JOIN b_file f_detail ON f_detail.ID = NULLIF(e.DETAIL_PICTURE, 0)
WHERE e.IBLOCK_ID = 26
  AND e.ACTIVE = 'Y'
  AND e.CODE IS NOT NULL
  AND e.CODE <> ''
  AND p.PRICE > 0
GROUP BY e.ID, e.NAME, e.CODE, IFNULL(NULLIF(e.DETAIL_TEXT,''), IFNULL(e.PREVIEW_TEXT,'')), p.CURRENCY
ORDER BY e.ID;
`;

  const { stdout } = await execFileAsync(mysqlExe, [
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
  ], {
    encoding: "buffer",
    maxBuffer: 200 * 1024 * 1024,
    windowsHide: true,
  });

  const rows: Row[] = (stdout as Buffer)
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [legacyId = "", titleHex = "", handleHex = "", descriptionHex = "", thumbnailUrlHex = "", imageUrlHex = "", currency = "", price = ""] = line.split("\t");

      return {
        legacyId: String(legacyId),
        title: decodeBestTextFromHex(titleHex),
        handle: decodeBestTextFromHex(handleHex),
        description: decodeBestTextFromHex(descriptionHex),
        thumbnailUrl: decodeBestTextFromHex(thumbnailUrlHex),
        imageUrl: decodeBestTextFromHex(imageUrlHex),
        currency,
        price: String(price),
      };
    });

  const byHandle = new Map<string, ImportedProduct>();

  for (const row of rows) {
    const normalizedHandle = normalizeHandle(row.handle, row.legacyId);
    if (!normalizedHandle) {
      continue;
    }

    const amount = Number(row.price);
    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    const title = fixMojibake(row.title.trim());
    const cleanDescription = cleanText(fixMojibake(row.description || ""));
    const nextDescription = cleanDescription || `Товар ${title} из каталога imidge.com.ua (legacy import).`;
    const normalizedThumbnailUrl = (row.thumbnailUrl || "").trim();
    const normalizedImageUrl = (row.imageUrl || "").trim();
    const effectiveImageUrl = normalizedImageUrl || normalizedThumbnailUrl;

    if (!byHandle.has(normalizedHandle)) {
      byHandle.set(normalizedHandle, {
        title,
        handle: normalizedHandle,
        description: nextDescription,
        thumbnail: normalizedThumbnailUrl || effectiveImageUrl || undefined,
        images: effectiveImageUrl ? [{ url: effectiveImageUrl }] : undefined,
        metadata: {
          legacy_id: row.legacyId,
          legacy_source: "imidge.com.ua",
        },
        variants: [
          {
            title: "Default",
            prices: [],
          },
        ],
      });
    }

    const product = byHandle.get(normalizedHandle)!;
    const currentScore = scoreDecodedText(`${product.title} ${product.description}`);
    const nextScore = scoreDecodedText(`${title} ${nextDescription}`);
    if (nextScore > currentScore) {
      product.title = title;
      product.description = nextDescription;
      if (normalizedThumbnailUrl || effectiveImageUrl) {
        product.thumbnail = normalizedThumbnailUrl || effectiveImageUrl;
      }
      if (effectiveImageUrl) {
        product.images = [{ url: effectiveImageUrl }];
      }
      product.metadata = {
        ...product.metadata,
        legacy_id: row.legacyId,
      };
    }

    const prices = product.variants[0].prices;
    const currencyCode = row.currency.trim().toLowerCase();

    const existingCurrency = prices.find((item) => item.currency_code === currencyCode);
    if (existingCurrency) {
      existingCurrency.amount = Math.min(existingCurrency.amount, amount);
    } else {
      prices.push({
        currency_code: currencyCode,
        amount,
      });
    }
  }

  const products = [...byHandle.values()].filter((product) => product.variants[0].prices.length > 0);

  const outputPath = path.resolve(process.cwd(), "src/scripts/my-products.json");
  await fs.writeFile(outputPath, JSON.stringify(products, null, 2), "utf8");

  console.log(`Extracted products: ${products.length}`);
  console.log(`Output file: ${outputPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
