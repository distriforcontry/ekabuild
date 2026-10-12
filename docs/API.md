# EKA BUILD API — v1 contract

Base path: **`/api/v1`** (same origin for web via nginx / Next rewrites; also `https://api.ekabuild.uz/api/v1`).

* JSON in/out. Dates are ISO strings. `Decimal` money fields are **strings** (e.g. `"845000000.00"`).
* Errors: HTTP status + `{ "error": { "code": "NOT_FOUND", "message": "…", "details"?: any } }`.
* Lists: `{ items: T[], total, page, pageSize }` (`?page=1&pageSize=12`).
* Auth: httpOnly cookies `eka_at` (access JWT, 60 min) and `eka_rt` (refresh, 30 days, path `/api/v1/auth`).
  Also accepts `Authorization: Bearer <access>`. On `401` the client calls `POST /auth/refresh` once and retries.
* File URLs returned by the API are relative: `/api/v1/files/<id>` (add `?download=1` to force attachment).

Legend: 🌐 public · 🔐 any logged-in user · 🏗 DEVELOPER (own org) · 🔎 INSPECTOR/ADMIN · 🛡 ADMIN/SUPERADMIN

---

## Shared shapes

```ts
type User = { id; phone; email|null; phoneVerifiedAt|null; fullName; pinfl|null; role: Role; status; locale; avatarUrl|null;
  organization: Org|null; createdAt }
type Org = { id; type: OrgType; name; legalName|null; tin; director|null; phone|null; email|null; website|null;
  address|null; region|null; licenseNumber|null; logoUrl|null; description|null; foundedYear|null;
  status: VerificationStatus; verifiedAt|null }

type ProjectCard = { id; slug; name; tagline|null; type; status; region; district|null; address; lat; lng;
  coverUrl|null; floors; progress; priceFrom|null; pricePerSqm|null; currency; trustScore;
  verificationStatus; plannedEndDate|null; unitsTotal; unitsAvailable;
  developer: { id; name; logoUrl|null; status } }

type FileRef = { id; url; originalName; mime; size; sha256 }

type DocumentItem = { id; type: DocumentType; title; description|null; number|null; issuer|null; issuedAt|null;
  expiresAt|null; access: AccessLevel; status: VerificationStatus; verifiedAt|null; version; createdAt;
  locked: boolean;            // true → viewer has no access; file is null
  file: FileRef | null }

type CertificateItem = { id; code; type: CertificateType; number; issuer; issuedAt; validUntil|null;
  status: CertificateStatus; verifiedAt|null; note|null; documentId|null }

type CadastreCheckItem = { id; cadastreNumber; provider; result: CadastreResult; distanceM|null;
  details: { registryAddress?; registryArea?; registryLat?; registryLng?; owner?; purpose?; messages: string[] };
  createdAt }

type InspectionItem = { id; type; result; date; summary; notes|null;
  violations: { code; text; severity: 'LOW'|'MEDIUM'|'HIGH'; resolved: boolean }[];
  inspector: { id; fullName; organization: string|null }; files: FileRef[] }

type ProgressItem = { id; phase: 'CONSTRUCTION'|'POST_HANDOVER'; title; body|null; stage|null; percent|null; date;
  author: { fullName }|null; media: FileRef[] }

type UnitItem = { id; number; section; floor; type; rooms; area; price; status; planUrl|null; features|null }

type ProjectDetail = ProjectCard & { description|null; cadastreNumber|null; landArea|null; totalArea|null;
  sections; startDate|null; actualEndDate|null; gallery: string[]; massing: MassingParams|null;
  model3d: FileRef|null; packagePrice|null; trustBreakdown: TrustBreakdownItem[]; views;
  developer: Org & { projectsCount: number };
  certificates: CertificateItem[]; documents: DocumentItem[]; cadastre: CadastreCheckItem|null;
  inspections: InspectionItem[]; progressUpdates: ProgressItem[];
  unitsSummary: { AVAILABLE: number; RESERVED: number; SOLD: number };
  viewer: { authenticated: boolean; isFavorite: boolean; hasAccess: boolean; isOwner: boolean;
            purchases: { id; number; kind; status; unitId|null }[] } }

type PurchaseItem = { id; number; kind; status; amount; currency; paidAt|null; createdAt;
  project: { id; slug; name; coverUrl|null; address }; unit: UnitItem|null;
  buyer: { id; fullName; email }; buyerOrg: { id; name; tin }|null;
  contract: { id; number; status; signedAt|null }|null }

type ContractDetail = { id; number; title; body /* markdown */; bodyHash; status; signedAt|null; createdAt;
  purchase: PurchaseItem;
  signatures: { id; role: SignerRole; method: 'EIMZO'|'MOCK'; signerName|null; signerTin|null; signerPinfl|null;
    certSerial|null; certValidTo|null; verified: boolean; signedAt }[];
  viewerRole: SignerRole|null;  // which role the current user may sign as (null → can't sign)
  canSign: boolean }
```

---

## Auth — `/auth` (phone + SMS OTP)

Phone format everywhere: `+998XXXXXXXXX`. OTP = 6 digits, valid 2 min, resend after 60 s, max 5 attempts.
SMS goes through RabbitMQ → worker → provider (Eskiz.uz; `SMS_PROVIDER=mock` logs the code and returns `devCode` in the response).

| Method | Path | Body | Response |
|---|---|---|---|
| 🌐 POST | `/auth/otp/send` | `{ phone, purpose: 'REGISTER'\|'LOGIN'\|'RESET' }` | `{ sent: true, expiresIn, resendIn, devCode? }` · 409 `PHONE_TAKEN` (register) · 404 `USER_NOT_FOUND` (login/reset) · 429 `TOO_MANY` |
| 🌐 POST | `/auth/otp/verify` | `{ phone, code, purpose }` | REGISTER/RESET → `{ verificationToken }` · LOGIN → `{ user }` + cookies · 400 `INVALID_CODE` / `CODE_EXPIRED` |
| 🌐 POST | `/auth/register` | `{ verificationToken, fullName, password, email?, accountType: 'INDIVIDUAL'\|'COMPANY'\|'DEVELOPER', organization?: { name, tin, director?, address?, region? } }` | `{ user }` + cookies |
| 🌐 POST | `/auth/login` | `{ login /* phone or email */, password }` | `{ user }` + cookies · 401 `INVALID_CREDENTIALS` · 403 `BLOCKED` |
| 🌐 POST | `/auth/password/reset` | `{ verificationToken, password }` | `{ ok: true }` |
| 🌐 POST | `/auth/refresh` | – | `{ user }` + cookies |
| 🔐 POST | `/auth/logout` | – | `{ ok: true }` |
| 🔐 GET | `/auth/me` | – | `{ user }` |
| 🔐 PATCH | `/auth/me` | `{ fullName?, email?, pinfl?, locale? }` | `{ user }` |
| 🔐 POST | `/auth/password` | `{ current, next }` | `{ ok: true }` |

After login the web redirects by role: ADMIN/SUPERADMIN → `/admin`, DEVELOPER → `/app/developer`, INSPECTOR → `/app/inspector`, BUYER → `/app`
(`homeForRole` in `apps/web/src/lib/roles.ts`).

Demo accounts (seed, password **`Eka12345!`**, phone login):
`+998901000001` SUPERADMIN · `+998901000002` DEVELOPER · `+998901000003` INSPECTOR · `+998901000004` BUYER (individual) · `+998901000005` BUYER (legal entity).

## Public — catalog & trust

| | Path | Notes |
|---|---|---|
| 🌐 GET | `/stats/public` | `{ projects, developers, verifiedCertificates, inspections, unitsSold, avgTrust, regions }` |
| 🌐 GET | `/projects` | query `q, region, status, type, developerId, minPrice, maxPrice, featured, sort=trust\|new\|price_asc\|price_desc\|progress, page, pageSize` → `Paginated<ProjectCard>` (only published) |
| 🌐 GET | `/projects/map` | `{ id, slug, name, lat, lng, trustScore, status, coverUrl }[]` |
| 🌐 GET | `/projects/:slug` | `ProjectDetail` (owner/admin can see unpublished) |
| 🌐 GET | `/projects/:slug/units` | `UnitItem[]` sorted by section, floor, number |
| 🌐 POST | `/projects/:id/view` | increments view counter |
| 🔐 POST | `/projects/:id/favorite` | toggle → `{ favorite: boolean }` |
| 🔐 GET | `/favorites` | `ProjectCard[]` |
| 🌐 GET | `/developers` | verified developer orgs `Org & { projectsCount, avgTrust }` |
| 🌐 GET | `/developers/:id` | `Org & { projects: ProjectCard[] }` |
| 🌐 GET | `/verify/:code` | certificate by public code (QR) → `{ certificate: CertificateItem, project: { slug, name, address, region, developer: { name, tin, status } }, document: { title, sha256 }|null }` |
| 🌐 GET | `/verify?number=…` | search certificates by number → `{ items: same shape[] }` |
| 🌐 POST | `/verify/file` | multipart `file` → `{ match: boolean, sha256, document?: { title, type, status, project: { slug, name } } }` — proves a PDF is the exact registered original |
| 🌐 GET | `/rules` | `?category` → `Rule[]` `{ id, slug, title, category, code, summary, sourceUrl }` |
| 🌐 GET | `/rules/:slug` | full rule with `body` (markdown) |
| 🌐 POST | `/complaints` | `{ projectId?, category, message, contact? }` → `{ id }` |

## Files

| | Path | Notes |
|---|---|---|
| 🌐/🔐 GET | `/files/:id` | streams file if allowed (PUBLIC doc, project cover/model/progress media, buyer with paid purchase, owner, inspector/admin). `?download=1` → attachment. |
| 🏗🔎 POST | `/files` | multipart `file` (≤ 200 MB; pdf, png, jpg, webp, glb, gltf, dwg, dxf, ifc, zip) → `FileRef` |

## Buyer

| | Path | Notes |
|---|---|---|
| 🔐 POST | `/purchases` | `{ projectId, kind: 'UNIT'\|'DOCUMENT_PACKAGE', unitId? }` → `{ purchase: PurchaseItem }` (reserves unit, creates contract) |
| 🔐 GET | `/purchases` | my purchases → `PurchaseItem[]` |
| 🔐 GET | `/purchases/:id` | `PurchaseItem` |
| 🔐 POST | `/purchases/:id/cancel` | only DRAFT / PENDING_SIGNATURES |
| 🔐 POST | `/purchases/:id/pay` | demo payment, requires SIGNED → PAID (unit → SOLD, files unlocked) |
| 🔐 GET | `/contracts/:id` | `ContractDetail` (buyer, seller org members, admin) |
| 🔐 GET | `/contracts/:id/challenge` | `{ data: base64, text, mode: 'EIMZO'\|'MOCK' }` — the exact payload to sign |
| 🔐 POST | `/contracts/:id/sign` | `{ method: 'EIMZO'\|'MOCK', pkcs7: string }` → `ContractDetail` |
| 🔐 GET | `/me/files` | documents unlocked via purchases → `{ project: { slug, name }, documents: DocumentItem[] }[]` |
| 🔐 GET | `/me/feed` | progress updates of purchased/favorited projects → `(ProgressItem & { project: { slug, name } })[]` |
| 🔐 GET | `/notifications` | `{ items, unread }` |
| 🔐 POST | `/notifications/read-all` | |

## Developer — `/dev` 🏗

| | Path | Notes |
|---|---|---|
| GET | `/dev/stats` | `{ projects, unitsSold, unitsAvailable, revenue, pendingSignatures, avgTrust }` |
| GET | `/dev/projects` | own projects (`ProjectCard & { published, verificationStatus }`) |
| POST | `/dev/projects` | create: `{ name, tagline?, description?, type, status, region, district?, address, lat, lng, cadastreNumber?, landArea?, totalArea?, floors, sections, priceFrom?, pricePerSqm?, packagePrice?, startDate?, plannedEndDate?, coverUrl?, massing? }` |
| PATCH | `/dev/projects/:id` | partial of the above + `progress` |
| POST | `/dev/projects/:id/submit` | send for moderation |
| POST | `/dev/projects/:id/units` | `{ units: UnitInput[] }` or `{ generate: { sections, floors, perFloor, areaMin, areaMax, pricePerSqm } }` |
| PATCH | `/dev/units/:id` | `{ price?, status?, area?, rooms?, planUrl? }` |
| POST | `/dev/projects/:id/documents` | `{ type, title, description?, number?, issuer?, issuedAt?, expiresAt?, access, fileId }` |
| DELETE | `/dev/documents/:id` | |
| POST | `/dev/projects/:id/certificates` | `{ type, number, issuer, issuedAt, validUntil?, documentId? }` |
| POST | `/dev/projects/:id/progress` | `{ phase, title, body?, stage?, percent?, date, fileIds?: string[] }` |
| POST | `/dev/projects/:id/model3d` | `{ fileId }` (GLB/GLTF) |
| GET | `/dev/purchases` | purchases of own projects → `PurchaseItem[]` |

## Inspection — 🔎

| | Path | Notes |
|---|---|---|
| POST | `/inspections` | `{ projectId, type, result, date, summary, notes?, violations?, fileIds? }` |
| POST | `/cadastre/check` | `{ projectId }` → `CadastreCheckItem` (also allowed for project owner) |
| PATCH | `/certificates/:id/verify` | `{ status: 'VERIFIED'\|'REJECTED'\|'REVOKED', note? }` |
| PATCH | `/documents/:id/verify` | `{ status: 'VERIFIED'\|'REJECTED', rejectReason? }` |

## Admin — `/admin` 🛡

| | Path | Notes |
|---|---|---|
| GET | `/admin/stats` | `{ kpi: { users, organizations, projects, purchases, revenue, openComplaints, pendingOrgs, pendingProjects, pendingCertificates, pendingDocuments }, purchasesByMonth: { month, count, amount }[], projectsByStatus: { status, count }[], projectsByRegion: { region, count }[], trustDistribution: { bucket, count }[], recentAudit: AuditItem[] }` |
| GET | `/admin/organizations` | `?status&type&q&page` → `Paginated<Org & { membersCount, projectsCount }>` |
| PATCH | `/admin/organizations/:id` | `{ status, rejectReason? }` |
| GET | `/admin/projects` | `?verification&status&q&page` → `Paginated<ProjectCard & { published, featured, verificationStatus, createdAt }>` |
| PATCH | `/admin/projects/:id` | `{ verificationStatus?, published?, featured?, status? }` |
| POST | `/admin/projects/:id/recalculate-trust` | → `{ trustScore, trustBreakdown }` |
| GET | `/admin/certificates` | `?status&page` → `Paginated<CertificateItem & { project: { slug, name } }>` |
| GET | `/admin/documents` | `?status&page` → `Paginated<DocumentItem & { project: { slug, name } }>` |
| GET | `/admin/users` | `?q&role&page` → `Paginated<User>` |
| PATCH | `/admin/users/:id` | `{ role?, status? }` |
| GET | `/admin/purchases` | `?status&page` → `Paginated<PurchaseItem>` |
| GET | `/admin/complaints` | `?status&page` → `Paginated<Complaint & { project: { slug, name }|null }>` |
| PATCH | `/admin/complaints/:id` | `{ status, resolution? }` |
| GET/POST | `/admin/templates` | contract templates `{ id, key, name, kind, body, version, active }` |
| PATCH | `/admin/templates/:id` | |
| POST | `/admin/rules` · PATCH/DELETE `/admin/rules/:id` | rules CRUD |
| GET | `/admin/audit` | `?entity&actorId&page` → `Paginated<AuditItem>` `{ id, action, entity, entityId, meta, ip, hash, prevHash, createdAt, actor: { fullName, email }|null }` |
| GET | `/admin/audit/verify` | `{ ok: boolean, checked: number, brokenAt: string|null }` |

## Support chat (real-time)

| | Path | Notes |
|---|---|---|
| 🌐 POST | `/support/threads` | `{ body, subject?, guestName?, guestPhone? }` → `{ thread: SupportThread, messages: SupportMessage[], guestToken? }` (guests get a token; store it in localStorage) |
| 🌐 GET | `/support/threads/mine` | session or header `x-guest-token` → `{ thread: SupportThread|null, messages: SupportMessage[] }` (latest open thread) |
| 🌐 POST | `/support/threads/:id/messages` | `{ body }` REST fallback when the socket is down → `SupportMessage` |
| 🌐 WS | `/support/ws` | `?guestToken=` for guests; protocol in `apps/web/src/lib/realtime.ts` |
| 🛡 GET | `/admin/support/threads` | `?status&q&page` → `Paginated<SupportThread>` |
| 🛡 GET | `/admin/support/threads/:id` | `{ thread, messages }` (marks as read for agents) |
| 🛡 PATCH | `/admin/support/threads/:id` | `{ status?: 'OPEN'\|'PENDING'\|'CLOSED', assignedToId? }` |
| 🛡 GET | `/admin/support/stats` | `{ open, pending, closedToday, agentsOnline, avgFirstResponseMin }` |

Types: see `SupportThread` / `SupportMessage` in `apps/web/src/lib/types.ts`.

## Health

`GET /health` → `{ status: 'ok', instance, uptime, db: 'up' }` (used by nginx / docker healthchecks; also at `/api/v1/health`).

## Inspector queue

`GET /inspector/queue` 🔎 → `{ certificates: (CertificateItem & { project: { slug, name } })[], documents: { id, type, title, number, issuer, status, createdAt, project: { slug, name }, file: FileRef }[] }` — pending items awaiting verification.
