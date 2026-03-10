import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const logsDir = path.resolve(root, "logs");
mkdirSync(logsDir, { recursive: true });

const event = {
  at: new Date().toISOString(),
  scope: process.env.INCIDENT_SCOPE ?? "unknown",
  severity: process.env.INCIDENT_SEVERITY ?? "info",
  message: process.env.INCIDENT_MESSAGE ?? "manual incident log entry",
  correlationId: process.env.INCIDENT_CORRELATION_ID ?? `cid-${Date.now()}`,
};

appendFileSync(path.resolve(logsDir, "incident-events.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
console.log(`incident_log: status=OK, scope=${event.scope}, severity=${event.severity}`);
