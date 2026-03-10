const baseUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";

const checks = [
  { name: "catalog", url: `${baseUrl}/catalog`, marker: "Каталог товаров" },
  { name: "product", url: `${baseUrl}/product/shorts`, marker: "Открыть товар" },
  { name: "cart", url: `${baseUrl}/cart`, marker: "Корзина" },
  { name: "checkout", url: `${baseUrl}/checkout`, marker: "Оформление заказа" },
];

async function main() {
  console.log(`E2E flow check (${new Date().toISOString()})`);
  let failed = false;

  for (const check of checks) {
    const response = await fetch(check.url, { cache: "no-store" });
    const html = await response.text();
    const markerOk = html.includes(check.marker);
    const ok = response.status === 200 && markerOk;
    if (!ok) {
      failed = true;
    }

    console.log(`${check.name}: status=${response.status}, marker=${markerOk ? "OK" : "MISS"}`);
  }

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
