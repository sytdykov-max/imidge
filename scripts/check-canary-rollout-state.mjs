import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.resolve(root, "config", "canary-rollout.json");

if (!existsSync(configPath)) {
  console.log("canary_rollout: status=SKIP, reason=config_missing");
  process.exit(0);
}

const cfg = JSON.parse(readFileSync(configPath, "utf8"));
if (!cfg.active) {
  console.log("canary_rollout: status=OK, active=false");
  process.exit(0);
}

const stageIndex = Number(cfg.currentStage ?? 0);
const stages = Array.isArray(cfg.stages) ? cfg.stages : [10, 25, 50, 100];
if (stageIndex < 1 || stageIndex > stages.length) {
  console.error(`canary_rollout: status=FAIL, reason=invalid_stage_index, currentStage=${stageIndex}`);
  process.exit(1);
}

console.log(`canary_rollout: status=OK, active=true, stage=${stages[stageIndex - 1]}%`);
