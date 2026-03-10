import { NextResponse } from "next/server";
import { callNovaPoshta, hasNovaPoshtaApiKey, type NovaPoshtaArea } from "@/lib/novaposhta";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasNovaPoshtaApiKey()) {
    return NextResponse.json({ error: "Nova Poshta API key is not configured" }, { status: 503 });
  }

  try {
    const areas = await callNovaPoshta<NovaPoshtaArea>({
      modelName: "Address",
      calledMethod: "getAreas",
    });

    return NextResponse.json({
      areas: areas
        .filter((area) => area.Ref && area.Description)
        .map((area) => ({ ref: area.Ref, name: area.Description })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Nova Poshta areas" },
      { status: 502 }
    );
  }
}