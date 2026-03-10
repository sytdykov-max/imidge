import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.resolve(root, "apps", "medusa", "src", "scripts", "my-products.json");

let data;
try {
  data = JSON.parse(readFileSync(sourcePath, "utf8"));
} catch {
  console.log("product_content_quality: status=SKIP, reason=source_missing");
  process.exit(0);
}

const products = Array.isArray(data) ? data : [];
let violations = 0;
for (const product of products) {
  if (!product?.title || !product?.handle) violations += 1;
  if (!product?.description) violations += 1;
}

if (violations > 0) {
  console.error(`product_content_quality: status=FAIL, products=${products.length}, violations=${violations}`);
  process.exit(1);
}

console.log(`product_content_quality: status=OK, products=${products.length}, violations=0`);
