import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const baseUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";

function extractCanonical(html) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  return match?.[1] ?? "";
}

function extractRobotsMeta(html) {
  const match = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  return match?.[1] ?? "";
}

async function fetchPage(url) {
  const response = await fetch(url, { cache: "no-store" });
  const html = await response.text();

  return {
    url,
    status: response.status,
    canonical: extractCanonical(html),
    robots: extractRobotsMeta(html),
    html,
  };
}

async function main() {
  const checks = [];

  const basePage = await fetchPage(`${baseUrl}/catalog`);
  checks.push({
    name: "base_canonical_exists",
    ok: basePage.status === 200 && Boolean(basePage.canonical),
    detail: `status=${basePage.status}, canonical=${basePage.canonical || "missing"}`,
  });

  const filteredPage = await fetchPage(`${baseUrl}/catalog?cat=%D0%A7%D0%B0%D1%81%D1%8B&brand=Hublot&page=2`);
  checks.push({
    name: "filtered_canonical_exists",
    ok: filteredPage.status === 200 && Boolean(filteredPage.canonical),
    detail: `status=${filteredPage.status}, canonical=${filteredPage.canonical || "missing"}`,
  });

  const deepPage = await fetchPage(`${baseUrl}/catalog?page=11&cat=%D0%A7%D0%B0%D1%81%D1%8B`);
  const deepRobots = (deepPage.robots || "").toLowerCase();
  checks.push({
    name: "deep_page_noindex",
    ok: deepPage.status === 200 && deepRobots.includes("noindex"),
    detail: `status=${deepPage.status}, robots=${deepPage.robots || "missing"}`,
  });

  const violations = checks.filter((check) => !check.ok).map((check) => `${check.name}: ${check.detail}`);

  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    checks,
    violations,
    ok: violations.length === 0,
    sampledPages: {
      base: {
        url: basePage.url,
        canonical: basePage.canonical,
        robots: basePage.robots,
      },
      filtered: {
        url: filteredPage.url,
        canonical: filteredPage.canonical,
        robots: filteredPage.robots,
      },
      deep: {
        url: deepPage.url,
        canonical: deepPage.canonical,
        robots: deepPage.robots,
      },
    },
  };

  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "check-catalog-filters-seo-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Catalog Filters SEO Check",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Base URL: ${payload.baseUrl}`,
    `- Result: ${payload.ok ? "OK" : "FAIL"}`,
    "",
    "## Checks",
    "",
    ...payload.checks.map((item) => `- ${item.name}: ${item.ok ? "OK" : "FAIL"} (${item.detail})`),
    "",
    "## Violations",
    "",
    ...(payload.violations.length ? payload.violations.map((item) => `- ${item}`) : ["- none"]),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "check-catalog-filters-seo-latest.md"), `${markdown}\n`, "utf8");

  if (!payload.ok) {
    console.error(`catalog_filters_seo: status=FAIL, violations=${payload.violations.length}`);
    process.exitCode = 1;
    return;
  }

  console.log("catalog_filters_seo: status=OK");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
