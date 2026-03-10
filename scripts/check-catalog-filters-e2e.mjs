const baseUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";

const checks = [
  { name: "catalog_default", url: `${baseUrl}/catalog`, marker: "Каталог товаров" },
  { name: "catalog_brand_filter", url: `${baseUrl}/catalog?brand=Hublot`, marker: "Каталог товаров" },
  { name: "catalog_category_filter", url: `${baseUrl}/catalog?cat=%D0%A7%D0%B0%D1%81%D1%8B`, marker: "Каталог товаров" },
  { name: "catalog_price_filter", url: `${baseUrl}/catalog?price=100_300`, marker: "Каталог товаров" },
  { name: "catalog_combined_filters", url: `${baseUrl}/catalog?cat=%D0%A7%D0%B0%D1%81%D1%8B&brand=Hublot&price=100_300`, marker: "Каталог товаров" },
];

async function main() {
  const rows = [];
  let failed = false;

  for (const check of checks) {
    const startedAt = Date.now();
    const response = await fetch(check.url, { cache: "no-store" });
    const html = await response.text();
    const elapsedMs = Date.now() - startedAt;
    const markerOk = html.includes(check.marker);
    const ok = response.status === 200 && markerOk;

    rows.push({
      name: check.name,
      url: check.url,
      status: response.status,
      markerOk,
      elapsedMs,
      ok,
    });

    if (!ok) {
      failed = true;
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    total: rows.length,
    failed: rows.filter((row) => !row.ok).length,
    ok: !failed,
    rows,
  };

  const fs = await import("node:fs");
  const path = await import("node:path");

  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  fs.mkdirSync(logsDir, { recursive: true });
  fs.mkdirSync(docsDir, { recursive: true });

  fs.writeFileSync(path.resolve(logsDir, "check-catalog-filters-e2e-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Catalog Filters E2E Check",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Base URL: ${payload.baseUrl}`,
    `- Result: ${payload.ok ? "OK" : "FAIL"}`,
    "",
    "| Check | Status | Marker | Duration (ms) | Result |",
    "| --- | ---: | --- | ---: | --- |",
    ...rows.map((row) => `| ${row.name} | ${row.status} | ${row.markerOk ? "OK" : "MISS"} | ${row.elapsedMs} | ${row.ok ? "OK" : "FAIL"} |`),
    "",
  ].join("\n");

  fs.writeFileSync(path.resolve(docsDir, "check-catalog-filters-e2e-latest.md"), `${markdown}\n`, "utf8");

  if (!payload.ok) {
    console.error(`catalog_filters_e2e: status=FAIL, failed=${payload.failed}`);
    process.exitCode = 1;
    return;
  }

  console.log(`catalog_filters_e2e: status=OK, total=${payload.total}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
