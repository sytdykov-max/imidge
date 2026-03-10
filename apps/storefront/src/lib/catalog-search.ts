export type QuerySearchItem = {
  title: string;
  handle: string;
  brand: string;
  category: string;
};

const RU_TO_EN_LAYOUT: Record<string, string> = {
  й: "q", ц: "w", у: "e", к: "r", е: "t", н: "y", г: "u", ш: "i", щ: "o", з: "p", х: "[", ъ: "]",
  ф: "a", ы: "s", в: "d", а: "f", п: "g", р: "h", о: "j", л: "k", д: "l", ж: ";", э: "'",
  я: "z", ч: "x", с: "c", м: "v", и: "b", т: "n", ь: "m", б: ",", ю: ".",
};

const EN_TO_RU_LAYOUT: Record<string, string> = Object.fromEntries(
  Object.entries(RU_TO_EN_LAYOUT).map(([ru, en]) => [en, ru])
);

const RU_TO_EN_TRANSLIT_PAIRS: Array<[string, string]> = [
  ["щ", "shch"], ["ш", "sh"], ["ч", "ch"], ["ж", "zh"], ["ю", "yu"], ["я", "ya"], ["ё", "yo"],
  ["ц", "ts"], ["х", "kh"], ["э", "e"], ["ъ", ""], ["ь", ""], ["ы", "y"], ["а", "a"], ["б", "b"],
  ["в", "v"], ["г", "g"], ["д", "d"], ["е", "e"], ["з", "z"], ["и", "i"], ["й", "y"], ["к", "k"],
  ["л", "l"], ["м", "m"], ["н", "n"], ["о", "o"], ["п", "p"], ["р", "r"], ["с", "s"], ["т", "t"],
  ["у", "u"], ["ф", "f"],
];

const EN_TO_RU_TRANSLIT_PAIRS: Array<[string, string]> = [
  ["shch", "щ"], ["sch", "щ"], ["sh", "ш"], ["ch", "ч"], ["zh", "ж"], ["yu", "ю"], ["ya", "я"],
  ["yo", "ё"], ["ts", "ц"], ["kh", "х"], ["a", "а"], ["b", "б"], ["v", "в"], ["g", "г"], ["d", "д"],
  ["e", "е"], ["z", "з"], ["i", "и"], ["y", "й"], ["k", "к"], ["l", "л"], ["m", "м"], ["n", "н"],
  ["o", "о"], ["p", "п"], ["r", "р"], ["s", "с"], ["t", "т"], ["u", "у"], ["f", "ф"], ["h", "х"],
  ["c", "к"], ["j", "дж"], ["w", "в"], ["q", "кс"], ["x", "кс"],
];

export function normalizeQueryText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["'`’]/g, "")
    .replace(/[\s_\-/]+/g, " ")
    .trim();
}

function splitTokens(value: string) {
  return normalizeQueryText(value)
    .split(" ")
    .filter(Boolean)
    .slice(0, 8);
}

function switchKeyboardLayout(token: string, direction: "ru-to-en" | "en-to-ru") {
  const table = direction === "ru-to-en" ? RU_TO_EN_LAYOUT : EN_TO_RU_LAYOUT;
  return token
    .split("")
    .map((char) => table[char] ?? char)
    .join("");
}

function translitRuToEn(token: string) {
  return RU_TO_EN_TRANSLIT_PAIRS.reduce((result, [ru, en]) => result.split(ru).join(en), token);
}

function translitEnToRu(token: string) {
  let result = token;
  for (const [en, ru] of EN_TO_RU_TRANSLIT_PAIRS) {
    result = result.split(en).join(ru);
  }
  return result;
}

function tokenVariants(token: string) {
  const variants = new Set<string>([token]);
  const keyboardRuToEn = switchKeyboardLayout(token, "ru-to-en");
  const keyboardEnToRu = switchKeyboardLayout(token, "en-to-ru");
  const translitToEn = translitRuToEn(token);
  const translitToRu = translitEnToRu(token);

  variants.add(keyboardRuToEn);
  variants.add(keyboardEnToRu);
  variants.add(translitToEn);
  variants.add(translitToRu);

  const latinAliases = [token, keyboardRuToEn, translitToEn];
  for (const item of latinAliases) {
    variants.add(item.replace(/v/g, "w"));
    variants.add(item.replace(/w/g, "v"));
    variants.add(item.replace(/x/g, "h"));
  }

  const cyrillicAliases = [token, keyboardEnToRu, translitToRu];
  for (const item of cyrillicAliases) {
    variants.add(item.replace(/кс/g, "х"));
    variants.add(item.replace(/икс/g, "х"));
  }

  return Array.from(variants)
    .map((item) => normalizeQueryText(item))
    .filter((item) => item.length >= 2)
    .slice(0, 12);
}

function getTokenScore(haystack: { title: string; handle: string; brand: string; category: string }, token: string) {
  if (!token) {
    return 0;
  }

  let best = 0;

  const fields = [
    { value: haystack.brand, exact: 240, starts: 170, includes: 130 },
    { value: haystack.title, exact: 220, starts: 160, includes: 120 },
    { value: haystack.handle, exact: 120, starts: 90, includes: 70 },
    { value: haystack.category, exact: 90, starts: 70, includes: 50 },
  ];

  for (const field of fields) {
    if (field.value === token) {
      best = Math.max(best, field.exact);
      continue;
    }

    if (field.value.startsWith(token)) {
      best = Math.max(best, field.starts);
      continue;
    }

    if (field.value.includes(token)) {
      best = Math.max(best, field.includes);
    }
  }

  return best;
}

export function getQueryRelevanceScore(item: QuerySearchItem, query: string) {
  const tokens = splitTokens(query);
  if (tokens.length === 0) {
    return 0;
  }

  const haystack = {
    title: normalizeQueryText(item.title),
    handle: normalizeQueryText(item.handle),
    brand: normalizeQueryText(item.brand),
    category: normalizeQueryText(item.category),
  };

  let score = 0;
  let matchedTokens = 0;

  for (const token of tokens) {
    const variants = tokenVariants(token);
    let bestTokenScore = 0;
    for (const variant of variants) {
      bestTokenScore = Math.max(bestTokenScore, getTokenScore(haystack, variant));
    }

    if (bestTokenScore > 0) {
      matchedTokens += 1;
      score += bestTokenScore;
    }
  }

  if (matchedTokens === tokens.length) {
    score += 180;
  } else if (matchedTokens > 0) {
    score += matchedTokens * 40;
  }

  const normalizedQuery = normalizeQueryText(query);
  if (normalizedQuery && haystack.title.includes(normalizedQuery)) {
    score += 40;
  }

  return score;
}

export function matchesQuery(item: QuerySearchItem, query: string) {
  return getQueryRelevanceScore(item, query) > 0;
}

export function rankProductsByQuery<T extends QuerySearchItem>(items: T[], query: string) {
  const ranked = [...items];
  ranked.sort((a, b) => {
    const scoreDiff = getQueryRelevanceScore(b, query) - getQueryRelevanceScore(a, query);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return a.title.localeCompare(b.title, "ru");
  });

  return ranked;
}
