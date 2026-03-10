import { readFileSync } from "node:fs";
import path from "node:path";

const baseUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";
const redirectsPath = path.resolve(process.cwd(), "apps/storefront/config/seo-redirects.json");
const allowedPriority = new Set(["p0", "p1", "p2", "p3"]);
const allowedStatus = new Set(["ready", "planned", "blocked", "deprecated"]);
const allowedSourceType = new Set(["legacy_path", "legacy_script", "legacy_translit", "campaign", "other"]);
const allowedTargetType = new Set(["listing", "product", "content", "service", "other"]);

function fail(message) {
  console.error(`[seo-redirect-map] FAIL: ${message}`);
  process.exitCode = 1;
}

function normalizeLocation(value) {
  try {
    return new URL(value, baseUrl).pathname;
  } catch {
    return "";
  }
}

async function checkHttpRedirect(source, destination) {
  const url = new URL(source, baseUrl).toString();
  const response = await fetch(url, {
    redirect: "manual",
    cache: "no-store",
  });

  const location = response.headers.get("location") ?? "";
  const locationPath = normalizeLocation(location);
  const statusOk = [301, 302, 307, 308].includes(response.status);
  const destinationOk = locationPath === destination;

  if (!statusOk || !destinationOk) {
    throw new Error(
      `${source}: expected redirect to ${destination}, got status=${response.status}, location=${location || "<empty>"}`
    );
  }

  console.log(`[seo-redirect-map] ${source} -> ${destination} (${response.status})`);
}

async function main() {
  console.log(`[seo-redirect-map] started at ${new Date().toISOString()}`);

  const raw = readFileSync(redirectsPath, "utf8");
  const redirects = JSON.parse(raw);

  if (!Array.isArray(redirects) || redirects.length === 0) {
    fail("redirect map must be a non-empty array");
    return;
  }

  const seenSources = new Set();
  let hasValidationError = false;

  redirects.forEach((entry, index) => {
    const prefix = `entry #${index + 1}`;

    if (!entry || typeof entry !== "object") {
      hasValidationError = true;
      fail(`${prefix}: must be an object`);
      return;
    }

    const source = typeof entry.source === "string" ? entry.source.trim() : "";
    const destination = typeof entry.destination === "string" ? entry.destination.trim() : "";

    if (!source.startsWith("/")) {
      hasValidationError = true;
      fail(`${prefix}: source must start with '/'`);
    }

    if (!destination.startsWith("/")) {
      hasValidationError = true;
      fail(`${prefix}: destination must start with '/'`);
    }

    if (source.includes(" ") || destination.includes(" ")) {
      hasValidationError = true;
      fail(`${prefix}: source/destination must not contain spaces`);
    }

    if (source === destination) {
      hasValidationError = true;
      fail(`${prefix}: source and destination must differ (${source})`);
    }

    if (entry.routeGroup !== undefined && typeof entry.routeGroup !== "string") {
      hasValidationError = true;
      fail(`${prefix}: routeGroup must be string when provided`);
    }

    if (entry.owner !== undefined && typeof entry.owner !== "string") {
      hasValidationError = true;
      fail(`${prefix}: owner must be string when provided`);
    }

    if (entry.priority !== undefined && !allowedPriority.has(entry.priority)) {
      hasValidationError = true;
      fail(`${prefix}: priority must be one of ${Array.from(allowedPriority).join(", ")}`);
    }

    if (entry.status !== undefined && !allowedStatus.has(entry.status)) {
      hasValidationError = true;
      fail(`${prefix}: status must be one of ${Array.from(allowedStatus).join(", ")}`);
    }

    if (entry.sourceType !== undefined && !allowedSourceType.has(entry.sourceType)) {
      hasValidationError = true;
      fail(`${prefix}: sourceType must be one of ${Array.from(allowedSourceType).join(", ")}`);
    }

    if (entry.targetType !== undefined && !allowedTargetType.has(entry.targetType)) {
      hasValidationError = true;
      fail(`${prefix}: targetType must be one of ${Array.from(allowedTargetType).join(", ")}`);
    }

    if (entry.notes !== undefined && typeof entry.notes !== "string") {
      hasValidationError = true;
      fail(`${prefix}: notes must be string when provided`);
    }

    if (seenSources.has(source)) {
      hasValidationError = true;
      fail(`${prefix}: duplicate source '${source}'`);
    }

    seenSources.add(source);
  });

  if (hasValidationError) {
    return;
  }

  let hasHttpError = false;

  for (const entry of redirects) {
    try {
      await checkHttpRedirect(entry.source, entry.destination);
    } catch (error) {
      hasHttpError = true;
      fail(error instanceof Error ? error.message : String(error));
    }
  }

  if (!hasHttpError && process.exitCode !== 1) {
    console.log(`[seo-redirect-map] OK: ${redirects.length} redirects verified`);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
