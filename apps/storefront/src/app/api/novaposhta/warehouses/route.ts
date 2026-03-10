import { NextRequest, NextResponse } from "next/server";
import { callNovaPoshta, hasNovaPoshtaApiKey, type NovaPoshtaWarehouse } from "@/lib/novaposhta";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasNovaPoshtaApiKey()) {
    return NextResponse.json({ error: "Nova Poshta API key is not configured" }, { status: 503 });
  }

  const cityRef = request.nextUrl.searchParams.get("cityRef")?.trim() ?? "";
  if (!cityRef) {
    return NextResponse.json({ error: "cityRef is required" }, { status: 400 });
  }

  try {
    const warehouses = await callNovaPoshta<NovaPoshtaWarehouse>({
      modelName: "Address",
      calledMethod: "getWarehouses",
      methodProperties: {
        CityRef: cityRef,
      },
    });

    return NextResponse.json({
      warehouses: warehouses
        .filter((warehouse) => warehouse.Ref && warehouse.Description)
        .map((warehouse) => ({ ref: warehouse.Ref, name: warehouse.Description })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Nova Poshta warehouses" },
      { status: 502 }
    );
  }
}