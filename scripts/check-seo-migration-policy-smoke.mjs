import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function main() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "imidge-seo-policy-smoke-"));
  const fixturePath = path.join(tempDir, "manifest.json");
  const outputJsonPath = path.join(tempDir, "policy.json");
  const outputMdPath = path.join(tempDir, "policy.md");

  const fixture = {
    generatedAt: new Date().toISOString(),
    baseUrl: "http://127.0.0.1:3002",
    total: 2,
    rows: [
      {
        source: "/catalogue",
        destination: "/catalog",
        status: "ready",
        runtime_ok: false,
        runtimeVerified: true,
        redirectOk: false,
        destinationOk: true,
        owner: "seo",
        priority: "p0",
      },
      {
        source: "/shop",
        destination: "/catalog",
        status: "planned",
        runtime_ok: false,
      },
    ],
  };

  writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

  const result = spawnSync(process.execPath, ["./scripts/check-seo-migration-policy.mjs"], {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
    env: {
      ...process.env,
      SEO_MIGRATION_MANIFEST_PATH: fixturePath,
      SEO_MIGRATION_POLICY_JSON_PATH: outputJsonPath,
      SEO_MIGRATION_POLICY_MD_PATH: outputMdPath,
    },
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  if (output) {
    process.stdout.write(output);
  }

  if ((result.status ?? 1) === 0) {
    rmSync(tempDir, { recursive: true, force: true });
    console.error("policy smoke expected FAIL but got OK");
    process.exitCode = 1;
    return;
  }

  const report = JSON.parse(readFileSync(outputJsonPath, "utf8"));

  if (!report || report.violationsTotal < 1) {
    rmSync(tempDir, { recursive: true, force: true });
    console.error("policy smoke expected at least one violation");
    process.exitCode = 1;
    return;
  }

  rmSync(tempDir, { recursive: true, force: true });
  console.log(`seo_migration_policy_smoke: status=OK, violations=${report.violationsTotal}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
