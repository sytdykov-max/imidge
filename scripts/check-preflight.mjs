const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:9000/health";
const storefrontUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";

async function checkUrl(name, url) {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, { cache: "no-store" });
    const elapsedMs = Date.now() - startedAt;
    const ok = response.status === 200;

    console.log(`${name}: status=${response.status}, time=${elapsedMs}ms, url=${url}`);
    return ok;
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`${name}: status=DOWN, time=${elapsedMs}ms, url=${url}, error=${message}`);
    return false;
  }
}

async function main() {
  console.log(`Preflight check (${new Date().toISOString()})`);

  const [backendOk, storefrontOk] = await Promise.all([
    checkUrl("backend_health", backendUrl),
    checkUrl("storefront_home", storefrontUrl),
  ]);

  if (!backendOk || !storefrontOk) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
