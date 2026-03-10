import { execSync } from "node:child_process";

const level = process.argv[2] ?? "standard";

const levels = {
  quick: [
    "npm run check:preflight",
    "npm run check:seo-migration-policy",
    "npm run check:regression-thresholds:light"
  ],
  standard: [
    "npm run check:mini-gate",
    "npm run check:seo-migration-schema",
    "npm run check:seo-redirect-schema"
  ],
  strict: [
    "npm run check:mini-gate:strict",
    "npm run check:all"
  ]
};

if (!levels[level]) {
  console.error(`quality_gate_level: status=FAIL, reason=unknown_level, level=${level}`);
  process.exit(1);
}

for (const command of levels[level]) {
  console.log(`quality_gate_level: running=${command}`);
  execSync(command, { stdio: "inherit" });
}

console.log(`quality_gate_level: status=OK, level=${level}`);
