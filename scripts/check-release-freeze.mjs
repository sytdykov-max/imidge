import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.resolve(root, "config", "release-freeze.json");

if (!existsSync(configPath)) {
  console.log("release_freeze: status=SKIP, reason=config_missing");
  process.exit(0);
}

const freeze = JSON.parse(readFileSync(configPath, "utf8"));
if (!freeze?.active) {
  console.log("release_freeze: status=OK, active=false");
  process.exit(0);
}

console.error(`release_freeze: status=FAIL, reason=${freeze.reason || "release_freeze_active"}`);
process.exit(1);
