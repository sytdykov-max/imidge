import { performance } from "node:perf_hooks";

const baseUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";
const routes = [
  "/catalog",
  "/catalog?page=2",
  "/catalog?q=bmw",
  "/catalog?q=%D0%B1%D0%BC%D0%B2",
  "/catalog?q=bmw+x5",
  "/catalog?q=%D0%B1%D0%BC%D0%B2+%D1%855",
];

async function measure(url) {
  const started = performance.now();
  const response = await fetch(url, { cache: "no-store" });
  const finished = performance.now();
  return {
    url,
    status: response.status,
    ms: Math.round((finished - started) * 100) / 100,
  };
}

async function main() {
  const startedAll = performance.now();
  const rows = [];

  for (const route of routes) {
    const warmupUrl = `${baseUrl}${route}`;
    try {
      await fetch(warmupUrl, { cache: "no-store" });
    } catch {
      // warm-up failures are handled in measured pass
    }
  }

  for (const route of routes) {
    const fullUrl = `${baseUrl}${route}`;
    try {
      rows.push(await measure(fullUrl));
    } catch (error) {
      rows.push({
        url: fullUrl,
        status: "ERROR",
        ms: -1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const okRows = rows.filter((row) => typeof row.ms === "number" && row.ms >= 0);
  const avg = okRows.length
    ? Math.round((okRows.reduce((sum, row) => sum + row.ms, 0) / okRows.length) * 100) / 100
    : 0;
  const max = okRows.length ? Math.max(...okRows.map((row) => row.ms)) : 0;

  console.log(`Catalog speed check (${new Date().toISOString()})`);
  for (const row of rows) {
    if (row.status === "ERROR") {
      console.log(`${row.url} -> ERROR (${row.error})`);
    } else {
      console.log(`${row.url} -> ${row.status} in ${row.ms} ms`);
    }
  }

  const finishedAll = performance.now();
  const total = Math.round((finishedAll - startedAll) * 100) / 100;
  console.log(`Summary: avg=${avg} ms, max=${max} ms, total=${total} ms`);

  const slowRows = okRows.filter((row) => row.ms > 1500);
  if (slowRows.length > 0) {
    console.log("Slow routes (>1500 ms):");
    for (const row of slowRows) {
      console.log(`- ${row.url} (${row.ms} ms)`);
    }
    process.exitCode = 2;
    return;
  }

  const badStatusRows = rows.filter((row) => row.status !== 200);
  if (badStatusRows.length > 0) {
    process.exitCode = 1;
  }
}

main();
