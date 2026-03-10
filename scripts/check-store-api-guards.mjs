import { readFileSync } from "node:fs";
import path from "node:path";

function assertContains(content, pattern, label) {
  const ok = pattern.test(content);
  console.log(`${label}=${ok ? "OK" : "MISS"}`);
  return ok;
}

function main() {
  const filePath = path.resolve(process.cwd(), "apps/storefront/src/lib/medusa-browser.ts");
  const source = readFileSync(filePath, "utf8");

  const checks = [
    assertContains(source, /STORE_API_TIMEOUT_MS/, "timeout_const"),
    assertContains(source, /Store API timeout \[/, "timeout_error_message"),
    assertContains(source, /resolveCheckoutCountryCode\(/, "country_resolver"),
    assertContains(source, /checkout_country_fallback/, "country_fallback_debug"),
    assertContains(source, /country_code:\s*countryCode/, "country_code_assignment"),
  ];

  if (checks.some((item) => !item)) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}