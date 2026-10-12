/**
 * Uzbek Latin → Cyrillic transliteration (official 1995 alphabet mapping).
 * Used to generate the `oz` locale from `uz` messages and to show DB content in Cyrillic.
 * Protected fragments (placeholders, URLs, brand/tech acronyms) are left untouched.
 */

const PROTECT =
  /\{[^}]+\}|https?:\/\/\S+|[\w.-]+@[\w.-]+|\b[\w-]+\.(?:uz|com|ru|org|net)\b|\+?\d[\d\s-]{6,}\d|\b(?:EKA BUILD|EKA|BUILD|E-IMZO|PDF|GLB|GLTF|DWG|DXF|IFC|ZIP|QR|SMS|API|OTP|ID|Click|Payme|Uzum|Telegram|WebGL|3D|2D|PKCS#7|SHA-256|UZS|USD)\b/g;

const APOS = "['‘’ʻʼ`]";
const MULTI: [RegExp, string][] = [
  [new RegExp(`O${APOS}`, "g"), "Ў"],
  [new RegExp(`o${APOS}`, "g"), "ў"],
  [new RegExp(`G${APOS}`, "g"), "Ғ"],
  [new RegExp(`g${APOS}`, "g"), "ғ"],
  [/SH/g, "Ш"], [/Sh/g, "Ш"], [/sh/g, "ш"],
  [/CH/g, "Ч"], [/Ch/g, "Ч"], [/ch/g, "ч"],
  [/YO/g, "Ё"], [/Yo/g, "Ё"], [/yo/g, "ё"],
  [/YU/g, "Ю"], [/Yu/g, "Ю"], [/yu/g, "ю"],
  [/YA/g, "Я"], [/Ya/g, "Я"], [/ya/g, "я"],
  // consonant + "ye" (obyekt, subyekt) → ъе
  [/(?<=[bdfgklmnpqrstvxzBDFGKLMNPQRSTVXZ])ye/g, "ъе"],
  [/YE/g, "Е"], [/Ye/g, "Е"], [/ye/g, "е"],
];

const SINGLE: Record<string, string> = {
  a: "а", b: "б", d: "д", e: "е", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м",
  n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з", c: "с", w: "в",
};

function translitPlain(input: string): string {
  // word-initial "e" → "э"
  let s = input.replace(/(^|[^\p{L}'‘’ʻʼ`])([Ee])/gu, (_, pre: string, e: string) => pre + (e === "E" ? "Э" : "э"));
  for (const [re, rep] of MULTI) s = s.replace(re, rep);
  // remaining apostrophe between letters = tutuq belgisi → ъ
  s = s.replace(new RegExp(`(?<=\\p{L})${APOS}(?=\\p{L})`, "gu"), "ъ");
  let out = "";
  for (const ch of s) {
    const lower = ch.toLowerCase();
    const mapped = SINGLE[lower];
    if (!mapped) out += ch;
    else out += ch === lower ? mapped : mapped.toUpperCase();
  }
  return out;
}

export function latinToCyrillic(text: string): string {
  if (!text) return text;
  let result = "";
  let last = 0;
  for (const m of text.matchAll(PROTECT)) {
    result += translitPlain(text.slice(last, m.index)) + m[0];
    last = (m.index ?? 0) + m[0].length;
  }
  return result + translitPlain(text.slice(last));
}

/** Deep-transliterate every string in a messages object */
export function translitDeep<T>(obj: T): T {
  if (typeof obj === "string") return latinToCyrillic(obj) as T;
  if (Array.isArray(obj)) return obj.map(translitDeep) as T;
  if (obj && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, translitDeep(v)])) as T;
  }
  return obj;
}
