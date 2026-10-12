# EKA BUILD — Loyiha rejasi (Master Plan)

> **Missiya:** Qurilish obyektlarini sotish jarayonini shaffof, tekshiriladigan va firibgarlikdan himoyalangan qilish.
> Xaridor (jismoniy va yuridik shaxs) obyektni sotib olishdan oldin uning ruxsatnomalari, sertifikatlari,
> kadastr ma'lumoti, chizmalari, 3D modeli va qurilish jarayonini **mustaqil tekshira oladi**.

---

## 1. Rollar

| Rol | Kim | Asosiy imkoniyatlar |
|---|---|---|
| `BUYER` | Jismoniy shaxs / yuridik shaxs xodimi | Katalog, 3D ko'rish, tekshirish, xarid, shartnoma, E-IMZO, fayllarni yuklab olish |
| `DEVELOPER` | Quruvchi kompaniya (zastroychik) | Obyekt yaratish, hujjat / chizma / 3D yuklash, ishlar jurnali, xonadonlar |
| `INSPECTOR` | Nazoratchi (davlat / mustaqil) | Tekshiruv dalolatnomalari, sertifikat tasdiqlash, kadastr solishtirish |
| `ADMIN` / `SUPERADMIN` | Platforma | Moderatsiya, tashkilotlarni tasdiqlash, shablonlar, qoidalar, audit |

## 2. Arxitektura

```
                       ┌──────────────── Internet ───────────────┐
                       │ ekabuild.uz  app.  admin.  api.         │
                       └────────────────────┬────────────────────┘
                                            │ :80/:443 (TLS, HTTP/2, gzip, rate-limit)
                                     ┌──────▼──────┐
                                     │    NGINX    │  load balancer (least_conn)
                                     └──┬───────┬──┘
                        /  (Next.js)    │       │   /api/*  (Fastify)
                 ┌──────────────┬───────┘       └──────┬──────────────┐
             ┌───▼───┐      ┌───▼───┐              ┌───▼───┐      ┌───▼───┐
             │ web-1 │      │ web-2 │              │ api-1 │      │ api-2 │
             └───────┘      └───────┘              └───┬───┘      └───┬───┘
                                                       └─────┬────────┘
                ┌──────────────┬─────────────┬───────────────┼──────────────┬──────────────┐
            ┌───▼───┐     ┌────▼────┐   ┌────▼─────┐   ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
            │ MySQL │     │  Redis  │   │ RabbitMQ │   │  Storage  │  │ E-IMZO    │  │ worker-1  │
            │  8.4  │     │ cache + │   │  events  │──▶│ volume/S3 │  │ server    │  │ worker-2  │
            │Prisma │     │ limiter │   │  + DLQ   │   │ (fayllar) │  │ (verify)  │  │ (consumer)│
            └───────┘     └─────────┘   └──────────┘   └───────────┘  └───────────┘  └───────────┘
```

* **Monorepo** (pnpm workspaces):
  * `apps/web` — Next.js 15 (App Router, RSC, TypeScript, Tailwind v4, Motion, React Three Fiber, Leaflet).
    Bitta ilova, subdomen bo'yicha yo'naltiriladi: landing (`ekabuild.uz`), kabinet (`app.ekabuild.uz`), admin (`admin.ekabuild.uz`).
  * `apps/api` — Fastify 5 + Prisma 6 + MySQL 8.4 + Zod. Stateless → gorizontal masshtablanadi.
  * `packages/shared` — umumiy tiplar, enumlar, Zod sxemalari, formatlash.
* **Bir domen — bitta cookie:** har bir web-hostda `/api/*` nginx orqali API ga proksi qilinadi → CORS yo'q, cookie `.ekabuild.uz` da.
* **Fayllar:** umumiy volume (`local` drayver) yoki istalgan S3-mos ombor (`s3` drayver). Yuklab olish faqat API orqali, ruxsat tekshiruvi bilan (sotib olgan / egasi / admin). Har bir faylning SHA-256 hashi saqlanadi (o'zgartirilmaganini isbotlash).
* **Load balancing:** `api-1/api-2`, `web-1/web-2` konteynerlari, nginx `least_conn` + passiv health-check (`max_fails`), keepalive.
* **RabbitMQ (event bus):** API muhim hodisalarni `eka.events` (topic exchange) ga yuboradi; `worker` servis(lar)i
  navbatlardan o'qiydi: `notifications` (bildirishnoma + email/SMS), `trust` (ishonch balini qayta hisoblash), `cadastre`
  (kadastr tekshiruvi), `audit` (tashqi arxiv), `files` (hash/preview). Har navbatda retry (TTL) + dead-letter (`*.dlq`).
  Worker gorizontal masshtablanadi (`prefetch` bilan adolatli taqsimlash).
* **Redis:** API replikalari orasida umumiy rate-limit va kesh (ommaviy statistikalar, katalog).
* **Migratsiya:** alohida `migrate` servis (`prisma migrate deploy` + seed), API undan keyin ishga tushadi.

## 3. Ma'lumotlar modeli (asosiy)

`User` · `Organization` (STIR/INN, turi, tasdiq holati) · `Project` (obyekt: manzil, koordinata, kadastr raqami, holat, progress, ishonch bali)
· `Unit` (xonadon / tijorat joyi, shaxmatka) · `FileObject` (ombor kaliti, sha256) · `Document` (ruxsatnoma, sertifikat, chizma, 3D, qoida; kirish darajasi PUBLIC/BUYERS/PRIVATE)
· `Certificate` (raqam, beruvchi, muddat, holat, QR bilan ochiq tekshiruv) · `CadastreCheck` · `Inspection` (nazorat dalolatnomasi)
· `ProgressUpdate` (qilingan ishlar: `CONSTRUCTION` va topshirilgandan keyingi `POST_HANDOVER`) · `Purchase` · `Contract` + `ContractTemplate`
· `Signature` (E-IMZO PKCS#7) · `Rule` (qoidalar, ShNQ/QMQ) · `Complaint` (shikoyat / firibgarlik signali) · `Notification` · `AuditLog` (hash-zanjir, o'zgartirib bo'lmaydi) · `Session`.

## 4. Ishonch mexanizmlari (firibgarlikka qarshi)

1. **Tashkilot tasdiqlash** — STIR, litsenziya, direktor; admin tasdiqlamaguncha obyekt e'lon qilinmaydi.
2. **Sertifikat reyestri** — har bir ruxsatnoma/sertifikatda raqam + QR → `ekabuild.uz/verify/<kod>` ochiq sahifa.
3. **Kadastr solishtirish** — kadastr raqami, manzil va koordinatalar provayder bilan solishtiriladi (adapter: `mock` → keyin rasmiy API).
4. **Inspeksiyalar** — nazoratchi dalolatnomalari, rasm-dalillar bilan.
5. **Ishonch bali (Trust Score 0–100)** — tasdiqlangan hujjatlar, kadastr mosligi, inspeksiyalar, kechikish, shikoyatlardan hisoblanadi, tafsiloti ko'rsatiladi.
6. **Hujjat hashlari** — fayl SHA-256 si saqlanadi, shartnoma matni hash bilan imzolanadi.
7. **E-IMZO** — shartnomani ikkala tomon ERI bilan imzolaydi (PKCS#7, server tomonda E-IMZO server orqali tekshiriladi).
8. **Audit log hash-zanjir** — har bir muhim amal oldingi yozuv hashi bilan bog'lanadi.
9. **Xavf signallari** — bitta xonadonni ikki marta sotish taqiqlanadi (DB unique + tranzaksiya), muddati o'tgan sertifikat ogohlantirishi.

## 5. Interfeys (UI/UX)

* **Brend:** logotip (oltin plita + "EKA" vertikal + "1" ko'rinishidagi bino kesimi + "BUILD") SVG qilib qayta chizildi.
  Ranglar: grafit `#0E0F11`, ko'mir `#17181B`, oltin `#C9A464 → #E6CB8F`, tosh `#F4F1EA`.
  Shriftlar: *Manrope* (UI), *Cormorant Garamond* (premium sarlavhalar), *JetBrains Mono* (raqamlar/kodlar).
* **Splash** — logotip "qurilib" chiqadigan animatsiya (plita → harflar → kesim → BUILD).
* **Landing** — hero + aylanadigan 3D bino, "qanday ishlaydi", sertifikat tekshirish vidjeti, statistika, obyektlar, quruvchilar/xaridorlar uchun, FAQ, CTA.
* **Kabinet** — katalog (filtr + xarita), obyekt sahifasi (galereya, 3D, chizmalar, hujjatlar, kadastr, xarita, timeline, inspeksiyalar, shaxmatka, ishonch bali), xaridlarim, shartnomalar + E-IMZO, fayllarim, quruvchi paneli.
* **Admin** — KPI dashboard (grafiklar), tashkilotlar navbati, obyektlar moderatsiyasi, sertifikatlar, kadastr, inspeksiyalar, foydalanuvchilar, shartnoma shablonlari, qoidalar, shikoyatlar, audit log.
* Dark-premium tema, glassmorphism kartalar, micro-interaksiyalar, skeleton loaderlar, `prefers-reduced-motion` hurmati, mobilga moslashgan.

## 6. Bosqichlar

| # | Bosqich | Holat |
|---|---|---|
| 0 | Reja, brend, monorepo skeleti | ✅ |
| 1 | DB sxema (Prisma), seed demo ma'lumotlar | ✅ |
| 2 | API: auth, tashkilotlar, obyektlar, hujjatlar, fayllar, sertifikatlar, kadastr, inspeksiya, progress, xarid, shartnoma, E-IMZO, qoidalar, admin, audit | ✅ |
| 3 | Web: dizayn tizimi, splash, landing | ✅ |
| 4 | Web: kabinet (katalog, obyekt, 3D, xarid, imzolash, fayllar, quruvchi paneli) | ✅ |
| 5 | Web: admin panel | ✅ |
| 6 | RabbitMQ event bus + worker, Redis kesh/limit | ✅ |
| 7 | Docker compose, nginx LB, TLS, deploy skriptlari | ✅ |
| 8 | Serverga deploy (`ekabuild.uz` + subdomenlar) | ⏳ server ma'lumoti kutilmoqda |
| 9 | Rasmiy integratsiyalar: kadastr API, E-IMZO server kalitlari, to'lov (Click/Payme), SMS (Eskiz) | 🔜 |

## 7. Deploy uchun kerak bo'ladigan narsalar

1. Server IP (Ubuntu 22.04/24.04, kamida 4 vCPU / 8 GB RAM), SSH kirish.
2. DNS `A` yozuvlari: `ekabuild.uz`, `www`, `app`, `admin`, `api` → server IP.
3. E-IMZO API kaliti (`ekabuild.uz` domeni uchun) va E-IMZO server manzili.
4. (ixtiyoriy) SMTP / SMS provayder, to'lov tizimi kalitlari.

Batafsil: [`deploy/README.md`](deploy/README.md).
