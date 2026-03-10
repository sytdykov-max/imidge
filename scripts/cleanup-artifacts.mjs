import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function readJsonlLines(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function writeJsonlLines(filePath, lines) {
  writeFileSync(filePath, `${lines.join("\n")}${lines.length ? "\n" : ""}`, "utf8");
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function cleanupHistoryFile(root, relPath, keepRuns, archiveRoot, stamp) {
  const filePath = path.resolve(root, relPath);
  const lines = readJsonlLines(filePath);

  if (lines.length <= keepRuns) {
    return {
      file: relPath,
      before: lines.length,
      after: lines.length,
      archived: 0,
      trimmed: false,
      archiveFile: "",
    };
  }

  const removeCount = lines.length - keepRuns;
  const archivedLines = lines.slice(0, removeCount);
  const keptLines = lines.slice(removeCount);

  const baseName = path.basename(relPath, ".jsonl");
  const archiveDir = path.resolve(archiveRoot, baseName);
  ensureDir(archiveDir);
  const archiveFilePath = path.resolve(archiveDir, `${stamp}.jsonl`);
  writeJsonlLines(archiveFilePath, archivedLines);
  writeJsonlLines(filePath, keptLines);

  return {
    file: relPath,
    before: lines.length,
    after: keptLines.length,
    archived: archivedLines.length,
    trimmed: true,
    archiveFile: path.relative(root, archiveFilePath).replaceAll("\\", "/"),
  };
}

function copyIfExists(root, relPath, targetDir) {
  const from = path.resolve(root, relPath);
  if (!existsSync(from)) {
    return null;
  }

  ensureDir(targetDir);
  const fileName = path.basename(relPath);
  const to = path.resolve(targetDir, fileName);
  copyFileSync(from, to);
  return to;
}

function pruneOldDirs(targetDir, keepCount) {
  if (!existsSync(targetDir)) {
    return { removed: [], kept: [] };
  }

  const dirs = readdirSync(targetDir)
    .map((name) => ({
      name,
      fullPath: path.resolve(targetDir, name),
    }))
    .filter((item) => {
      try {
        return statSync(item.fullPath).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((a, b) => b.name.localeCompare(a.name));

  const kept = dirs.slice(0, keepCount).map((item) => item.name);
  const removed = dirs.slice(keepCount).map((item) => item.name);

  for (const item of dirs.slice(keepCount)) {
    rmSync(item.fullPath, { recursive: true, force: true });
  }

  return { removed, kept };
}

function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const keepHistoryRuns = Number(process.env.CLEANUP_KEEP_HISTORY_RUNS ?? "30");
  const keepArchiveWeeks = Number(process.env.CLEANUP_KEEP_ARCHIVE_WEEKS ?? "8");

  if (!Number.isFinite(keepHistoryRuns) || keepHistoryRuns < 1) {
    throw new Error("CLEANUP_KEEP_HISTORY_RUNS must be >= 1");
  }

  if (!Number.isFinite(keepArchiveWeeks) || keepArchiveWeeks < 1) {
    throw new Error("CLEANUP_KEEP_ARCHIVE_WEEKS must be >= 1");
  }

  const stamp = nowStamp();
  const weekLabel = new Date().toISOString().slice(0, 10);

  ensureDir(logsDir);
  ensureDir(docsDir);

  const archiveRoot = path.resolve(logsDir, "archive", "history");
  ensureDir(archiveRoot);

  const historyResults = [
    cleanupHistoryFile(root, "logs/check-all-history.jsonl", keepHistoryRuns, archiveRoot, stamp),
    cleanupHistoryFile(root, "logs/weekly-kpi-history.jsonl", keepHistoryRuns, archiveRoot, stamp),
  ];

  const snapshotDir = path.resolve(logsDir, "archive", "weekly-snapshots", weekLabel);
  const snapshotItems = [
    "logs/check-all-latest.json",
    "logs/check-all-latest.log",
    "logs/check-all-latest.junit.xml",
    "logs/weekly-kpi-latest.json",
    "logs/weekly-kpi-trends.json",
    "logs/weekly-rollup-latest.json",
    "logs/seo-migration-policy-latest.json",
    "logs/ready-runtime-probes-latest.json",
    "logs/release-go-no-go-latest.json",
    "logs/release-risk-register-latest.json",
    "logs/release-handoff-latest.json",
    "docs/weekly-regression-rollup-latest.md",
    "docs/release-go-no-go-latest.md",
    "docs/release-risk-register-latest.md",
    "docs/release-handoff-latest.md",
  ];

  const copied = [];
  for (const rel of snapshotItems) {
    const out = copyIfExists(root, rel, snapshotDir);
    if (out) {
      copied.push(path.relative(root, out).replaceAll("\\", "/"));
    }
  }

  const snapshotBaseDir = path.resolve(logsDir, "archive", "weekly-snapshots");
  const prune = pruneOldDirs(snapshotBaseDir, keepArchiveWeeks);

  const payload = {
    generatedAt: new Date().toISOString(),
    keepHistoryRuns,
    keepArchiveWeeks,
    historyResults,
    snapshot: {
      weekLabel,
      directory: path.relative(root, snapshotDir).replaceAll("\\", "/"),
      copiedCount: copied.length,
      copied,
      prunedDirectories: prune.removed,
      keptDirectories: prune.kept,
    },
  };

  writeFileSync(path.resolve(logsDir, "cleanup-artifacts-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Artifact Cleanup Rotation",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Keep history runs: ${payload.keepHistoryRuns}`,
    `- Keep archive weeks: ${payload.keepArchiveWeeks}`,
    `- Snapshot directory: ${payload.snapshot.directory}`,
    `- Snapshot files copied: ${payload.snapshot.copiedCount}`,
    `- Archive directories pruned: ${payload.snapshot.prunedDirectories.length}`,
    "",
    "## History rotation",
    "",
    "| File | Before | After | Archived | Trimmed | Archive file |",
    "| --- | ---: | ---: | ---: | --- | --- |",
    ...payload.historyResults.map(
      (item) => `| ${item.file} | ${item.before} | ${item.after} | ${item.archived} | ${item.trimmed} | ${item.archiveFile || "-"} |`
    ),
    "",
    "## Weekly snapshot",
    "",
    ...payload.snapshot.copied.map((item) => `- ${item}`),
    ...(payload.snapshot.copied.length === 0 ? ["- none"] : []),
    "",
    "## Pruned snapshot directories",
    "",
    ...payload.snapshot.prunedDirectories.map((item) => `- ${item}`),
    ...(payload.snapshot.prunedDirectories.length === 0 ? ["- none"] : []),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "cleanup-artifacts-latest.md"), `${markdown}\n`, "utf8");

  const totalArchived = payload.historyResults.reduce((sum, item) => sum + item.archived, 0);
  console.log(
    `cleanup_artifacts: status=OK, archived_history=${totalArchived}, snapshot_copied=${payload.snapshot.copiedCount}, pruned_dirs=${payload.snapshot.prunedDirectories.length}`
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
