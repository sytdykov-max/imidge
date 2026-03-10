import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

async function sendSlack(webhookUrl, text) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed with status ${response.status}`);
  }
}

function safeReadJson(filePath) {
  if (!existsSync(filePath)) return null;

  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function sendTelegram(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed with status ${response.status}`);
  }
}

async function main() {
  const status = process.env.ALERT_STATUS ?? "unknown";
  const scope = process.env.ALERT_SCOPE ?? "quality-gate";
  const runUrl = process.env.ALERT_RUN_URL ?? "n/a";
  const includeFacetSummary = String(process.env.ALERT_INCLUDE_FACET_SUMMARY ?? "true").toLowerCase() === "true";

  let message = process.env.ALERT_MESSAGE ?? `Imidge ${scope}: ${status}\n${runUrl}`;

  if (includeFacetSummary) {
    const root = process.cwd();
    const facetCoverage = safeReadJson(path.resolve(root, "logs/facet-coverage-latest.json"));
    const topProblematicCategories = Array.isArray(facetCoverage?.degradation?.topProblematicCategories)
      ? facetCoverage.degradation.topProblematicCategories
      : [];

    if (topProblematicCategories.length > 0) {
      const lines = topProblematicCategories.map(
        (item, index) =>
          `${index + 1}) ${item.label} — products:${item.products}, brand:${item.brandCoveragePct}%, facets:${item.requiredFacetCoveragePct}%`
      );

      message = `${message}\n\nTop-3 problematic categories:\n${lines.join("\n")}`;
    }
  }

  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;

  if (!slackWebhook && !(tgToken && tgChatId)) {
    console.log("quality_alert: skipped (no integration configured)");
    return;
  }

  const tasks = [];
  if (slackWebhook) {
    tasks.push(sendSlack(slackWebhook, message));
  }

  if (tgToken && tgChatId) {
    tasks.push(sendTelegram(tgToken, tgChatId, message));
  }

  await Promise.all(tasks);
  console.log(`quality_alert: sent, scope=${scope}, status=${status}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
