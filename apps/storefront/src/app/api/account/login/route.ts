import { scryptSync, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { DEFAULT_ACCOUNT_PROFILE, normalizeAccountProfile } from "@/lib/account-profile";
import { getPriorityAddress, normalizeAccountAddresses } from "@/lib/account-addresses";

const PASSWORD_COOKIE = "imidge_account_pwd_hash";
const PROFILE_COOKIE = "imidge_account_profile";
const ADDRESSES_COOKIE = "imidge_account_addresses";
const DEFAULT_PASSWORD = process.env.ACCOUNT_DEMO_PASSWORD || "imidge123";

type LoginPayload = {
  login?: unknown;
  password?: unknown;
};

function verifyPassword(password: string, encoded: string) {
  const [saltHex, hashHex] = encoded.split(":");
  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expectedHash = Buffer.from(hashHex, "hex");
  const actualHash = scryptSync(password, salt, expectedHash.length);

  if (actualHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expectedHash);
}

function getCookieValue(cookieHeader: string | null, key: string) {
  const cookieEntry = (cookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${key}=`));

  if (!cookieEntry) {
    return null;
  }

  return cookieEntry.split("=").slice(1).join("=");
}

function decodeCookieVariants(raw: string | null) {
  if (!raw) {
    return [] as string[];
  }

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

function normalizeStoredHash(raw: string | null) {
  for (const candidate of decodeCookieVariants(raw)) {
    if (/^[a-f0-9]+:[a-f0-9]+$/i.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function readProfile(cookieHeader: string | null) {
  const rawProfile = getCookieValue(cookieHeader, PROFILE_COOKIE);
  if (!rawProfile) {
    return { ...DEFAULT_ACCOUNT_PROFILE };
  }

  for (const candidate of decodeCookieVariants(rawProfile)) {
    try {
      return normalizeAccountProfile(JSON.parse(candidate));
    } catch {
      continue;
    }
  }

  return { ...DEFAULT_ACCOUNT_PROFILE };
}

function readPriorityAddress(cookieHeader: string | null) {
  const rawAddresses = getCookieValue(cookieHeader, ADDRESSES_COOKIE);
  if (!rawAddresses) {
    return null;
  }

  for (const candidate of decodeCookieVariants(rawAddresses)) {
    try {
      const addresses = normalizeAccountAddresses(JSON.parse(candidate));
      return getPriorityAddress(addresses);
    } catch {
      continue;
    }
  }

  return null;
}

export async function POST(request: Request) {
  let payload: LoginPayload;

  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ message: "Некорректные данные авторизации." }, { status: 400 });
  }

  const login = typeof payload.login === "string" ? payload.login.trim() : "";
  const password = typeof payload.password === "string" ? payload.password.trim() : "";

  if (!login || !password) {
    return NextResponse.json({ message: "Введите логин и пароль." }, { status: 400 });
  }

  const cookieHeader = request.headers.get("cookie");
  const profile = readProfile(cookieHeader);
  const priorityAddress = readPriorityAddress(cookieHeader);

  const normalizedLogin = login.toLowerCase();
  const profileEmail = profile.email.trim().toLowerCase();
  const profilePhoneDigits = profile.phone.replace(/\D/g, "");
  const loginDigits = login.replace(/\D/g, "");

  const loginMatches = normalizedLogin === profileEmail || (loginDigits.length >= 8 && loginDigits === profilePhoneDigits);

  if (!loginMatches) {
    return NextResponse.json({ message: "Пользователь с таким логином не найден." }, { status: 401 });
  }

  const storedHash = normalizeStoredHash(getCookieValue(cookieHeader, PASSWORD_COOKIE));
  const validPassword = storedHash ? verifyPassword(password, storedHash) : password === DEFAULT_PASSWORD;

  if (!validPassword) {
    return NextResponse.json({ message: "Неверный пароль." }, { status: 401 });
  }

  return NextResponse.json({
    message: "Авторизация успешна.",
    profile,
    priorityAddress,
  });
}
