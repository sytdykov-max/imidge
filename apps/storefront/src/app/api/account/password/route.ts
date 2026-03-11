import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

type PasswordPayload = {
  oldPassword?: unknown;
  newPassword?: unknown;
};

const PASSWORD_COOKIE = "imidge_account_pwd_hash";
const DEFAULT_PASSWORD = process.env.ACCOUNT_DEMO_PASSWORD || "imidge123";

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

function normalizeStoredHash(raw: string | null) {
  if (!raw) {
    return null;
  }

  for (const variant of decodeCookieVariants(raw)) {
    if (/^[a-f0-9]+:[a-f0-9]+$/i.test(variant)) {
      return variant;
    }
  }

  return null;
}

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

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

export async function POST(request: Request) {
  let payload: PasswordPayload;

  try {
    payload = (await request.json()) as PasswordPayload;
  } catch {
    return NextResponse.json({ message: "Некорректные данные запроса." }, { status: 400 });
  }

  const oldPassword = typeof payload.oldPassword === "string" ? payload.oldPassword.trim() : "";
  const newPassword = typeof payload.newPassword === "string" ? payload.newPassword.trim() : "";

  if (!oldPassword || !newPassword) {
    return NextResponse.json(
      { message: "Для смены пароля заполните поля «Старый пароль» и «Новый пароль»." },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ message: "Новый пароль должен содержать минимум 8 символов." }, { status: 400 });
  }

  if (oldPassword === newPassword) {
    return NextResponse.json({ message: "Новый пароль должен отличаться от старого." }, { status: 400 });
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const cookieEntry = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${PASSWORD_COOKIE}=`));

  const storedHash = normalizeStoredHash(cookieEntry ? cookieEntry.split("=").slice(1).join("=") : null);

  const isValidOldPassword = storedHash
    ? verifyPassword(oldPassword, storedHash)
    : oldPassword === DEFAULT_PASSWORD;

  if (!isValidOldPassword) {
    return NextResponse.json({ message: "Старый пароль указан неверно." }, { status: 400 });
  }

  const nextHash = hashPassword(newPassword);
  const response = NextResponse.json({ message: "Пароль успешно изменён." });

  response.cookies.set(PASSWORD_COOKIE, nextHash, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
