const baseUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";

const checks = [
  { path: "/", canonical: true, noindex: false },
  { path: "/catalog", canonical: true, noindex: false },
  { path: "/search", canonical: true, noindex: true },
  { path: "/account", canonical: true, noindex: true },
  { path: "/cart", canonical: true, noindex: true },
  { path: "/checkout", canonical: true, noindex: true },
  { path: "/blog", canonical: true, noindex: false },
  { path: "/product/shorts", canonical: true, noindex: false },
];

function hasCanonical(html) {
  return /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html);
}

function hasNoindex(html) {
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
}

async function main() {
  console.log(`SEO policy check (${new Date().toISOString()})`);
  let failed = false;

  for (const check of checks) {
    const url = `${baseUrl}${check.path}`;
    const response = await fetch(url, { cache: "no-store" });
    const html = await response.text();

    const canonicalOk = check.canonical ? hasCanonical(html) : true;
    const noindexPresent = hasNoindex(html);
    const noindexOk = check.noindex ? noindexPresent : !noindexPresent;
    const ok = response.status === 200 && canonicalOk && noindexOk;

    if (!ok) {
      failed = true;
    }

    console.log(`${check.path}: status=${response.status}, canonical=${canonicalOk ? "OK" : "MISS"}, robots=${noindexPresent ? "noindex" : "index"}`);
  }

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
