import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.resolve(root, "config", "release-freeze.json");
const action = process.argv[2];

const current = JSON.parse(readFileSync(configPath, "utf8"));

if (action === "on") {
  current.active = true;
  current.reason = process.env.FREEZE_REASON ?? current.reason ?? "manual_freeze";
  current.owner = process.env.FREEZE_OWNER ?? current.owner ?? "release-owner";
  current.activatedAt = new Date().toISOString();
} else if (action === "off") {
  current.active = false;
  current.reason = "";
  current.owner = "";
  current.activatedAt = "";
} else {
  console.error("Usage: node scripts/update-release-freeze.mjs <on|off>");
  process.exit(1);
}

writeFileSync(configPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
console.log(`release_freeze_update: status=OK, active=${current.active}`);
