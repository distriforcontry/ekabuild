<p align="center"><img src="apps/web/public/brand/mark.svg" height="96" alt="EKA BUILD"/></p>

# EKA BUILD

**Qurilish obyektlarini ishonch bilan sotish va sotib olish platformasi.** Xaridor obyektni sotib olishdan oldin
ruxsatnoma va sertifikatlarni (ochiq QR kod bilan), kadastr ma'lumotini, nazorat dalolatnomalarini, 3D model va
chizmalarni tekshiradi; shartnoma E-IMZO bilan imzolanadi, qurilish va topshirilgandan keyingi ishlar kuzatib boriladi.

| | |
|---|---|
| 🌐 Landing | `ekabuild.uz` — splash, hero (Cycles render + interaktiv 3D), tekshirish vidjeti, katalog, quruvchilar, qoidalar |
| 🏠 Kabinet | `cabinet.ekabuild.uz` — xaridor / yuridik shaxs / quruvchi / nazoratchi panellari |
| 🛡 Admin | `admin.ekabuild.uz` — moderatsiya, real-time support inbox, shablonlar, audit (hash-zanjir) |
| 🔌 API | `api.ekabuild.uz/api/v1` — [docs/API.md](docs/API.md) |

## Imkoniyatlar

* **Telefon + SMS (OTP)** orqali ro'yxatdan o'tish/kirish (Eskiz.uz), rol bo'yicha yo'naltirish, parolni tiklash
* **Ishonch mexanizmlari:** sertifikat reyestri va QR tekshiruv, fayl SHA-256 bo'yicha asl nusxani isbotlash, kadastr
  solishtirish, inspeksiyalar, ochiq formula bilan **Trust Score**, ikki marta sotishga qarshi DB-darajasidagi qulf,
  shartnoma matni xeshi, **o'zgartirib bo'lmaydigan audit log**
* **3D:** Blender'da yaratilgan batafsil GLB modellar (qavatlar alohida — ajratish/izolyatsiya), HDRI yoritish, ishchi
  chizmalar va qavat rejalari ko'ruvchi, qurilish bosqichlari renderlari
* **E-IMZO** bilan shartnoma imzolash (PKCS#7, server tomonda tekshiruv), demo rejim
* **Real-time support chat** (WebSocket, replikalar orasida Redis pub/sub)
* **3 til:** o'zbek (lotin), ўзбек (кирилл — avtomatik transliteratsiya), русский · **2 tema:** tungi/kunduzgi
* **RabbitMQ** event bus + worker'lar (SMS, bildirishnomalar, ishonch bali, kadastr, audit arxivi), retry + DLQ
* **Monitoring:** Prometheus metrikalar, Grafana dashboard, Loki loglar, Alertmanager → Telegram
* **Deploy:** Docker Compose (nginx load balancer, TLS) yoki **Kubernetes** (HPA, KEDA, PDB, NetworkPolicy)

## Stack

`Next.js 15` · `React 19` · `Tailwind CSS 4` · `motion` · `iconsax` · `three.js / R3F` · `Fastify 5` · `Prisma 6` ·
`MySQL 8.4` · `Redis 7` · `RabbitMQ 4` · `nginx` · `Docker` · `Kubernetes` · `Prometheus / Grafana / Loki` · `Blender 5 (bpy)`

```
apps/
  api/        Fastify API + worker (RabbitMQ consumer) + Prisma schema, migrations, seed, demo assets
  web/        Next.js app (landing, catalog, cabinet, admin) — one app, subdomain routing in middleware
packages/
  shared/     enums, labels, formatters shared by api & web
tools/blender/  bpy pipeline: architectural GLB models + Cycles renders
deploy/       nginx LB, scripts (server setup, TLS, zero-downtime deploy, backup), monitoring, k8s
docs/API.md   API contract
```

## Lokal ishga tushirish

```bash
pnpm install
cp .env.example .env            # dev qiymatlar: DATABASE_URL=mysql://root:root@127.0.0.1:3306/ekabuild …
docker run -d --name eka-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=ekabuild mysql:8.4
docker run -d --name eka-redis -p 6379:6379 redis:7-alpine
docker run -d --name eka-rabbit -p 5672:5672 -p 15672:15672 rabbitmq:4-management-alpine
pnpm --filter @eka/api exec prisma migrate deploy && pnpm db:seed
pnpm dev                        # web :3000, api :4000 (+ `pnpm --filter @eka/api exec tsx src/worker/index.ts`)
```

Demo hisoblar (parol `Eka12345!`): `+998901000001` bosh admin · `+998901000002` quruvchi · `+998901000003` nazoratchi ·
`+998901000004` xaridor · `+998901000005` yuridik shaxs. SMS `mock` rejimida OTP kod javobda (`devCode`) qaytadi.

## Production

* Docker Compose + nginx load balancer: **[deploy/README.md](deploy/README.md)**
* Kubernetes: **[deploy/k8s/README.md](deploy/k8s/README.md)**
* Monitoring: `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d`

## 3D modellar va renderlar

```bash
python -m venv .venv && .venv/bin/pip install bpy==5.2.2
.venv/bin/python tools/blender/build_models.py --views hero,aerial --stages 15,40,65,85
node apps/web/scripts/optimize-models.mjs      # weld + quantize (≈3× kichikroq GLB)
```
