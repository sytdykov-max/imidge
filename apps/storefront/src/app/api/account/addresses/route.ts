import { NextResponse } from "next/server";
import { DEFAULT_ACCOUNT_ADDRESSES, normalizeAccountAddresses } from "@/lib/account-addresses";

const ADDRESSES_COOKIE = "imidge_account_addresses";

function decodeCookieVariants(raw: string) {
  const variants = [raw];

  try {
    variants.push(decodeURIComponent(raw));
  } catch {
    return variants;
  }

  try {
    variants.push(decodeURIComponent(variants[1]));
  } catch {
    return variants;
  }

  return variants;
}

function readAddressesFromCookie(cookieHeader: string | null) {
  const cookieEntry = (cookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${ADDRESSES_COOKIE}=`));

  if (!cookieEntry) {
    return [...DEFAULT_ACCOUNT_ADDRESSES];
  }

  const raw = cookieEntry.split("=").slice(1).join("=");

  for (const variant of decodeCookieVariants(raw)) {
    try {
      return normalizeAccountAddresses(JSON.parse(variant));
    } catch {
      continue;
    }
  }

  return [...DEFAULT_ACCOUNT_ADDRESSES];
}

export async function GET(request: Request) {
  const addresses = readAddressesFromCookie(request.headers.get("cookie"));
  return NextResponse.json({ addresses });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Некорректные данные адресов." }, { status: 400 });
  }

  const addresses = normalizeAccountAddresses(payload);
  const response = NextResponse.json({ addresses, message: "Адреса сохранены." });

  response.cookies.set(ADDRESSES_COOKIE, JSON.stringify(addresses), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
