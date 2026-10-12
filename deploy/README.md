# EKA BUILD — serverga deploy qilish

## Kerakli narsalar

| # | Nima | Izoh |
|---|---|---|
| 1 | Server | Ubuntu 22.04/24.04, kamida **4 vCPU / 8 GB RAM / 80 GB SSD** (2 ta api, 2 ta web, 2 ta worker, MySQL, Redis, RabbitMQ) |
| 2 | DNS | `A` yozuvlar → server IP: `ekabuild.uz`, `www`, `cabinet`, `admin`, `api` |
| 3 | SSH | root yoki sudo huquqli foydalanuvchi |
| 4 | (ixtiyoriy) | Eskiz.uz SMS akkaunti, E-IMZO API kaliti va E-IMZO server, S3 ombor |

## ⚡ Tez yo'l — bitta buyruq (89.39.95.156)

DNS tayyor: `ekabuild.uz → 89.39.95.156`, `www / cabinet / admin / api → CNAME ekabuild.uz`.

```bash
ssh root@89.39.95.156
git clone https://github.com/distriforcontry/ekabuild.git /opt/ekabuild && cd /opt/ekabuild
git checkout claude/wizardly-albattani-z0u3sf
DOMAIN=ekabuild.uz EMAIL=admin@ekabuild.uz ./deploy/scripts/bootstrap.sh
```

Skript Docker'ni o'rnatadi, xavfsiz `.env` yaratadi (SMS — mock/demo rejim, demo seed), SSL oladi va butun stackni
(nginx LB + 2×api + 2×web + 2×worker + MySQL + Redis + RabbitMQ + monitoring) ishga tushiradi. Bosh admin paroli
ekranga chiqariladi.

**Avtomatik deploy:** GitHub → Settings → Secrets: `SSH_HOST=89.39.95.156`, `SSH_USER`, `SSH_KEY` — shundan so'ng
`main` ga har push (yoki Actions → Deploy → Run) serverni zero-downtime yangilaydi.

## 1. Serverni tayyorlash (bir marta)

```bash
ssh root@SERVER_IP
curl -fsSL https://raw.githubusercontent.com/distriforcontry/ekabuild/main/deploy/scripts/server-setup.sh | bash
git clone https://github.com/distriforcontry/ekabuild.git /opt/ekabuild
cd /opt/ekabuild
cp .env.example .env && nano .env      # parollar, JWT_SECRET, domen
```

`.env` da albatta o'zgartiring:

```bash
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24)
MYSQL_PASSWORD=$(openssl rand -base64 24)
RABBITMQ_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 48)
SUPERADMIN_PHONE=+998XXXXXXXXX       # bosh admin telefoni
SUPERADMIN_PASSWORD=...               # kuchli parol
SEED_DEMO=false                       # productionda demo ma'lumotlarsiz
```

## 2. SSL va birinchi ishga tushirish

```bash
DOMAIN=ekabuild.uz EMAIL=admin@ekabuild.uz ./deploy/scripts/init-letsencrypt.sh
```

Skript: vaqtinchalik sertifikat yaratadi → image'larni build qiladi → stackni ko'taradi → Let's Encrypt'dan
5 ta nom uchun haqiqiy sertifikat oladi → nginx'ni qayta yuklaydi → avtomatik yangilashni (12 soatda bir) yoqadi.

## 3. Yangilash (zero-downtime)

```bash
cd /opt/ekabuild && ./deploy/scripts/deploy.sh main
```

Migratsiyalar → `api-1` → `api-2` → `web-1` → `web-2` ketma-ket yangilanadi; har biri `healthy` bo'lmaguncha
keyingisiga o'tilmaydi, nginx esa ishlayotgan replikaga yo'naltiradi.

## 4. Zaxira nusxa

```bash
crontab -e
30 3 * * * /opt/ekabuild/deploy/scripts/backup.sh >> /var/log/ekabuild-backup.log 2>&1
```

## Arxitektura

```
Internet ──▶ nginx :443 (TLS, HTTP/2, gzip, rate-limit, WebSocket)
              ├─ ekabuild.uz, cabinet., admin.   → web_pool  (web-1, web-2 · least_conn · keepalive)
              │      └─ /api/*                → api_pool  (same-origin cookie)
              └─ api.ekabuild.uz             → api_pool  (api-1, api-2)
api ──▶ MySQL 8.4 · Redis (limiter, kesh, chat fan-out) · RabbitMQ eka.events ──▶ worker-1, worker-2
```

* **Load balancing:** `deploy/nginx/templates/10-upstreams.conf.template` — `least_conn`, passiv health-check
  (`max_fails=3 fail_timeout=10s`), xatoda boshqa replikaga qayta urinish (`proxy_next_upstream`), Docker DNS bilan
  `resolve` (konteyner qayta ishga tushsa ham IP kuzatiladi). Har bir javobda `x-served-by` sarlavhasi qaysi replika
  xizmat qilganini ko'rsatadi.
* **Masshtablash:** `docker-compose.yml` ga `api-3` (yoki `web-3`, `worker-3`) blokini qo'shing va upstream'ga yozing.
* **RabbitMQ:** `eka.events` (topic) → `eka.sms`, `eka.notifications`, `eka.trust`, `eka.cadastre`, `eka.audit`
  navbatlari; har birida `*.retry` (eksponensial kechikish) va `*.dlq` (dead-letter). Boshqaruv paneli faqat
  `127.0.0.1:15672` da: `ssh -L 15672:127.0.0.1:15672 root@SERVER_IP`.
* **Fayllar:** `uploads` volume barcha api replikalariga umumiy. Ko'p serverli o'rnatishda `STORAGE_DRIVER=s3`.

## Integratsiyalarni yoqish

| Integratsiya | `.env` | Izoh |
|---|---|---|
| SMS (Eskiz.uz) | `SMS_PROVIDER=eskiz`, `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM` | Eskiz'da SMS shablonini tasdiqlatish kerak. `mock` rejimida kod javobda (`devCode`) qaytadi — faqat demo uchun! |
| E-IMZO | `EIMZO_MODE=eimzo`, `EIMZO_SERVER_URL`, `NEXT_PUBLIC_EIMZO_API_KEYS=ekabuild.uz:KALIT,cabinet.ekabuild.uz:KALIT` | API kaliti E-IMZO (soliq.uz) dan domen uchun olinadi; PKCS#7 imzolar E-IMZO server orqali tekshiriladi. |
| Kadastr | `CADASTRE_PROVIDER` | Hozir deterministik `mock`; rasmiy API ochilganda `apps/api/src/lib/cadastre.ts` dagi `CadastreProvider` ni amalga oshiring. |
| To'lov | — | `POST /purchases/:id/pay` demo; Click/Payme/Uzum callback'lari bilan almashtiriladi. |

## Foydali buyruqlar

```bash
docker compose ps                         # holat
docker compose logs -f api-1 worker-1     # loglar
docker compose exec mysql mysql -uroot -p # MySQL
curl -sI https://ekabuild.uz/api/v1/health | grep x-served-by   # qaysi replika javob berdi
```
