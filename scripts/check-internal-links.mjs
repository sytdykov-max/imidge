const baseUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";

const seedPages = [
  "/",
  "/catalog",
  "/search",
  "/product/shorts",
  "/cart",
  "/checkout",
  "/blog",
  "/account",
];

const hrefPattern = /href=["']([^"']+)["']/gi;

function normalizePath(href) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }

  if (href.startsWith("http://") || href.startsWith("https://")) {
    try {
      const url = new URL(href);
      const base = new URL(baseUrl);
      if (url.origin !== base.origin) {
        return null;
      }

      return `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }

  if (!href.startsWith("/")) {
    return null;
  }

  return href;
}

async function fetchHtml(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, { cache: "no-store" });
  const html = await response.text();
  return { response, html };
}

async function main() {
  console.log(`Internal links check (${new Date().toISOString()})`);

  const discovered = new Set(seedPages);

  for (const page of seedPages) {
    const { response, html } = await fetchHtml(page);
    if (response.status !== 200) {
      console.log(`seed_page: ${page} status=${response.status} (skip parse)`);
      continue;
    }

    let match = hrefPattern.exec(html);
    while (match) {
      const normalized = normalizePath(match[1]);
      if (normalized) {
        discovered.add(normalized);
      }
      match = hrefPattern.exec(html);
    }
  }

  const targets = Array.from(discovered).slice(0, 200);
  let hasFailure = false;

  for (const pathname of targets) {
    const response = await fetch(`${baseUrl}${pathname}`, { cache: "no-store" });
    const ok = response.status >= 200 && response.status < 400;
    console.log(`${pathname}: status=${response.status}, ${ok ? "OK" : "BROKEN"}`);

    if (!ok) {
      hasFailure = true;
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
