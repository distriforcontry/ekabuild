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

2.1. Shartnoma bahosi: **{{amount}}** ({{amountWords}}).

2.2. To'lov EKA BUILD platformasi orqali, shartnoma ikki tomonlama E-IMZO bilan imzolangandan so'ng amalga oshiriladi.

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
  ] as const) {
    await prisma.contractTemplate.upsert({ where: { key }, update: {}, create: { key, name, kind, body } });
  }
  for (const r of RULES) await prisma.rule.upsert({ where: { slug: r.slug }, update: {}, create: r });

  const phone = process.env.SUPERADMIN_PHONE ?? "+998901000001";
  if (!(await prisma.user.findUnique({ where: { phone } }))) {
    await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        email: "admin@ekabuild.uz",
        fullName: "Bosh administrator",
        passwordHash: await bcrypt.hash(process.env.SUPERADMIN_PASSWORD ?? DEMO_PASSWORD, 11),
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
  async function deal(buyerUser: typeof buyer, projectSlug: string, kind: "UNIT" | "DOCUMENT_PACKAGE", finalStatus: "PENDING_SIGNATURES" | "PAID" | "COMPLETED") {
    const project = await prisma.project.findUniqueOrThrow({ where: { slug: projectSlug }, include: { developer: true } });
    const unit = kind === "UNIT" ? await prisma.unit.findFirst({ where: { projectId: project.id, status: "AVAILABLE", floor: { gte: 6 } }, orderBy: { floor: "asc" } }) : null;
    const template = await prisma.contractTemplate.findUniqueOrThrow({ where: { key: kind === "UNIT" ? "unit-sale" : "document-package" } });
    const org = buyerUser.organizationId ? await prisma.organization.findUnique({ where: { id: buyerUser.organizationId } }) : null;
    const amount = Number(unit ? unit.price : project.packagePrice);
    const number = docNumber("C");
    const body = renderTemplate(
      template.body,
      contractContext({
        number,
        buyer: { fullName: buyerUser.fullName, phone: buyerUser.phone, pinfl: buyerUser.pinfl },
        buyerOrg: org ? { name: org.name, tin: org.tin } : null,
        seller: { name: project.developer.legalName ?? project.developer.name, tin: project.developer.tin, director: project.developer.director, address: project.developer.address },
        project: { name: project.name, address: project.address, cadastreNumber: project.cadastreNumber },
        unit: unit ? { number: unit.number, floor: unit.floor, area: unit.area, rooms: unit.rooms, section: unit.section } : null,
        amount,
        currency: "UZS",
      }),
    );
    const bodyHash = sha256(body);
    const signed = finalStatus !== "PENDING_SIGNATURES";
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
        paidAt: signed ? new Date() : null,
        contract: { create: { number, templateId: template.id, title: `${template.name} — ${project.name}${unit ? `, №${unit.number}` : ""}`, body, bodyHash, status: signed ? "SIGNED" : "PARTIALLY_SIGNED", signedAt: signed ? new Date() : null } },
      },
      include: { contract: true },
    });
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
        },
      });
    }
    await audit({ actorId: buyerUser.id, action: "PURCHASE_CREATE", entity: "Purchase", entityId: purchase.id, meta: { number: purchase.number, kind, contractHash: bodyHash } });
    return purchase;
  }
  await deal(buyer, "chilonzor-smart-city", "UNIT", "PAID");
  await deal(buyer, "oltin-vodiy-residence", "UNIT", "PENDING_SIGNATURES");
  await deal(companyUser, "farg-ona-business-tower".replace("farg-ona", "fargona"), "DOCUMENT_PACKAGE", "COMPLETED");
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
    data: { guestName: "Dilnoza", guestPhone: "+998901112233", subject: "Sertifikatni tekshirish", unreadForAgent: 1, lastMessageAt: new Date() },
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

async function main() {
  await seedBase();
  const demo = (process.env.SEED_DEMO ?? "true") === "true";
  if (demo && (await prisma.project.count()) === 0) {
    console.log("Seeding demo data…");
    await seedDemo();
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
