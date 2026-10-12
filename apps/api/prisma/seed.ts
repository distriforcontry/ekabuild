/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { PrismaClient, type Prisma, type SignerRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildingRender, facadeDrawing, floorPlan, rng, simplePdf } from "./seed-assets";
import { storage, newKey } from "../src/lib/storage";
import { certificateCode, docNumber } from "../src/lib/codes";
import { contractContext, renderTemplate, signingPayload } from "../src/lib/contracts";
import { recalculateTrust } from "../src/lib/trust";
import { audit } from "../src/lib/audit";
import { cadastreProvider, evaluateCadastre } from "../src/lib/cadastre";
import { sha256 } from "../src/lib/auth";
import { closeBus } from "../src/lib/bus";
import { buildSchedule, type PlanInput, type ScheduleRow } from "../src/lib/finance";

/**
 * Payment rows for a seeded deal. Instalments already due are paid (a few days early / late, as in real life),
 * except `missLast` most recent ones which stay unpaid → OVERDUE (or PENDING within the 1-day grace).
 */
async function seedPayments(purchaseId: string, rows: ScheduleRow[], opts: { paid: boolean; firstPaidAt?: Date; missLast?: number; r: () => number }) {
  const now = Date.now();
  const due = rows.filter((x) => x.dueDate.getTime() <= now);
  const missFrom = opts.missLast ? Math.max(1, due.length - opts.missLast) : Infinity;
  let allPaid = true;
  for (const row of rows) {
    const isDue = row.dueDate.getTime() <= now;
    let status: "PENDING" | "PAID" | "OVERDUE" = "PENDING";
    let paidAt: Date | null = null;
    if (opts.paid && (row.seq === 0 || (isDue && row.seq < missFrom))) {
      status = "PAID";
      paidAt = row.seq === 0 && opts.firstPaidAt ? opts.firstPaidAt : new Date(row.dueDate.getTime() - Math.floor(opts.r() * 5 - 1) * 86400_000);
      if (paidAt.getTime() > now) paidAt = new Date(now - 3600_000);
    } else if (opts.paid && isDue && row.dueDate.getTime() < now - 86400_000) status = "OVERDUE";
    if (status !== "PAID") allPaid = false;
    await prisma.payment.create({
      data: {
        purchaseId,
        seq: row.seq,
        dueDate: row.dueDate,
        amount: row.amount,
        status,
        paidAt,
        method: paidAt ? (["click", "payme", "bank", "uzum"] as const)[Math.floor(opts.r() * 4)] : null,
        reference: paidAt ? `TX${Math.floor(opts.r() * 1e10).toString(36).toUpperCase()}` : null,
      },
    });
  }
  return { allPaid };
}

/**
 * Seed:
 *  - always: contract templates, rules, superadmin
 *  - SEED_DEMO=true and empty DB: demo organisations, users, projects, documents, deals…
 * Idempotent — safe to run on every deploy (the migrate service does).
 */
const prisma = new PrismaClient();
// works both from source (prisma/seed.ts) and from the bundle (dist/seed.js) — assets ship next to the schema
const ASSETS_DIR = [path.join(path.dirname(fileURLToPath(import.meta.url)), "assets"), path.resolve(process.cwd(), "prisma/assets")].find((p) => fs.existsSync(p)) ?? "prisma/assets";
const DEMO_PASSWORD = "Eka12345!";

async function saveFile(buf: Buffer, name: string, mime: string, uploadedById?: string) {
  const ext = name.split(".").pop()!;
  const stored = await storage.save(Readable.from(buf), newKey(ext), mime);
  return prisma.fileObject.create({ data: { storageKey: stored.key, originalName: name, mime, size: stored.size, sha256: stored.sha256, uploadedById } });
}

// ───────────────────────────── templates ─────────────────────────────

const UNIT_TEMPLATE = `# KO'CHMAS MULK OLDI-SOTDI (ULUSHLI QURILISH) SHARTNOMASI

**№ {{contract.number}}** · {{contract.date}}

**Sotuvchi:** {{seller.name}} (STIR {{seller.tin}}), direktor {{seller.director}}, manzil: {{seller.address}} — keyingi o'rinlarda "Quruvchi".

**Xaridor:** {{buyer.fullName}}, JShShIR {{buyer.pinfl}}, tel. {{buyer.phone}} {{buyerOrg.name}} — keyingi o'rinlarda "Xaridor".

## 1. Shartnoma predmeti

1.1. Quruvchi **{{project.name}}** turar-joy majmuasida (manzil: {{project.address}}, kadastr raqami: {{project.cadastreNumber}}) joylashgan quyidagi xonadonni Xaridorga topshirish majburiyatini oladi:

| Ko'rsatkich | Qiymat |
|---|---|
| Xonadon raqami | {{unit.number}} |
| Qavat | {{unit.floor}} |
| Xonalar soni | {{unit.rooms}} |
| Umumiy maydon | {{unit.area}} m² |

## 2. Narx va to'lov tartibi

2.1. Shartnoma bahosi: **{{amount}}** ({{amountWords}}). Narx shartnoma amal qilish davomida o'zgarmaydi.

2.2. To'lov tartibi: {{payment.plan}}. To'lov jadvali (1-ilova) shartnomaning ajralmas qismi hisoblanadi:

{{payment.table}}

2.3. To'lovlar EKA BUILD platformasi orqali, shartnoma ikki tomonlama E-IMZO bilan imzolangandan so'ng amalga oshiriladi. Har bir to'lov platformada qayd etiladi va Xaridorga SMS orqali tasdiqlanadi.

2.4. To'lov muddati o'tib ketganda Xaridorga eslatma yuboriladi; 30 (o'ttiz) kundan ortiq kechikish Quruvchiga shartnomani bir tomonlama bekor qilish huquqini beradi, bunda to'langan summa 10 (o'n) bank kuni ichida qaytariladi.

## 3. Tomonlarning majburiyatlari

3.1. Quruvchi obyektni amaldagi shaharsozlik normalari va qoidalariga, tasdiqlangan loyiha hujjatlariga muvofiq qurishi va belgilangan muddatda foydalanishga topshirishi shart.

3.2. Quruvchi ushbu xonadonni uchinchi shaxslarga qayta sotmaslik majburiyatini oladi. Platforma xonadonni bitim davomida avtomatik bloklaydi.

3.3. Xaridor to'lovni o'z vaqtida amalga oshirishi va xonadonni qabul qilish dalolatnomasini imzolashi shart.

## 4. Kafolatlar va shaffoflik

4.1. Qurilish ruxsatnomasi, ekspertiza xulosasi va kadastr ma'lumotlari EKA BUILD platformasida ochiq tekshiriladi.

4.2. Qurilish jarayoni va topshirilgandan keyingi ishlar haqidagi ma'lumotlar Xaridorga platforma orqali muntazam taqdim etiladi.

## 5. Nizolarni hal qilish

5.1. Nizolar muzokaralar yo'li bilan, kelishilmagan taqdirda O'zbekiston Respublikasi qonunchiligiga muvofiq sud tartibida hal qilinadi.

## 6. Yakuniy qoidalar

6.1. Shartnoma tomonlar elektron raqamli imzosi (E-IMZO) bilan imzolangan paytdan kuchga kiradi va qog'oz shakldagi shartnoma bilan teng yuridik kuchga ega.

6.2. Shartnoma matnining SHA-256 xeshi platformada saqlanadi; matndagi har qanday o'zgarish imzolarni haqiqiy emas qiladi.
`;

const PACKAGE_TEMPLATE = `# LOYIHA HUJJATLARI PAKETINI TAQDIM ETISH SHARTNOMASI

**№ {{contract.number}}** · {{contract.date}}

**Ijrochi:** {{seller.name}} (STIR {{seller.tin}}).

**Buyurtmachi:** {{buyerOrg.name}} (STIR {{buyerOrg.tin}}), vakil: {{buyer.fullName}}.

## 1. Predmet

1.1. Ijrochi **{{project.name}}** obyekti (manzil: {{project.address}}) bo'yicha quyidagi hujjatlarga elektron kirish huquqini beradi: arxitektura va konstruktiv chizmalar, qavat rejalari, 3D model, ekspertiza xulosalari va texnik shartlar.

## 2. Narx

2.1. Xizmat narxi: **{{amount}}** ({{amountWords}}).

## 3. Foydalanish shartlari

3.1. Hujjatlar faqat Buyurtmachining ichki ehtiyojlari (baholash, kreditlash, loyihalash) uchun foydalaniladi va uchinchi shaxslarga tarqatilmaydi.

3.2. Har bir faylning SHA-256 xeshi platformada qayd etilgan — hujjatning asl nusxa ekanini istalgan vaqtda tekshirish mumkin.

## 4. Yakuniy qoidalar

4.1. Shartnoma tomonlarning E-IMZO imzolari bilan kuchga kiradi.
`;


const RESERVATION_TEMPLATE = `# XONADONNI BAND QILISH (BRON) TO'G'RISIDA KELISHUV

**{{contract.number}}-sonli shartnomaga ilova** · {{contract.date}}

**Quruvchi:** {{seller.name}} (STIR {{seller.tin}}). **Xaridor:** {{buyer.fullName}} {{buyerOrg.name}}, tel. {{buyer.phone}}.

## 1. Band qilinadigan xonadon

| Ko'rsatkich | Qiymat |
|---|---|
| Obyekt | {{project.name}} |
| Manzil | {{project.address}} |
| Xonadon | № {{unit.number}}, {{unit.floor}}-qavat, {{unit.section}}-blok |
| Xonalar / maydon | {{unit.rooms}} xona · {{unit.area}} m² |
| Narx | {{amount}} |

## 2. Band qilish muddati

2.1. Xonadon **{{reservation.until}}** gacha Xaridor uchun band qilinadi. Bu muddat davomida xonadon boshqa xaridorlarga taklif etilmaydi — platforma uni ma'lumotlar bazasi darajasida bloklaydi.

2.2. Muddat ichida shartnoma ikki tomonlama imzolanmasa va boshlang'ich to'lov amalga oshirilmasa, bron avtomatik bekor qilinadi va xonadon sotuvga qaytariladi.

## 3. Boshqa shartlar

3.1. Band qilish uchun to'lov olinmaydi. Kelishuv EKA BUILD platformasida elektron shaklda tuzilgan.
`;

const PAYMENT_SCHEDULE_TEMPLATE = `# TO'LOV JADVALI

**{{contract.number}}-sonli oldi-sotdi shartnomasiga 1-ilova** · {{contract.date}}

**Obyekt:** {{project.name}}, xonadon № {{unit.number}} ({{unit.area}} m²). **Xaridor:** {{buyer.fullName}} {{buyerOrg.name}}.

## 1. Umumiy shartlar

| Ko'rsatkich | Qiymat |
|---|---|
| Shartnoma bahosi | {{amount}} |
| To'lov tartibi | {{payment.plan}} |
| Boshlang'ich to'lov | {{payment.down}} |
| Oylik to'lov | {{payment.monthly}} |
| To'lovlar soni | {{payment.count}} |
| Oxirgi to'lov sanasi | {{payment.lastDate}} |

## 2. Jadval

{{payment.table}}

## 3. Izohlar

3.1. To'lov muddatidan oldin to'lash mumkin — qolgan qism shunga mos ravishda kamayadi, jarima qo'llanilmaydi.

3.2. Har bir to'lov platformada qayd etiladi; to'lov tarixi Xaridorning shaxsiy kabinetida doimiy ko'rinadi.
`;

const ACCEPTANCE_TEMPLATE = `# XONADONNI QABUL QILISH-TOPSHIRISH DALOLATNOMASI

**{{contract.number}}-sonli shartnoma asosida** · {{contract.date}}

Biz, quyida imzo chekuvchilar, **{{seller.name}}** (Quruvchi, direktor {{seller.director}}) va **{{buyer.fullName}}** {{buyerOrg.name}} (Xaridor), ushbu dalolatnomani tuzdik:

## 1. Topshirilayotgan obyekt

| Ko'rsatkich | Qiymat |
|---|---|
| Obyekt | {{project.name}} |
| Manzil / kadastr | {{project.address}} · {{project.cadastreNumber}} |
| Xonadon | № {{unit.number}}, {{unit.floor}}-qavat |
| Xonalar / maydon | {{unit.rooms}} xona · {{unit.area}} m² |

## 2. Holat

2.1. Xonadon loyiha hujjatlariga muvofiq qurilgan, muhandislik tarmoqlari (elektr, suv, kanalizatsiya, gaz, isitish) ulangan va sinovdan o'tgan.

2.2. Hisoblagichlar ko'rsatkichlari: elektr ______ kVt·soat, suv ______ m³, gaz ______ m³.

2.3. Aniqlangan kamchiliklar: ______. Quruvchi ularni 30 kun ichida bartaraf etish majburiyatini oladi.

## 3. Kafolat

3.1. Konstruktiv elementlarga kafolat muddati — 5 yil, muhandislik tizimlariga — 2 yil. Kafolat davridagi murojaatlar EKA BUILD platformasi orqali qabul qilinadi va kuzatib boriladi.

3.2. Tomonlar bir-biriga moliyaviy da'volari yo'qligini tasdiqlaydi.
`;

const RULES: { slug: string; title: string; category: string; code?: string; summary: string; body: string; order: number }[] = [
  {
    slug: "ruxsatnomani-tekshirish",
    title: "Qurilish ruxsatnomasini qanday tekshirish kerak",
    category: "Xaridorlar uchun",
    summary: "Ruxsatnomasiz qurilayotgan obyektga pul to'lamang — 3 daqiqada tekshiring.",
    order: 1,
    body: `## Nima uchun muhim

Ruxsatnomasiz qurilgan bino foydalanishga qabul qilinmasligi, buzib tashlanishi yoki mulk huquqini rasmiylashtirib bo'lmasligi mumkin.

## Tekshirish bosqichlari

1. Obyekt sahifasida **"Hujjatlar va sertifikatlar"** bo'limini oching.
2. Ruxsatnoma holati **"Haqiqiy"** ekanini va amal qilish muddati tugamaganini tekshiring.
3. Har bir sertifikatning **ochiq tekshiruv kodi** (EKA-XXXX-XXXX) bor — uni *Tekshirish* sahifasiga kiriting yoki QR kodni skanerlang.
4. Quruvchi bergan PDF nusxani **"Fayl bo'yicha tekshirish"** orqali yuklang: fayl xeshi reyestrdagiga mos kelsa — hujjat o'zgartirilmagan.

> Maslahat: ruxsatnomadagi manzil va kadastr raqami obyekt kartochkasidagi ma'lumotlarga mos kelishi shart.`,
  },
  {
    slug: "ikki-marta-sotish",
    title: "Bitta xonadonni ikki marta sotishdan himoya",
    category: "Xaridorlar uchun",
    summary: "Platforma bitim davomida xonadonni bloklaydi va buni ma'lumotlar bazasi darajasida kafolatlaydi.",
    order: 2,
    body: `## Muammo

Firibgarlikning eng keng tarqalgan turi — bitta xonadonni bir necha xaridorga sotish.

## EKA BUILD qanday himoya qiladi

- Xarid boshlanishi bilan xonadon **"Band qilingan"** holatiga o'tadi va boshqa xaridor uni tanlay olmaydi.
- Bloklash ma'lumotlar bazasidagi **noyob cheklov** bilan kafolatlanadi — dasturiy xato bo'lsa ham ikkinchi bitim yaratilmaydi.
- Barcha amallar **o'zgartirib bo'lmaydigan audit jurnaliga** (xesh-zanjir) yoziladi.

Agar sizga platformadan tashqarida "arzonroq" taklif qilinsa — **Shikoyat** tugmasi orqali xabar bering.`,
  },
  {
    slug: "kadastr-nima",
    title: "Kadastr ko'chirmasi va yer uchastkasi",
    category: "Xaridorlar uchun",
    summary: "Kadastr raqami, yer maydoni va huquq egasi nimani anglatadi.",
    order: 3,
    body: `## Kadastr raqami

Yer uchastkasining davlat reyestridagi noyob identifikatori. Format: \`10:05:03:02:01:0123\`.

## Platforma nimani solishtiradi

| Tekshiruv | Mazmuni |
|---|---|
| Koordinatalar | E'lon qilingan joylashuv reyestrdagi uchastka bilan mosligi |
| Maydon | Loyiha hujjatidagi yer maydoni reyestrdagiga mosligi |
| Huquq egasi | Yer quruvchiga ajratilganligi |

Natija **To'liq mos / Qisman mos / Mos emas** ko'rinishida ko'rsatiladi va ishonch baliga ta'sir qiladi.`,
  },
  {
    slug: "e-imzo-bilan-imzolash",
    title: "Shartnomani E-IMZO bilan imzolash",
    category: "Xaridorlar uchun",
    summary: "Elektron raqamli imzo qog'oz imzo bilan teng yuridik kuchga ega.",
    order: 4,
    body: `## Kerakli narsalar

- Kompyuteringizda o'rnatilgan **E-IMZO** dasturi;
- Amaldagi ERI kaliti (jismoniy shaxs yoki tashkilot).

## Jarayon

1. *Shartnomalar* bo'limida shartnomani oching va matnini o'qing.
2. **"E-IMZO bilan imzolash"** tugmasini bosing, kalitingizni tanlang va parolni kiriting.
3. Imzo server tomonida tekshiriladi: sertifikat egasi, amal qilish muddati va imzolangan matn xeshi.

Shartnoma matni imzolangandan keyin o'zgartirilsa, platforma buni darhol aniqlaydi.`,
  },
  {
    slug: "quruvchi-uchun-talablar",
    title: "Quruvchilar uchun platformaga qo'yiladigan talablar",
    category: "Quruvchilar uchun",
    summary: "Obyekt e'lon qilinishi uchun qaysi hujjatlar kerak.",
    order: 1,
    body: `## Majburiy hujjatlar

1. Tashkilot ma'lumotlari (STIR, litsenziya, direktor) — admin tomonidan tasdiqlanadi;
2. Qurilish ruxsatnomasi;
3. Loyiha-smeta hujjatlariga davlat ekspertizasi xulosasi;
4. Yer ajratish to'g'risidagi qaror va kadastr ko'chirmasi;
5. Arxitektura chizmalari va qavat rejalari (xaridorlar uchun yopiq bo'lishi mumkin).

## Tavsiya etiladi

- 3D model (GLB) — xaridorlar ishonchini sezilarli oshiradi;
- Har oy qurilish jarayoni haqida fotohisobot;
- Topshirilgandan keyingi xizmat ko'rsatish yangiliklari.`,
  },
  {
    slug: "ishonch-bali",
    title: "Ishonch bali qanday hisoblanadi",
    category: "Platforma qoidalari",
    summary: "0–100 ball: har bir omil ochiq ko'rsatiladi.",
    order: 1,
    body: `| Omil | Maksimal ball |
|---|---|
| Quruvchi tasdiqlangan | 15 |
| Qurilish ruxsatnomasi (amaldagi) | 20 |
| Davlat ekspertizasi | 10 |
| Boshqa sertifikatlar | 10 |
| Kadastr mosligi | 15 |
| Nazorat tekshiruvlari | 15 |
| Tasdiqlangan hujjatlar | 5 |
| Muddatga rioya | 10 |
| Shikoyatlar | −15 gacha |

Ball har bir hodisadan so'ng (yangi sertifikat, tekshiruv, shikoyat) avtomatik qayta hisoblanadi.`,
  },
  {
    slug: "shikoyat-berish",
    title: "Firibgarlik haqida qanday xabar berish mumkin",
    category: "Platforma qoidalari",
    summary: "Har bir shikoyat ko'rib chiqiladi va ishonch baliga ta'sir qiladi.",
    order: 2,
    body: `Obyekt sahifasidagi **"Shikoyat"** tugmasi yoki +998 33 668 55 55 raqami orqali murojaat qiling.

Shikoyat turlari: firibgarlik, soxta hujjat, muddat buzilishi, sifat muammosi, ikki marta sotish.

Tasdiqlangan og'ir shikoyatlar obyektning ishonch balini pasaytiradi va quruvchiga bildirishnoma yuboriladi.`,
  },
  {
    slug: "qurilish-normalari",
    title: "Asosiy shaharsozlik normalari haqida",
    category: "Normativ hujjatlar",
    summary: "Turar-joy binolarini loyihalash va qurishdagi asosiy talablar (umumiy ma'lumot).",
    order: 1,
    body: `Turar-joy binolari amaldagi **shaharsozlik normalari va qoidalari (ShNQ)** asosida loyihalanadi va quriladi. Ular quyidagilarni tartibga soladi:

- seysmik bardoshlilik (O'zbekiston hududining katta qismi seysmik faol);
- yong'in xavfsizligi va evakuatsiya yo'llari;
- issiqlik himoyasi va energiya samaradorligi;
- insolyatsiya, shovqindan himoya, avtoturargohlar soni.

> Ushbu bo'lim ma'lumot uchun. Normativ hujjatlarning amaldagi rasmiy matnlarini vakolatli davlat organlarining rasmiy manbalaridan oling.`,
  },
];

async function seedBase() {
  for (const [key, name, kind, body] of [
    ["unit-sale", "Ko'chmas mulk oldi-sotdi shartnomasi", "UNIT", UNIT_TEMPLATE],
    ["document-package", "Hujjatlar paketi shartnomasi", "DOCUMENT_PACKAGE", PACKAGE_TEMPLATE],
    ["annex-reservation", "Bron kelishuvi (ilova)", "UNIT", RESERVATION_TEMPLATE],
    ["annex-payment-schedule", "To'lov jadvali (1-ilova)", "UNIT", PAYMENT_SCHEDULE_TEMPLATE],
    ["annex-acceptance", "Qabul-topshirish dalolatnomasi", "UNIT", ACCEPTANCE_TEMPLATE],
  ] as const) {
    await prisma.contractTemplate.upsert({ where: { key }, update: {}, create: { key, name, kind, body } });
  }
  for (const r of RULES) await prisma.rule.upsert({ where: { slug: r.slug }, update: {}, create: r });

  // empty env values (compose passes "" when unset) must fall back too — never create an admin with an empty password
  const phone = process.env.SUPERADMIN_PHONE?.trim() || "+998901000001";
  const password = process.env.SUPERADMIN_PASSWORD?.trim() || DEMO_PASSWORD;
  if (process.env.NODE_ENV === "production" && password === DEMO_PASSWORD && process.env.SEED_DEMO === "false") {
    console.warn("⚠ SUPERADMIN_PASSWORD is not set — the bootstrap admin uses the demo password. Change it immediately!");
  }
  if (!(await prisma.user.findUnique({ where: { phone } }))) {
    await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        email: "admin@ekabuild.uz",
        fullName: "Bosh administrator",
        passwordHash: await bcrypt.hash(password, 11),
        role: "SUPERADMIN",
      },
    });
    console.log(`✓ superadmin ${phone}`);
  }
}

// ───────────────────────────── demo ─────────────────────────────

type DemoProject = {
  name: string;
  tagline: string;
  region: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  floors: number;
  sections: number;
  towers: number;
  status: Prisma.ProjectCreateInput["status"];
  progress: number;
  pricePerSqm: number;
  dev: number;
  featured?: boolean;
  monthsDelay?: number;
  problem?: "cadastre" | "expired" | "complaints";
  /** demo GLB from prisma/assets/models (generated by apps/web/scripts/generate-models.mjs); otherwise procedural massing */
  model?: string;
  /** render file used as cover when the project has no model (e.g. a clay concept render) */
  cover?: string;
  description: string;
};

const PROJECTS: DemoProject[] = [
  {
    name: "Oltin Vodiy Residence",
    tagline: "Yunusobodda premium sinf, yopiq hovli va yer osti avtoturargohi",
    region: "Toshkent shahri",
    district: "Yunusobod",
    address: "Toshkent sh., Yunusobod tumani, Amir Temur ko'chasi, 108",
    lat: 41.3652,
    lng: 69.2867,
    floors: 22,
    sections: 2,
    towers: 2,
    status: "UNDER_CONSTRUCTION",
    progress: 68,
    pricePerSqm: 14_500_000,
    dev: 0,
    featured: true,
    model: "tower-twin",
    description:
      "Oltin Vodiy Residence — ikki minorali premium turar-joy majmuasi. Monolit-karkas konstruksiya, 9 balli seysmik bardoshlilik, panoramali oynalar, yopiq landshaft hovlisi, 2 qavatli yer osti avtoturargohi va bolalar maydonchalari. Barcha ruxsatnomalar va ekspertiza xulosalari platformada ochiq.",
  },
  {
    name: "Mirzo Ulug'bek Park",
    tagline: "Park yonida oilaviy kvartal: maktab, bog'cha va sport majmuasi",
    region: "Toshkent shahri",
    district: "Mirzo Ulug'bek",
    address: "Toshkent sh., Mirzo Ulug'bek tumani, Buyuk Ipak Yo'li ko'chasi, 45",
    lat: 41.3384,
    lng: 69.3351,
    floors: 16,
    sections: 3,
    towers: 3,
    status: "UNDER_CONSTRUCTION",
    progress: 41,
    pricePerSqm: 11_200_000,
    dev: 1,
    featured: true,
    model: "family-quarter",
    description:
      "Oilalar uchun mo'ljallangan 3 seksiyali kvartal. Hududda 300 o'rinli bog'cha, sport maydonchalari va velosiped yo'laklari. Energiya tejamkor fasad, markazlashgan issiqlik ta'minoti.",
  },
  {
    name: "Chilonzor Smart City",
    tagline: "Metro yonida aqlli uylar — Face ID, video kuzatuv, smart hisoblagichlar",
    region: "Toshkent shahri",
    district: "Chilonzor",
    address: "Toshkent sh., Chilonzor tumani, Bunyodkor shoh ko'chasi, 12",
    lat: 41.2856,
    lng: 69.2043,
    floors: 12,
    sections: 2,
    towers: 1,
    model: "courtyard-block",
    status: "COMMISSIONED",
    progress: 100,
    pricePerSqm: 10_400_000,
    dev: 0,
    featured: true,
    description:
      "Foydalanishga topshirilgan aqlli turar-joy majmuasi. Xaridorlar uchun topshirilgandan keyingi xizmatlar: boshqaruv kompaniyasi hisobotlari, ta'mirlash ishlari va hovli obodonlashtirish yangiliklari platformada e'lon qilinadi.",
  },
  {
    name: "Registon View",
    tagline: "Samarqandning tarixiy markaziga yaqin, milliy uslubdagi zamonaviy majmua",
    region: "Samarqand",
    district: "Samarqand shahri",
    address: "Samarqand sh., Universitet xiyoboni, 7",
    lat: 39.6548,
    lng: 66.9615,
    floors: 7,
    sections: 2,
    towers: 1,
    model: "heritage-residence",
    status: "PERMITTED",
    progress: 8,
    pricePerSqm: 8_900_000,
    dev: 2,
    description:
      "Milliy me'morchilik elementlari — peshtoq, ravoqlar va feruza gumbaz bilan uyg'unlashgan 7 qavatli majmua. Qurilish ruxsatnomasi olingan, poydevor ishlari boshlangan.",
  },
  {
    name: "Buxoro Darvoza",
    tagline: "Eski shahar yonida ekologik toza materiallardan qurilgan uylar",
    region: "Buxoro",
    district: "Buxoro shahri",
    address: "Buxoro sh., Bahouddin Naqshband ko'chasi, 30",
    lat: 39.7756,
    lng: 64.4251,
    floors: 7,
    sections: 1,
    towers: 1,
    model: "heritage-residence",
    status: "UNDER_CONSTRUCTION",
    progress: 57,
    pricePerSqm: 7_600_000,
    dev: 2,
    monthsDelay: 5,
    problem: "complaints",
    description: "Kam qavatli turar-joy binosi. Qurilish muddati 5 oyga kechikkan — quruvchi yangilangan grafikni e'lon qilgan.",
  },
  {
    name: "Namangan Gardens",
    tagline: "Gulzorlar shahrida bog'li uylar va tijorat galereyasi",
    region: "Namangan",
    district: "Namangan shahri",
    address: "Namangan sh., Navoiy ko'chasi, 88",
    lat: 41.0005,
    lng: 71.6683,
    floors: 18,
    sections: 1,
    towers: 1,
    model: "tower-single",
    status: "UNDER_CONSTRUCTION",
    progress: 33,
    pricePerSqm: 7_900_000,
    dev: 1,
    problem: "cadastre",
    description: "18 qavatli turar-joy minorasi: panoramali balkonlar, birinchi qavatlarda tijorat galereyasi va yashil hovli.",
  },
  {
    name: "Farg'ona Business Tower",
    tagline: "A sinfidagi ofislar va kovorking, 18 qavat",
    region: "Farg'ona",
    district: "Farg'ona shahri",
    address: "Farg'ona sh., Mustaqillik ko'chasi, 21",
    lat: 40.3842,
    lng: 71.7843,
    floors: 18,
    sections: 1,
    towers: 1,
    model: "business-tower",
    status: "UNDER_CONSTRUCTION",
    progress: 74,
    pricePerSqm: 12_800_000,
    dev: 0,
    problem: "expired",
    description: "Vodiydagi birinchi A sinf biznes markazi: ofislar, konferens-zallar, kovorking va panoramali restoran.",
  },
  {
    name: "Andijon Yangi Shahar",
    tagline: "Yangi mavze: 4 ta 12 qavatli bino, maktab va park",
    region: "Andijon",
    district: "Andijon shahri",
    address: "Andijon sh., Bobur shoh ko'chasi, 5",
    lat: 40.7829,
    lng: 72.3501,
    floors: 12,
    sections: 4,
    towers: 3,
    status: "PLANNING",
    progress: 0,
    pricePerSqm: 7_100_000,
    dev: 3,
    cover: "family-quarter-clay.jpg",
    description: "Loyihalash bosqichidagi yangi mavze. Ruxsatnoma hali olinmagan — xarid qilishdan oldin ehtiyot bo'ling.",
  },
];

async function seedDemo() {
  const pw = await bcrypt.hash(DEMO_PASSWORD, 11);
  const admin = (await prisma.user.findFirst({ where: { role: "SUPERADMIN" } }))!;

  // organisations
  const devs = await Promise.all(
    [
      ["Toshkent Siti Qurilish", "Toshkent Siti Qurilish MChJ", "301234567", "Akmal Rahimov", "Toshkent shahri", 2009, "VERIFIED"],
      ["Oltin Qal'a Build", "Oltin Qal'a Build AJ", "302345678", "Dilshod Karimov", "Toshkent shahri", 2014, "VERIFIED"],
      ["Samarqand Darvoza Development", "Samarqand Darvoza Development MChJ", "303456789", "Sardor Yusupov", "Samarqand", 2011, "VERIFIED"],
      ["Yangi Avlod Construct", "Yangi Avlod Construct MChJ", "304567890", "Jasur Tursunov", "Andijon", 2021, "PENDING"],
    ].map(([name, legalName, tin, director, region, founded, status]) =>
      prisma.organization.create({
        data: {
          type: "DEVELOPER",
          name: name as string,
          legalName: legalName as string,
          tin: tin as string,
          director: director as string,
          region: region as string,
          address: `${region}, markaziy ofis`,
          phone: "+998336685555",
          licenseNumber: `L-${tin}`,
          foundedYear: founded as number,
          status: status as "VERIFIED" | "PENDING",
          verifiedAt: status === "VERIFIED" ? new Date() : null,
          description: `${name} — ${founded}-yildan beri faoliyat yuritadi. Turar-joy va tijorat obyektlarini loyihalash va qurish.`,
        },
      }),
    ),
  );
  const buyerCo = await prisma.organization.create({
    data: { type: "BUYER_COMPANY", name: "Agro Invest Group", legalName: "Agro Invest Group MChJ", tin: "305678901", director: "Rustam Aliyev", region: "Toshkent shahri", status: "VERIFIED", verifiedAt: new Date() },
  });
  const inspectionBody = await prisma.organization.create({
    data: { type: "INSPECTION_BODY", name: "Qurilish nazorati inspeksiyasi (demo)", tin: "200000001", region: "Toshkent shahri", status: "VERIFIED", verifiedAt: new Date() },
  });

  const mk = (phone: string, fullName: string, role: Prisma.UserCreateInput["role"], organizationId?: string, pinfl?: string) =>
    prisma.user.create({ data: { phone, phoneVerifiedAt: new Date(), fullName, role, passwordHash: pw, organizationId, pinfl } });
  const developerUser = await mk("+998901000002", "Akmal Rahimov", "DEVELOPER", devs[0]!.id, "30101850000011");
  const inspector = await mk("+998901000003", "Nodira Saidova", "INSPECTOR", inspectionBody.id);
  const buyer = await mk("+998901000004", "Aziz Qodirov", "BUYER", undefined, "31505900000022");
  const companyUser = await mk("+998901000005", "Rustam Aliyev", "BUYER", buyerCo.id, "30212880000033");
  const devUsers = [developerUser];
  for (const [i, d] of devs.slice(1).entries()) devUsers.push(await mk(`+99890100001${i}`, d.director!, "DEVELOPER", d.id));
  const extraBuyers = await Promise.all(
    ["Malika Ergasheva", "Bobur Hamidov", "Shahzoda Usmonova", "Timur Nazarov", "Kamola Rasulova"].map((n, i) => mk(`+99893200000${i}`, n, "BUYER")),
  );
  console.log("✓ organisations & users");

  const cadDigits = (i: number) => `${10 + i}:0${(i % 9) + 1}:0${(i % 7) + 1}:02:01:0${100 + i * 7}`;
  const now = Date.now();
  const months = (n: number) => new Date(now + n * 30 * 86400_000);

  for (const [i, d] of PROJECTS.entries()) {
    const r = rng(i + 11);
    const dev = devs[d.dev]!;
    const owner = devUsers[d.dev]!;
    const slug = d.name
      .toLowerCase()
      .replace(/['‘’ʻʼ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // photoreal Cycles renders (tools/blender/build_models.py) when available, raster illustrations otherwise
    const renders = (d.model ? [`${d.model}-hero.jpg`, `${d.model}-aerial.jpg`] : d.cover ? [d.cover] : [])
      .map((f) => path.join(ASSETS_DIR, "renders", f))
      .filter((f) => fs.existsSync(f));
    const gallery = [];
    for (const [k, f] of renders.entries()) gallery.push(await saveFile(fs.readFileSync(f), `${slug}-${k + 1}.jpg`, "image/jpeg", owner.id));
    if (!gallery.length) {
      gallery.push(await saveFile(buildingRender(i * 7 + 3, { floors: d.floors, towers: d.towers, progress: d.progress || 100 }), `${slug}-cover.png`, "image/png", owner.id));
      for (let g = 0; g < 2; g++) gallery.push(await saveFile(buildingRender(i * 13 + g * 5 + 1, { floors: d.floors, towers: 1, progress: d.progress || 100 }), `${slug}-${g + 2}.png`, "image/png", owner.id));
    }
    const cover = gallery[0]!;

    const width = 30 + Math.round(r() * 15);
    const depth = 16 + Math.round(r() * 6);
    const towers = Array.from({ length: d.towers - 1 }, (_, t) => ({ x: (t + 1) * (width + 14) * (t % 2 ? -1 : 1), z: (t + 1) * 6, floors: Math.max(5, d.floors - 2 - t * 3), width: width - 4, depth }));
    const plannedEnd = d.status === "COMMISSIONED" ? months(-8) : months(6 + Math.round(r() * 18) - (d.monthsDelay ?? 0) - (d.monthsDelay ? 12 : 0));

    const project = await prisma.project.create({
      data: {
        slug,
        name: d.name,
        tagline: d.tagline,
        description: d.description,
        type: d.name.includes("Business") ? "COMMERCIAL" : "RESIDENTIAL",
        status: d.status,
        developerId: dev.id,
        region: d.region,
        district: d.district,
        address: d.address,
        lat: d.lat,
        lng: d.lng,
        cadastreNumber: cadDigits(i),
        landArea: 6000 + Math.round(r() * 9000),
        totalArea: Math.round(width * depth * d.floors * d.towers * 0.92),
        floors: d.floors,
        sections: d.sections,
        pricePerSqm: d.pricePerSqm,
        currency: "UZS",
        packagePrice: 18_000_000 + i * 2_000_000,
        startDate: months(-14 - Math.round(r() * 10)),
        plannedEndDate: plannedEnd,
        actualEndDate: d.status === "COMMISSIONED" ? months(-7) : null,
        progress: d.progress,
        coverUrl: `/api/v1/files/${cover.id}`,
        gallery: gallery.map((g) => `/api/v1/files/${g.id}`),
        massing: { floors: d.floors, width, depth, towers, accent: "#C9A464" },
        verificationStatus: dev.status === "VERIFIED" ? "VERIFIED" : "PENDING",
        published: dev.status === "VERIFIED" || d.status === "PLANNING",
        featured: !!d.featured,
        views: Math.round(200 + r() * 3000),
      },
    });

    if (d.model) {
      const glbPath = path.join(ASSETS_DIR, "models", `${d.model}.glb`);
      if (fs.existsSync(glbPath)) {
        const glb = await saveFile(fs.readFileSync(glbPath), `${slug}-3d.glb`, "model/gltf-binary", owner.id);
        await prisma.project.update({ where: { id: project.id }, data: { model3dId: glb.id } });
      }
    }

    // units: sections × floors × perFloor
    const perFloor = d.name.includes("Business") ? 6 : 4;
    const units: Prisma.UnitCreateManyInput[] = [];
    for (let s = 1; s <= d.sections; s++)
      for (let f = 2; f <= d.floors; f++)
        for (let k = 1; k <= perFloor; k++) {
          const area = Math.round((42 + k * 17 + r() * 8) * 10) / 10;
          const roll = r();
          const status = d.status === "PLANNING" ? "AVAILABLE" : roll < (d.progress / 100) * 0.55 ? "SOLD" : roll < (d.progress / 100) * 0.55 + 0.08 ? "RESERVED" : "AVAILABLE";
          units.push({
            projectId: project.id,
            number: `${f}${String(k).padStart(2, "0")}`,
            section: s,
            floor: f,
            type: d.name.includes("Business") ? "OFFICE" : "APARTMENT",
            rooms: area < 60 ? 1 : area < 80 ? 2 : area < 100 ? 3 : 4,
            area,
            price: Math.round(area * d.pricePerSqm * (1 + (f - 2) * 0.004)),
            status,
          });
        }
    await prisma.unit.createMany({ data: units });
    const min = await prisma.unit.aggregate({ where: { projectId: project.id }, _min: { price: true } });
    await prisma.project.update({ where: { id: project.id }, data: { unitsTotal: units.length, priceFrom: min._min.price } });

    // documents + certificates
    const issued = months(-16);
    const docs: { type: Prisma.DocumentCreateInput["type"]; title: string; access: "PUBLIC" | "BUYERS"; cert?: Prisma.CertificateCreateInput["type"]; issuer: string; valid?: Date | null }[] =
      d.status === "PLANNING"
        ? [{ type: "LAND_ALLOTMENT", title: "Yer uchastkasini ajratish to'g'risida qaror", access: "PUBLIC", issuer: "Viloyat hokimligi" }]
        : [
            { type: "BUILDING_PERMIT", title: "Qurilish ruxsatnomasi", access: "PUBLIC", cert: "BUILDING_PERMIT", issuer: "Qurilish va uy-joy kommunal xo'jaligi vazirligi (demo)", valid: d.problem === "expired" ? months(-1) : months(20) },
            { type: "EXPERTISE", title: "Loyiha-smeta hujjatlari davlat ekspertizasi xulosasi", access: "PUBLIC", cert: "STATE_EXPERTISE", issuer: "Davlat ekspertizasi markazi (demo)", valid: null },
            { type: "LICENSE", title: "Qurilish-montaj ishlari litsenziyasi", access: "PUBLIC", cert: "CONSTRUCTION_LICENSE", issuer: "Litsenziyalash organi (demo)", valid: months(36) },
            { type: "CADASTRE_EXTRACT", title: "Kadastr ko'chirmasi", access: "PUBLIC", issuer: "Kadastr agentligi (demo)" },
            { type: "CONFORMITY_CERT", title: "Qurilish materiallari muvofiqlik sertifikati", access: "PUBLIC", cert: "CONFORMITY", issuer: "O'zstandart (demo)", valid: months(12) },
            ...(d.status === "COMMISSIONED"
              ? [{ type: "COMMISSIONING_ACT" as const, title: "Foydalanishga qabul qilish dalolatnomasi", access: "PUBLIC" as const, cert: "COMMISSIONING" as const, issuer: "Qabul komissiyasi (demo)", valid: null }]
              : []),
          ];
    for (const [k, doc] of docs.entries()) {
      const number = `${doc.type.slice(0, 3)}-${2024 + (k % 2)}-${String(1000 + i * 37 + k * 11)}`;
      const pdf = simplePdf(
        [
          ["O'ZBEKISTON RESPUBLIKASI", 11, true],
          ["", 8],
          [doc.title.toUpperCase(), 18, true],
          ["", 10],
          [`Raqam: ${number}`, 12],
          [`Berilgan sana: ${issued.toISOString().slice(0, 10)}`, 12],
          ...(doc.valid ? ([[`Amal qilish muddati: ${doc.valid.toISOString().slice(0, 10)}`, 12]] as [string, number][]) : []),
          [`Beruvchi: ${doc.issuer}`, 12],
          ["", 10],
          [`Obyekt: ${d.name}`, 12, true],
          [`Manzil: ${d.address}`, 11],
          [`Kadastr raqami: ${cadDigits(i)}`, 11],
          [`Buyurtmachi: ${dev.legalName}, STIR ${dev.tin}`, 11],
          ["", 14],
          ["Ushbu hujjat EKA BUILD demo ma'lumotlari uchun yaratilgan.", 9],
        ],
        { border: true, seal: "TASDIQLANGAN" },
      );
      const file = await saveFile(pdf, `${slug}-${doc.type.toLowerCase()}.pdf`, "application/pdf", owner.id);
      const verified = dev.status === "VERIFIED" && !(d.problem === "cadastre" && doc.type === "CADASTRE_EXTRACT");
      const document = await prisma.document.create({
        data: {
          projectId: project.id,
          type: doc.type,
          title: doc.title,
          number,
          issuer: doc.issuer,
          issuedAt: issued,
          expiresAt: doc.valid ?? null,
          access: doc.access,
          fileId: file.id,
          status: verified ? "VERIFIED" : "PENDING",
          verifiedById: verified ? inspector.id : null,
          verifiedAt: verified ? new Date() : null,
        },
      });
      if (doc.cert) {
        await prisma.certificate.create({
          data: {
            code: certificateCode(),
            projectId: project.id,
            documentId: document.id,
            type: doc.cert,
            number,
            issuer: doc.issuer,
            issuedAt: issued,
            validUntil: doc.valid ?? null,
            status: !verified ? "PENDING" : doc.valid && doc.valid < new Date() ? "EXPIRED" : "VERIFIED",
            verifiedById: verified ? inspector.id : null,
            verifiedAt: verified ? new Date() : null,
          },
        });
      }
    }
    // drawings (buyers only) + public facade
    const facade = await saveFile(facadeDrawing(i + 2, d.floors), `${slug}-fasad.png`, "image/png", owner.id);
    await prisma.document.create({ data: { projectId: project.id, type: "DRAWING", title: "Bosh fasad", access: "PUBLIC", fileId: facade.id, status: "VERIFIED" } });
    for (const rooms of [1, 2, 3]) {
      const plan = await saveFile(floorPlan(i * 10 + rooms, rooms), `${slug}-reja-${rooms}x.png`, "image/png", owner.id);
      await prisma.document.create({
        data: { projectId: project.id, type: "FLOOR_PLAN", title: `${rooms} xonali xonadon rejasi`, access: "BUYERS", fileId: plan.id, status: "VERIFIED" },
      });
    }
    const workDrawings = await saveFile(
      simplePdf([["ISHCHI CHIZMALAR TO'PLAMI", 18, true], ["", 8], ["AR, KJ, KM, OV, VK bo'limlari", 12], [`Obyekt: ${d.name}`, 12]], { border: true }),
      `${slug}-ishchi-chizmalar.pdf`,
      "application/pdf",
      owner.id,
    );
    await prisma.document.create({ data: { projectId: project.id, type: "DRAWING", title: "Ishchi chizmalar to'plami (AR, KJ, KM)", access: "BUYERS", fileId: workDrawings.id, status: "VERIFIED" } });

    // cadastre check
    if (d.status !== "PLANNING") {
      const devName = dev.legalName ?? dev.name;
      const hint = { lat: d.lat, lng: d.lng, address: d.address, landArea: project.landArea, developerName: devName };
      const rec = await cadastreProvider.lookup(cadDigits(i), hint);
      if (d.problem === "cadastre") {
        rec.lat = d.lat + 0.012;
        rec.lng = d.lng - 0.009;
        rec.owner = "Boshqa yuridik shaxs";
      } else {
        rec.lat = d.lat + 0.0002;
        rec.lng = d.lng + 0.0001;
        rec.owner = devName;
        rec.area = project.landArea ?? rec.area;
      }
      const ev = evaluateCadastre(rec, { lat: d.lat, lng: d.lng, landArea: project.landArea, developerName: devName });
      await prisma.cadastreCheck.create({
        data: {
          projectId: project.id,
          cadastreNumber: cadDigits(i),
          provider: "mock",
          result: ev.result,
          distanceM: ev.distanceM,
          checkedById: inspector.id,
          details: { registryAddress: rec.address, registryArea: rec.area, registryLat: rec.lat, registryLng: rec.lng, owner: rec.owner, purpose: rec.purpose, messages: ev.messages },
        },
      });
    }

    // inspections
    if (d.progress > 0) {
      const stages: [Prisma.InspectionCreateInput["type"], Prisma.InspectionCreateInput["result"], string][] = [
        ["FOUNDATION", "PASSED", "Poydevor armaturasi va beton markasi loyihaga mos"],
        ["FRAME", d.problem === "complaints" ? "ISSUES" : "PASSED", d.problem === "complaints" ? "Karkasda kichik kamchiliklar aniqlandi" : "Monolit karkas ishlari talablarga mos"],
        ["ENGINEERING", "PASSED", "Muhandislik tarmoqlari sinovdan o'tkazildi"],
      ];
      const count = Math.max(1, Math.min(3, Math.ceil(d.progress / 35)));
      for (let s = 0; s < count; s++) {
        const [type, result, summary] = stages[s]!;
        const photo = await saveFile(buildingRender(i * 31 + s, { floors: d.floors, towers: 1, progress: Math.min(100, (s + 1) * 30), w: 900, h: 600 }), `inspeksiya-${slug}-${s}.png`, "image/png", inspector.id);
        await prisma.inspection.create({
          data: {
            projectId: project.id,
            inspectorId: inspector.id,
            type,
            result,
            date: months(-12 + s * 4),
            summary,
            notes: "Tekshiruv dalolatnomasi tuzildi, fotosuratlar ilova qilindi.",
            violations:
              result === "ISSUES"
                ? [
                    { code: "KJ-12", text: "Ayrim ustunlarda himoya qatlami qalinligi yetarli emas", severity: "MEDIUM", resolved: false },
                    { code: "XB-03", text: "Qurilish maydonchasida xavfsizlik to'siqlari to'liq emas", severity: "LOW", resolved: true },
                  ]
                : [],
            files: { create: [{ fileId: photo.id }] },
          },
        });
      }
    }

    // progress posts
    const posts: [string, string, number][] = [
      ["Poydevor ishlari yakunlandi", "Poydevor plitasi quyildi, gidroizolyatsiya ishlari bajarildi.", 15],
      ["Karkas ishlari 10-qavatgacha yetdi", "Monolit karkas jadval bo'yicha davom etmoqda. Lift shaxtalari montaj qilinmoqda.", 40],
      ["Fasad ishlari boshlandi", "Ventilyatsiyalanuvchi fasad tizimi o'rnatilmoqda, derazalar montaji boshlandi.", 65],
      ["Ichki pardozlash va muhandislik tarmoqlari", "Elektr, suv va isitish tizimlari ulanmoqda.", 85],
      ["Obyekt foydalanishga topshirildi", "Davlat qabul komissiyasi dalolatnomasi imzolandi.", 100],
    ];
    for (const [k, [title, body, pct]] of posts.entries()) {
      if (pct > d.progress) break;
      const stage = d.model ? path.join(ASSETS_DIR, "renders", `${d.model}-stage-${pct}.jpg`) : "";
      const media =
        stage && fs.existsSync(stage)
          ? await saveFile(fs.readFileSync(stage), `jarayon-${slug}-${pct}.jpg`, "image/jpeg", owner.id)
          : await saveFile(buildingRender(i * 17 + k, { floors: d.floors, towers: 1, progress: pct, w: 900, h: 600 }), `jarayon-${slug}-${k}.png`, "image/png", owner.id);
      await prisma.progressUpdate.create({
        data: { projectId: project.id, authorId: owner.id, phase: "CONSTRUCTION", title, body, stage: `${pct}%`, percent: pct, date: months(-12 + k * 3), media: { create: [{ fileId: media.id }] } },
      });
    }
    if (d.status === "COMMISSIONED") {
      for (const [k, [title, body]] of [
        ["Hovli obodonlashtirildi", "Bolalar maydonchasi, yashil hudud va yoritish tizimi yakunlandi."],
        ["Boshqaruv kompaniyasi hisoboti — 3-chorak", "Lift texnik xizmati, fasad yuvish va umumiy hududlar ta'miri bajarildi. Xarajatlar hisoboti ilova qilindi."],
        ["Avtoturargoh shlagbaumi va video kuzatuv", "Aqlli kirish tizimi ishga tushirildi, yashovchilar ilovasi orqali boshqariladi."],
      ].entries())
        await prisma.progressUpdate.create({ data: { projectId: project.id, authorId: owner.id, phase: "POST_HANDOVER", title, body, date: months(-5 + k * 2) } });
    }

    if (d.problem === "complaints") {
      await prisma.complaint.createMany({
        data: [
          { projectId: project.id, category: "DELAY", message: "Topshirish muddati e'lon qilingandan 5 oy kechikmoqda, quruvchi aniq javob bermayapti.", reporterId: extraBuyers[0]!.id },
          { projectId: project.id, category: "QUALITY", message: "Podyezddagi suvoq ishlari sifatsiz bajarilgan.", reporterId: extraBuyers[1]!.id, status: "IN_REVIEW" },
        ],
      });
    }
    await recalculateTrust(project.id);
    await audit({ actorId: owner.id, action: "PROJECT_CREATE", entity: "Project", entityId: project.id, meta: { name: d.name } });
    console.log(`✓ project ${d.name}`);
  }

  // ── deals: one completed purchase (signed + paid), one pending signature, one company package
  const sig = (data: string) => Buffer.from(JSON.stringify({ mock: true, data, signedAt: new Date().toISOString() })).toString("base64");
  async function deal(
    buyerUser: typeof buyer,
    projectSlug: string,
    kind: "UNIT" | "DOCUMENT_PACKAGE",
    finalStatus: "PENDING_SIGNATURES" | "PAID" | "COMPLETED",
    opts: { plan?: PlanInput; ageDays?: number } = {},
  ) {
    const createdAt = new Date(Date.now() - (opts.ageDays ?? 0) * 86400_000);
    const plan: PlanInput = opts.plan ?? { planType: "FULL" };
    const project = await prisma.project.findUniqueOrThrow({ where: { slug: projectSlug }, include: { developer: true } });
    const unit = kind === "UNIT" ? await prisma.unit.findFirst({ where: { projectId: project.id, status: "AVAILABLE", floor: { gte: 6 } }, orderBy: { floor: "asc" } }) : null;
    const template = await prisma.contractTemplate.findUniqueOrThrow({ where: { key: kind === "UNIT" ? "unit-sale" : "document-package" } });
    const org = buyerUser.organizationId ? await prisma.organization.findUnique({ where: { id: buyerUser.organizationId } }) : null;
    const amount = Number(unit ? unit.price : project.packagePrice);
    const number = docNumber("C");
    const schedule = buildSchedule(amount, plan, createdAt);
    const reservationUntil = unit && finalStatus === "PENDING_SIGNATURES" ? new Date(createdAt.getTime() + 7 * 86400_000) : null;
    const body = renderTemplate(
      template.body,
      contractContext({
        number,
        date: createdAt,
        buyer: { fullName: buyerUser.fullName, phone: buyerUser.phone, pinfl: buyerUser.pinfl },
        buyerOrg: org ? { name: org.name, tin: org.tin } : null,
        seller: { name: project.developer.legalName ?? project.developer.name, tin: project.developer.tin, director: project.developer.director, address: project.developer.address },
        project: { name: project.name, address: project.address, cadastreNumber: project.cadastreNumber },
        unit: unit ? { number: unit.number, floor: unit.floor, area: unit.area, rooms: unit.rooms, section: unit.section } : null,
        amount,
        currency: "UZS",
        payment: unit ? { planType: plan.planType, downPercent: plan.downPercent ?? 100, months: plan.months ?? 0, rows: schedule } : null,
        reservationUntil,
      }),
    );
    const bodyHash = sha256(body);
    const signed = finalStatus !== "PENDING_SIGNATURES";
    const signedAt = new Date(createdAt.getTime() + 86400_000);
    const firstPaidAt = new Date(createdAt.getTime() + 3 * 86400_000);
    const purchase = await prisma.purchase.create({
      data: {
        number: docNumber("P"),
        kind,
        status: finalStatus,
        projectId: project.id,
        unitId: unit?.id,
        activeUnitLock: unit?.id,
        buyerId: buyerUser.id,
        buyerOrgId: org?.id,
        amount,
        paidAt: signed ? firstPaidAt : null,
        planType: plan.planType,
        downPercent: plan.planType === "INSTALLMENT" ? (plan.downPercent ?? 30) : 100,
        months: plan.months ?? 0,
        reservationUntil,
        createdAt,
        contract: {
          create: { number, templateId: template.id, title: `${template.name} — ${project.name}${unit ? `, №${unit.number}` : ""}`, body, bodyHash, status: signed ? "SIGNED" : "PARTIALLY_SIGNED", signedAt: signed ? signedAt : null, createdAt },
        },
      },
      include: { contract: true },
    });
    await seedPayments(purchase.id, schedule, { paid: signed, firstPaidAt, r: rng(7) });
    if (unit) await prisma.unit.update({ where: { id: unit.id }, data: { status: signed ? "SOLD" : "RESERVED" } });
    const seller = await prisma.user.findFirstOrThrow({ where: { organizationId: project.developerId } });
    const c = purchase.contract!;
    // seller always signs first in the demo; buyer signs only for completed deals
    const signers: [SignerRole, typeof seller][] = [["SELLER", seller], ...(signed ? ([["BUYER", buyerUser]] as [SignerRole, typeof seller][]) : [])];
    for (const [role, user] of signers) {
      const payload = signingPayload(c, role, user.id);
      await prisma.signature.create({
        data: {
          contractId: c.id,
          userId: user.id,
          role,
          method: "MOCK",
          pkcs7: sig(payload.data),
          certSerial: "DEMO",
          signerName: user.fullName,
          signerTin: role === "SELLER" ? project.developer.tin : org?.tin,
          signerPinfl: user.pinfl,
          verified: true,
          signedAt: role === "SELLER" ? new Date(createdAt.getTime() + 3600_000) : signedAt,
        },
      });
    }
    await audit({ actorId: buyerUser.id, action: "PURCHASE_CREATE", entity: "Purchase", entityId: purchase.id, meta: { number: purchase.number, kind, contractHash: bodyHash } });
    return purchase;
  }
  // demo buyer: 24-month instalment plan started ~4 months ago (down + 3 instalments paid, next one due soon)
  await deal(buyer, "chilonzor-smart-city", "UNIT", "PAID", { plan: { planType: "INSTALLMENT", downPercent: 30, months: 24 }, ageDays: 117 });
  await deal(buyer, "oltin-vodiy-residence", "UNIT", "PENDING_SIGNATURES", { ageDays: 2 });
  await deal(companyUser, "farg-ona-business-tower".replace("farg-ona", "fargona"), "DOCUMENT_PACKAGE", "COMPLETED", { ageDays: 21 });
  await prisma.favorite.createMany({
    data: [
      { userId: buyer.id, projectId: (await prisma.project.findUniqueOrThrow({ where: { slug: "mirzo-ulugbek-park" } })).id },
      { userId: buyer.id, projectId: (await prisma.project.findUniqueOrThrow({ where: { slug: "registon-view" } })).id },
    ],
  });
  console.log("✓ deals");

  // notifications
  await prisma.notification.createMany({
    data: [
      { userId: buyer.id, type: "SUCCESS", title: "To'lov qabul qilindi", body: "Chilonzor Smart City — hujjatlar endi siz uchun ochiq.", link: "/app/files" },
      { userId: buyer.id, type: "WARNING", title: "Shartnoma imzongizni kutmoqda", body: "Oltin Vodiy Residence — sotuvchi imzoladi.", link: "/app/contracts" },
      { userId: developerUser.id, type: "INFO", title: "Yangi buyurtma", body: "Aziz Qodirov: Oltin Vodiy Residence.", link: "/app/developer/sales" },
    ],
  });

  // support chat demo
  const thread = await prisma.supportThread.create({
    data: { guestName: "Dilnoza", guestPhone: "+998901112233", subject: "Sertifikatni tekshirish", unreadForAgent: 1, lastMessageAt: new Date(now - 60_000), createdAt: new Date(now - 7 * 60_000) },
  });
  await prisma.supportMessage.createMany({
    data: [
      { threadId: thread.id, senderType: "USER", body: "Assalomu alaykum! Quruvchi bergan ruxsatnoma nusxasini qanday tekshirsam bo'ladi?", createdAt: new Date(now - 6 * 60_000) },
      { threadId: thread.id, senderType: "AGENT", senderId: admin.id, body: "Va alaykum assalom! «Tekshirish» sahifasida PDF faylni yuklang — xesh reyestrdagi asl nusxaga mos kelishini ko'rsatamiz.", createdAt: new Date(now - 4 * 60_000) },
      { threadId: thread.id, senderType: "USER", body: "Rahmat! Mos keldi, juda qulay ekan 👍", createdAt: new Date(now - 60_000) },
    ],
  });
  await prisma.supportThread.update({ where: { id: thread.id }, data: { firstResponseAt: new Date(now - 4 * 60_000) } });
  console.log("✓ support, notifications");
}

// ───────────────────────────── history: consistent deals & analytics ─────────────────────────────

const FIRST_NAMES = ["Aziz", "Bekzod", "Dilshod", "Jahongir", "Otabek", "Sardor", "Sherzod", "Ulug'bek", "Javohir", "Akmal", "Rustam", "Farrux", "Nodir", "Islom", "Timur",
  "Malika", "Dilnoza", "Gulnora", "Madina", "Nigora", "Sevara", "Shahnoza", "Zarina", "Kamola", "Feruza", "Mohira", "Nilufar", "Durdona", "Laylo", "Munisa"];
const LAST_NAMES = ["Karimov", "Rahimov", "Yusupov", "Tursunov", "Aliyev", "Ergashev", "Hamidov", "Nazarov", "Rasulov", "Usmonov", "Qodirov", "Saidov", "Abdullayev",
  "Ismoilov", "Mirzayev", "Xolmatov", "Sobirov", "Jo'rayev", "Normatov", "Ahmedov"];

function personName(r: () => number) {
  const first = FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)]!;
  let last = LAST_NAMES[Math.floor(r() * LAST_NAMES.length)]!;
  // female surnames take -a (Karimova, Yusupova…)
  if (FIRST_NAMES.indexOf(first) >= 15) last = last.endsWith("v") ? `${last}a` : last;
  return `${first} ${last}`;
}

/**
 * Makes the demo data internally consistent: every SOLD unit has a paid purchase with a signed contract,
 * every RESERVED unit has a pending deal, buyers registered over the last 18 months, and 120 days of
 * product analytics (views with a realistic daily/hourly rhythm, certificate lookups, file checks, searches).
 */
async function seedHistory() {
  const r = rng(2026);
  const pw = await bcrypt.hash(DEMO_PASSWORD, 11);
  const now = Date.now();
  const DAY = 86400_000;

  // buyers registered over 18 months
  const buyers: { id: string; fullName: string; phone: string; pinfl: string }[] = [];
  for (let i = 0; i < 64; i++) {
    const created = new Date(now - Math.floor(r() * 540) * DAY - Math.floor(r() * DAY));
    const pinfl = `3${String(Math.floor(r() * 1e13)).padStart(13, "0")}`;
    const u = await prisma.user.create({
      data: {
        phone: `+99891${String(1000000 + i * 7919).slice(-7)}`,
        phoneVerifiedAt: created,
        fullName: personName(r),
        pinfl,
        role: "BUYER",
        passwordHash: pw,
        createdAt: created,
      },
    });
    buyers.push({ id: u.id, fullName: u.fullName, phone: u.phone, pinfl });
  }
  const companies = await prisma.organization.findMany({ where: { type: "BUYER_COMPANY" } });

  const template = await prisma.contractTemplate.findUniqueOrThrow({ where: { key: "unit-sale" } });
  const projects = await prisma.project.findMany({ include: { developer: true } });
  const sellers = new Map<string, string>();
  for (const p of projects) {
    const s = await prisma.user.findFirst({ where: { organizationId: p.developerId } });
    if (s) sellers.set(p.developerId, s.id);
  }

  let deals = 0;
  for (const p of projects) {
    const sold = await prisma.unit.findMany({ where: { projectId: p.id, status: { in: ["SOLD", "RESERVED"] }, purchases: { none: {} } } });
    const salesStart = (p.startDate ?? new Date(now - 540 * DAY)).getTime();
    let openReservations = 0;
    for (const unit of sold) {
      // a reservation lives 7 days, so only a handful can be open at any moment — the rest go back on sale
      if (unit.status === "RESERVED" && ++openReservations > 2) {
        await prisma.unit.update({ where: { id: unit.id }, data: { status: "AVAILABLE" } });
        continue;
      }
      const buyer = buyers[Math.floor(r() * buyers.length)]!;
      const company = r() < 0.12 ? companies[0] : null;
      const reserved = unit.status === "RESERVED";
      // reservations live 7 days — open ones were created during the last week
      const createdAt = new Date(reserved ? now - Math.floor(r() * 6 * DAY + 3600_000) : salesStart + Math.floor(r() * Math.max(1, now - salesStart - 10 * DAY)));
      const signedAt = new Date(createdAt.getTime() + Math.floor(1 + r() * 2) * DAY);
      const paidAt = new Date(signedAt.getTime() + Math.floor(1 + r() * 2) * DAY);
      // ~45% buy with instalments (down 30–50%, 12–36 months), the rest pay in full
      const plan: PlanInput =
        r() < 0.45 ? { planType: "INSTALLMENT", downPercent: [30, 30, 40, 50][Math.floor(r() * 4)]!, months: [12, 18, 24, 24, 36][Math.floor(r() * 5)]! } : { planType: "FULL" };
      const schedule = buildSchedule(Number(unit.price), plan, createdAt);
      const reservationUntil = reserved ? new Date(createdAt.getTime() + 7 * DAY) : null;
      const number = docNumber("C");
      const body = renderTemplate(
        template.body,
        contractContext({
          number,
          buyer: { fullName: buyer.fullName, phone: buyer.phone, pinfl: buyer.pinfl },
          buyerOrg: company ? { name: company.name, tin: company.tin } : null,
          seller: { name: p.developer.legalName ?? p.developer.name, tin: p.developer.tin, director: p.developer.director, address: p.developer.address },
          project: { name: p.name, address: p.address, cadastreNumber: p.cadastreNumber },
          unit: { number: unit.number, floor: unit.floor, area: unit.area, rooms: unit.rooms, section: unit.section },
          amount: Number(unit.price),
          currency: p.currency,
          payment: { planType: plan.planType, downPercent: plan.downPercent ?? 100, months: plan.months ?? 0, rows: schedule },
          reservationUntil,
          date: createdAt,
        }),
      );
      const bodyHash = sha256(body);
      const purchase = await prisma.purchase.create({
        data: {
          number: docNumber("P"),
          kind: "UNIT",
          status: reserved ? "PENDING_SIGNATURES" : p.status === "COMMISSIONED" ? "COMPLETED" : "PAID",
          projectId: p.id,
          unitId: unit.id,
          activeUnitLock: unit.id,
          buyerId: buyer.id,
          buyerOrgId: company?.id,
          amount: unit.price,
          currency: p.currency,
          paidAt: reserved ? null : paidAt,
          planType: plan.planType,
          downPercent: plan.planType === "INSTALLMENT" ? plan.downPercent! : 100,
          months: plan.months ?? 0,
          reservationUntil,
          createdAt,
          contract: {
            create: {
              number,
              templateId: template.id,
              title: `${template.name} — ${p.name}, №${unit.number}`,
              body,
              bodyHash,
              status: reserved ? "PARTIALLY_SIGNED" : "SIGNED",
              signedAt: reserved ? null : signedAt,
              createdAt,
            },
          },
        },
        include: { contract: true },
      });
      const sellerId = sellers.get(p.developerId);
      const signers: [SignerRole, string, string | null][] = [];
      if (sellerId) signers.push(["SELLER", sellerId, p.developer.tin]);
      if (!reserved) signers.push(["BUYER", buyer.id, company?.tin ?? null]);
      for (const [role, userId, tin] of signers) {
        const payload = signingPayload(purchase.contract!, role, userId);
        await prisma.signature.create({
          data: {
            contractId: purchase.contract!.id,
            userId,
            role,
            method: "MOCK",
            pkcs7: Buffer.from(JSON.stringify({ mock: true, data: payload.data })).toString("base64"),
            certSerial: "DEMO",
            signerName: role === "BUYER" ? buyer.fullName : p.developer.director,
            signerTin: tin,
            signerPinfl: role === "BUYER" ? buyer.pinfl : null,
            verified: true,
            signedAt: role === "SELLER" ? new Date(createdAt.getTime() + 3600_000) : signedAt,
          },
        });
      }
      // ~10% of instalment buyers are behind by 1–2 payments → OVERDUE rows for the control centre
      const missLast = plan.planType === "INSTALLMENT" && r() < 0.1 ? 1 + Math.floor(r() * 2) : 0;
      const { allPaid } = await seedPayments(purchase.id, schedule, { paid: !reserved, firstPaidAt: paidAt, missLast, r });
      if (!reserved && plan.planType === "INSTALLMENT") await prisma.purchase.update({ where: { id: purchase.id }, data: { status: allPaid ? "COMPLETED" : "PAID" } });
      deals++;
    }
  }
  console.log(`✓ history: ${deals} consistent deals with payment schedules`);

  // 120 days of product analytics with weekly growth and a Tashkent day rhythm
  const published = await prisma.project.findMany({ where: { published: true }, select: { id: true, featured: true, trustScore: true } });
  const hourWeight = [1, 0.5, 0.3, 0.2, 0.2, 0.4, 0.8, 1.6, 2.6, 3.4, 3.8, 3.9, 3.6, 3.4, 3.6, 3.8, 3.9, 4.1, 4.6, 5.2, 5.4, 4.8, 3.4, 2];
  const hourTotal = hourWeight.reduce((a, b) => a + b, 0);
  const pickHour = () => {
    let x = r() * hourTotal;
    for (let h = 0; h < 24; h++) if ((x -= hourWeight[h]!) <= 0) return h;
    return 20;
  };
  const events: Prisma.ActivityEventCreateManyInput[] = [];
  let totalViews = 0;
  for (let d = 120; d >= 0; d--) {
    const day = new Date(now - d * DAY);
    const dow = day.getUTCDay();
    const growth = 1 + (120 - d) / 160; // steady growth
    const weekend = dow === 0 || dow === 6 ? 1.25 : 1;
    const at = () => {
      const t = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), pickHour() - 5, Math.floor(r() * 60), Math.floor(r() * 60)));
      return t.getTime() > now ? new Date(now - Math.floor(r() * 3600_000)) : t;
    };
    for (const p of published) {
      const base = (p.featured ? 26 : 12) * (0.6 + p.trustScore / 160);
      const n = Math.round(base * growth * weekend * (0.7 + r() * 0.6));
      for (let k = 0; k < n; k++) {
        // ~16% of sessions belong to signed-in buyers (stable session → user mapping)
        const sid = Math.floor(r() * 4000);
        events.push({ type: "project_view", projectId: p.id, sessionId: `s${sid}`, userId: sid < 640 ? buyers[sid % buyers.length]!.id : null, createdAt: at() });
      }
      totalViews += n;
      if (r() < 0.55) events.push({ type: "favorite", projectId: p.id, createdAt: at() });
    }
    for (let k = 0; k < Math.round(6 * growth * (0.6 + r() * 0.8)); k++)
      events.push({ type: "certificate_lookup", projectId: published[Math.floor(r() * published.length)]!.id, userId: r() < 0.3 ? buyers[Math.floor(r() * buyers.length)]!.id : null, meta: { found: r() < 0.93 }, createdAt: at() });
    for (let k = 0; k < Math.round(1.5 * growth * r() * 2); k++)
      events.push({ type: "file_check", projectId: published[Math.floor(r() * published.length)]!.id, meta: { match: r() < 0.88 }, createdAt: at() });
    for (let k = 0; k < Math.round(5 * growth * (0.5 + r())); k++)
      events.push({ type: "search", meta: { q: ["Yunusobod", "3 xonali", "Samarqand", "biznes markaz", "metro yonida", "yangi uy"][Math.floor(r() * 6)] }, createdAt: at() });
  }
  // demo accounts: a believable personal trail (the admin "activity" page shows it)
  const demoBuyer = await prisma.user.findUnique({ where: { phone: "+998901000004" } });
  const demoCompany = await prisma.user.findUnique({ where: { phone: "+998901000005" } });
  const slugIds = new Map((await prisma.project.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]));
  const trail: [typeof demoBuyer, string[]][] = [
    [demoBuyer, ["chilonzor-smart-city", "oltin-vodiy-residence", "mirzo-ulugbek-park", "registon-view"]],
    [demoCompany, ["fargona-business-tower", "chilonzor-smart-city", "namangan-gardens"]],
  ];
  for (const [u, slugs] of trail) {
    if (!u) continue;
    for (let d = 89; d >= 0; d--) {
      if (r() < 0.55) continue; // active roughly every other day
      const day = new Date(now - d * DAY);
      const n = 1 + Math.floor(r() * 5);
      for (let k = 0; k < n; k++) {
        const t = new Date(day.getTime() - Math.floor(r() * 10 * 3600_000));
        const pid = slugIds.get(slugs[Math.floor(r() * slugs.length)]!);
        const type = r() < 0.7 ? "project_view" : r() < 0.6 ? "model_open" : "certificate_lookup";
        events.push({ type, projectId: pid ?? null, userId: u.id, sessionId: `demo-${u.id.slice(-6)}-${d}`, createdAt: t, ...(type === "certificate_lookup" ? { meta: { found: true } } : {}) });
      }
    }
  }
  for (let i = 0; i < events.length; i += 2000) await prisma.activityEvent.createMany({ data: events.slice(i, i + 2000) });

  // login history (sessions) — expired/revoked past sessions + the latest one, with real-looking devices
  const DEVICES = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 14; Redmi Note 13 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  ];
  const ipPool = ["213.230.", "84.54.", "95.214.", "185.139.", "195.158."];
  const sessionUsers = [
    ...(await prisma.user.findMany({ where: { phone: { in: ["+998901000001", "+998901000002", "+998901000003", "+998901000004", "+998901000005"] } }, select: { id: true } })).map((u) => ({ id: u.id, logins: 14 })),
    ...buyers.map((b) => ({ id: b.id, logins: 1 + Math.floor(r() * 4) })),
  ];
  const sessionRows: Prisma.SessionCreateManyInput[] = [];
  const lastLogin = new Map<string, Date>();
  for (const su of sessionUsers) {
    const device = DEVICES[Math.floor(r() * DEVICES.length)]!;
    const ipBase = `${ipPool[Math.floor(r() * ipPool.length)]}${Math.floor(r() * 250)}.`;
    for (let k = 0; k < su.logins; k++) {
      const createdAt = new Date(now - Math.floor(r() * 85 * DAY) - 3600_000);
      sessionRows.push({
        userId: su.id,
        refreshTokenHash: sha256(`seed-session-${su.id}-${k}-${r()}`),
        userAgent: r() < 0.8 ? device : DEVICES[Math.floor(r() * DEVICES.length)]!,
        ip: `${ipBase}${Math.floor(r() * 250)}`,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + 30 * DAY),
        revokedAt: r() < 0.5 ? new Date(createdAt.getTime() + Math.floor(r() * 5 * DAY)) : null,
      });
      if (!lastLogin.has(su.id) || lastLogin.get(su.id)! < createdAt) lastLogin.set(su.id, createdAt);
    }
  }
  await prisma.session.createMany({ data: sessionRows });
  for (const [id, at] of lastLogin) await prisma.user.update({ where: { id }, data: { lastLoginAt: at } });
  // keep the denormalised counter consistent with the events
  for (const p of published) {
    const views = await prisma.activityEvent.count({ where: { type: "project_view", projectId: p.id } });
    await prisma.project.update({ where: { id: p.id }, data: { views } });
  }
  console.log(`✓ analytics: ${events.length} events (${totalViews} views)`);
  for (const p of projects) await recalculateTrust(p.id);
}

async function main() {
  await seedBase();
  const demo = (process.env.SEED_DEMO ?? "true") === "true";
  if (demo && (await prisma.project.count()) === 0) {
    console.log("Seeding demo data…");
    await seedDemo();
    await seedHistory();
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closeBus(); // audit() publishes to RabbitMQ — close the connection so the process can exit
    process.exit(process.exitCode ?? 0);
  });
