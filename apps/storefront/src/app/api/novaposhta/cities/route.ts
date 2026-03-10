import { NextRequest, NextResponse } from "next/server";
import { callNovaPoshta, hasNovaPoshtaApiKey, type NovaPoshtaCity } from "@/lib/novaposhta";

export const dynamic = "force-dynamic";
const CITIES_PAGE_LIMIT = 150;
const MAX_CITIES_PAGES = 40;

export async function GET(request: NextRequest) {
  if (!hasNovaPoshtaApiKey()) {
    return NextResponse.json({ error: "Nova Poshta API key is not configured" }, { status: 503 });
  }

  const areaRef = request.nextUrl.searchParams.get("areaRef")?.trim() ?? "";
  if (!areaRef) {
    return NextResponse.json({ error: "areaRef is required" }, { status: 400 });
  }

  try {
    const cityMap = new Map<string, { ref: string; name: string }>();

    for (let page = 1; page <= MAX_CITIES_PAGES; page += 1) {
      const cities = await callNovaPoshta<NovaPoshtaCity>({
        modelName: "Address",
        calledMethod: "getCities",
        methodProperties: {
          AreaRef: areaRef,
          Limit: String(CITIES_PAGE_LIMIT),
          Page: String(page),
        },
      });

      const normalized = cities
        .filter((city) => city.Ref && city.Description)
        .map((city) => ({ ref: city.Ref, name: city.Description }));

      for (const city of normalized) {
        cityMap.set(city.ref, city);
      }

      if (cities.length < CITIES_PAGE_LIMIT) {
        break;
      }
    }

    return NextResponse.json({
      cities: Array.from(cityMap.values()),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Nova Poshta cities" },
      { status: 502 }
    );
  }
}