const baseUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";

const pairs = [
  {
    left: `${baseUrl}/catalog?q=bmw`,
    right: `${baseUrl}/catalog?q=%D0%B1%D0%BC%D0%B2`,
    label: "BMW vs БМВ",
  },
  {
    left: `${baseUrl}/catalog?q=bmw+x5`,
    right: `${baseUrl}/catalog?q=%D0%B1%D0%BC%D0%B2+%D1%855`,
    label: "BMW X5 vs БМВ Х5",
  },
];

function extractCount(html) {
  const withComments = /Найдено:\s*<!-- -->\s*([0-9]+)/u.exec(html);
  if (withComments?.[1]) {
    return Number(withComments[1]);
  }

  const plain = /Найдено:\s*([0-9]+)/u.exec(html);
  if (plain?.[1]) {
    return Number(plain[1]);
  }

  return null;
}

async function fetchCount(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  const html = await response.text();
  const count = extractCount(html);
  if (count === null) {
    throw new Error(`Count marker not found for ${url}`);
  }

  return count;
}

async function main() {
  console.log(`Search equivalence check (${new Date().toISOString()})`);

  let hasMismatch = false;
  for (const pair of pairs) {
    const left = await fetchCount(pair.left);
    const right = await fetchCount(pair.right);
    const ok = left === right;
    if (!ok) {
      hasMismatch = true;
    }

    console.log(`${pair.label}: ${left} vs ${right} -> ${ok ? "OK" : "MISMATCH"}`);
  }

  if (hasMismatch) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
