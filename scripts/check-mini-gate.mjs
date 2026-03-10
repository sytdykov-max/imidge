import { spawnSync } from "node:child_process";

const strictMode = process.argv.includes("--strict") || String(process.env.MINI_GATE_STRICT ?? "false").toLowerCase() === "true";

const commands = [
  ["npm", ["run", "check:preflight"]],
  ["npm", ["run", "report:seo-migration-manifest"]],
  ["npm", ["run", "check:seo-migration-policy"]],
  ["npm", ["run", "check:smoke"]],
  ["npm", ["run", "check:regression-thresholds:light"]],
];

if (strictMode) {
  commands.splice(3, 0, ["npm", ["run", "check:docs-threshold-drift"]]);
  commands.splice(4, 0, ["npm", ["run", "probe:ready-runtime"]]);
  commands.splice(5, 0, ["npm", ["run", "check:filter-metadata-coverage"]]);
}

console.log(`mini_gate: mode=${strictMode ? "strict" : "default"}, steps=${commands.length}`);

for (const [cmd, args] of commands) {
  const preview = `${cmd} ${args.join(" ")}`;
  console.log(`>>> ${preview}`);

  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", `${cmd} ${args.join(" ")}`], {
          stdio: "inherit",
          shell: false,
        })
      : spawnSync(cmd, args, {
          stdio: "inherit",
          shell: false,
        });

  if ((result.status ?? 1) !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
