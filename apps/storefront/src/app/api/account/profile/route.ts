import { NextResponse } from "next/server";
import { DEFAULT_ACCOUNT_PROFILE, normalizeAccountProfile } from "@/lib/account-profile";

const PROFILE_COOKIE = "imidge_account_profile";

function parseProfileFromCookie(cookieHeader: string | null) {
  const cookieEntry = (cookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${PROFILE_COOKIE}=`));

  if (!cookieEntry) {
    return { ...DEFAULT_ACCOUNT_PROFILE };
  }

  const encoded = cookieEntry.split("=").slice(1).join("=");

  const candidates = [encoded];

  try {
    candidates.push(decodeURIComponent(encoded));
  } catch {
    return { ...DEFAULT_ACCOUNT_PROFILE };
  }

  try {
    candidates.push(decodeURIComponent(candidates[1]));
  } catch {
    // ignore
  }

  for (const candidate of candidates) {
    try {
      return normalizeAccountProfile(JSON.parse(candidate));
    } catch {
      continue;
    }
  }

  return { ...DEFAULT_ACCOUNT_PROFILE };
}

export async function GET(request: Request) {
  const profile = parseProfileFromCookie(request.headers.get("cookie"));
  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Некорректные данные профиля." }, { status: 400 });
  }

  const profile = normalizeAccountProfile(payload);
  const response = NextResponse.json({ profile, message: "Профиль сохранён." });

  response.cookies.set(PROFILE_COOKIE, JSON.stringify(profile), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
