import type { Prisma } from "@prisma/client";

// Map Prisma rows to the DTOs described in docs/API.md. Decimal → string, Date → ISO (via JSON).

export const fileUrl = (id: string) => `/api/v1/files/${id}`;

export const dec = (v: Prisma.Decimal | null | undefined) => (v == null ? null : v.toFixed(2));

export function fileRef(f: { id: string; originalName: string; mime: string; size: number; sha256: string } | null | undefined) {
  if (!f) return null;
  return { id: f.id, url: fileUrl(f.id), originalName: f.originalName, mime: f.mime, size: f.size, sha256: f.sha256 };
}

export const userSelect = {
  id: true,
  phone: true,
  email: true,
  fullName: true,
  pinfl: true,
  role: true,
  status: true,
  locale: true,
  avatarUrl: true,
  phoneVerifiedAt: true,
  createdAt: true,
  organization: true,
} satisfies Prisma.UserSelect;

export type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export function userDto(u: UserRow) {
  return { ...u, organization: u.organization ? orgDto(u.organization) : null };
}

export function orgDto(o: Prisma.OrganizationGetPayload<object>) {
  return {
    id: o.id,
    type: o.type,
    name: o.name,
    legalName: o.legalName,
    tin: o.tin,
    director: o.director,
    phone: o.phone,
    email: o.email,
    website: o.website,
    address: o.address,
    region: o.region,
    licenseNumber: o.licenseNumber,
    logoUrl: o.logoUrl,
    description: o.description,
    foundedYear: o.foundedYear,
    status: o.status,
    verifiedAt: o.verifiedAt,
    rejectReason: o.rejectReason,
    blockedAt: o.blockedAt,
    blockReason: o.blockReason,
    archivedAt: o.archivedAt,
    createdAt: o.createdAt,
  };
}

/** A project visible in the public catalog: published, not archived, developer not blocked. */
export const listedProject = { published: true, archivedAt: null, developer: { blockedAt: null } } satisfies Prisma.ProjectWhereInput;

export const projectCardInclude = {
  developer: { select: { id: true, name: true, logoUrl: true, status: true, blockedAt: true } },
  _count: { select: { units: { where: { status: "AVAILABLE" } } } },
} satisfies Prisma.ProjectInclude;

export type ProjectCardRow = Prisma.ProjectGetPayload<{ include: typeof projectCardInclude }>;

export function projectCard(p: ProjectCardRow) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    type: p.type,
    status: p.status,
    region: p.region,
    district: p.district,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    coverUrl: p.coverUrl,
    floors: p.floors,
    progress: p.progress,
    priceFrom: dec(p.priceFrom),
    pricePerSqm: dec(p.pricePerSqm),
    currency: p.currency,
    trustScore: p.trustScore,
    verificationStatus: p.verificationStatus,
    plannedEndDate: p.plannedEndDate,
    unitsTotal: p.unitsTotal,
    unitsAvailable: p._count.units,
    developer: p.developer,
    published: p.published,
    featured: p.featured,
    archivedAt: p.archivedAt,
    createdAt: p.createdAt,
  };
}

export function certificateDto(c: Prisma.CertificateGetPayload<object>) {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    number: c.number,
    issuer: c.issuer,
    issuedAt: c.issuedAt,
    validUntil: c.validUntil,
    status: c.status !== "VERIFIED" || !c.validUntil || c.validUntil > new Date() ? c.status : "EXPIRED",
    verifiedAt: c.verifiedAt,
    note: c.note,
    documentId: c.documentId,
  };
}

type DocRow = Prisma.DocumentGetPayload<{ include: { file: true } }>;

export function documentDto(d: DocRow, canAccess: boolean) {
  const locked = !canAccess;
  return {
    id: d.id,
    type: d.type,
    title: d.title,
    description: d.description,
    number: d.number,
    issuer: d.issuer,
    issuedAt: d.issuedAt,
    expiresAt: d.expiresAt,
    access: d.access,
    status: d.status,
    verifiedAt: d.verifiedAt,
    rejectReason: d.rejectReason,
    version: d.version,
    archivedAt: d.archivedAt,
    createdAt: d.createdAt,
    locked,
    // the hash is always public: anyone can prove a file they hold is the registered original
    sha256: d.file.sha256,
    file: locked ? null : fileRef(d.file),
  };
}

export function unitDto(u: Prisma.UnitGetPayload<object>) {
  return {
    id: u.id,
    number: u.number,
    section: u.section,
    floor: u.floor,
    type: u.type,
    rooms: u.rooms,
    area: u.area,
    price: dec(u.price)!,
    status: u.status,
    planUrl: u.planUrl,
    features: u.features,
  };
}

export const purchaseInclude = {
  project: { select: { id: true, slug: true, name: true, coverUrl: true, address: true, developerId: true } },
  unit: true,
  buyer: { select: { id: true, fullName: true, phone: true } },
  buyerOrg: { select: { id: true, name: true, tin: true } },
  contract: { select: { id: true, number: true, status: true, signedAt: true } },
} satisfies Prisma.PurchaseInclude;

export type PurchaseRow = Prisma.PurchaseGetPayload<{ include: typeof purchaseInclude }>;

export function purchaseDto(p: PurchaseRow) {
  const { developerId: _d, ...project } = p.project;
  return {
    id: p.id,
    number: p.number,
    kind: p.kind,
    status: p.status,
    amount: dec(p.amount)!,
    currency: p.currency,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
    planType: p.planType,
    downPercent: p.downPercent,
    months: p.months,
    reservationUntil: p.reservationUntil,
    project,
    unit: p.unit ? unitDto(p.unit) : null,
    buyer: p.buyer,
    buyerOrg: p.buyerOrg,
    contract: p.contract,
  };
}

export const supportThreadInclude = {
  user: { select: { id: true, fullName: true, phone: true } },
  assignedTo: { select: { id: true, fullName: true } },
  messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderType: true, createdAt: true } },
} satisfies Prisma.SupportThreadInclude;

export type SupportThreadRow = Prisma.SupportThreadGetPayload<{ include: typeof supportThreadInclude }>;

export function supportThreadDto(t: SupportThreadRow) {
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    guestName: t.guestName,
    guestPhone: t.guestPhone,
    user: t.user,
    assignedTo: t.assignedTo,
    lastMessage: t.messages[0] ?? null,
    unreadForAgent: t.unreadForAgent,
    unreadForUser: t.unreadForUser,
    lastMessageAt: t.lastMessageAt,
    createdAt: t.createdAt,
  };
}

export function supportMessageDto(m: Prisma.SupportMessageGetPayload<{ include: { sender: { select: { id: true; fullName: true } } } }>) {
  return { id: m.id, threadId: m.threadId, senderType: m.senderType, sender: m.sender, body: m.body, createdAt: m.createdAt };
}

export function paginate(query: { page?: unknown; pageSize?: unknown }, max = 100) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(max, Math.max(1, Number(query.pageSize) || 12));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
