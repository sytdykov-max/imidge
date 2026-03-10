import { readFileSync } from "node:fs";
import path from "node:path";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveQualityThresholds(root = process.cwd()) {
  const configPath = path.resolve(root, "config", "quality-gate-thresholds.json");
  const raw = readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const defaultProfile = typeof parsed.defaultProfile === "string" ? parsed.defaultProfile : "local";
  const profileFromEnv = process.env.QUALITY_GATE_PROFILE;
  const inferredProfile = process.env.CI ? "ci" : defaultProfile;
  const profileName = profileFromEnv || inferredProfile;
  const profile = parsed?.profiles?.[profileName] ?? parsed?.profiles?.[defaultProfile] ?? {};

  return {
    profile: profileName,
    MAX_GATE_MS: toNumber(process.env.MAX_GATE_MS, toNumber(profile.MAX_GATE_MS, 60000)),
    MAX_SINGLE_CHECK_MS: toNumber(process.env.MAX_SINGLE_CHECK_MS, toNumber(profile.MAX_SINGLE_CHECK_MS, 20000)),
    MIN_PASS_RATE: toNumber(process.env.MIN_PASS_RATE, toNumber(profile.MIN_PASS_RATE, 100)),
    MAX_READY_RUNTIME_VIOLATIONS: toNumber(
      process.env.MAX_READY_RUNTIME_VIOLATIONS,
      toNumber(profile.MAX_READY_RUNTIME_VIOLATIONS, 0)
    ),
    READY_RUNTIME_MAX_MS: toNumber(process.env.READY_RUNTIME_MAX_MS, toNumber(profile.READY_RUNTIME_MAX_MS, 1500)),
    READY_RUNTIME_MAX_FAILS: toNumber(process.env.READY_RUNTIME_MAX_FAILS, toNumber(profile.READY_RUNTIME_MAX_FAILS, 0)),
  };
}
