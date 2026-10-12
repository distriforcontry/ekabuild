import zlib from "node:zlib";

// Tiny dependency-free generators for demo assets: PNG raster images and simple text PDFs.

// ───────────────────────────── PNG ─────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export class Raster {
  data: Uint8Array;
  constructor(
    public w: number,
    public h: number,
  ) {
    this.data = new Uint8Array(w * h * 3);
  }
  px(x: number, y: number, [r, g, b]: RGB, a = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    const d = this.data;
    d[i] = d[i]! + (r - d[i]!) * a;
    d[i + 1] = d[i + 1]! + (g - d[i + 1]!) * a;
    d[i + 2] = d[i + 2]! + (b - d[i + 2]!) * a;
  }
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 1) {
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(this.h, y + h); yy++)
      for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(this.w, x + w); xx++) this.px(xx, yy, c, a);
  }
  vgrad(y0: number, y1: number, top: RGB, bottom: RGB) {
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      const c: RGB = [top[0] + (bottom[0] - top[0]) * t, top[1] + (bottom[1] - top[1]) * t, top[2] + (bottom[2] - top[2]) * t];
      for (let x = 0; x < this.w; x++) this.px(x, y, c);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, width = 1, a = 1) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len * 1.5));
    const r = width / 2;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      if (width <= 1) this.px(x, y, c, a);
      else for (let dy = -r; dy < r; dy++) for (let dx = -r; dx < r; dx++) this.px(x + dx, y + dy, c, a);
    }
  }
  arc(cx: number, cy: number, radius: number, from: number, to: number, c: RGB, a = 1) {
    const steps = Math.ceil(radius * Math.abs(to - from));
    for (let i = 0; i <= steps; i++) {
      const t = from + ((to - from) * i) / steps;
      this.px(cx + Math.cos(t) * radius, cy + Math.sin(t) * radius, c, a);
    }
  }
  glow(cx: number, cy: number, radius: number, c: RGB, strength = 0.5) {
    for (let y = cy - radius; y < cy + radius; y++)
      for (let x = cx - radius; x < cx + radius; x++) {
        const d = Math.hypot(x - cx, y - cy) / radius;
        if (d < 1) this.px(x, y, c, (1 - d) ** 2 * strength);
      }
  }
  png(): Buffer {
    const raw = Buffer.alloc((this.w * 3 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 3 + 1)] = 0;
      Buffer.from(this.data.buffer, y * this.w * 3, this.w * 3).copy(raw, y * (this.w * 3 + 1) + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8;
    ihdr[9] = 2; // RGB
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

type RGB = [number, number, number];

/** Deterministic PRNG */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Stylised dusk render of a residential tower — used as project covers / progress photos. */
export function buildingRender(seed: number, opts: { floors: number; towers?: number; progress?: number; w?: number; h?: number }) {
  const W = opts.w ?? 1200;
  const H = opts.h ?? 760;
  const r = rng(seed);
  const img = new Raster(W, H);
  const hue = r();
  const skyTop: RGB = hue < 0.33 ? [16, 20, 38] : hue < 0.66 ? [22, 18, 30] : [12, 24, 34];
  const skyBottom: RGB = hue < 0.33 ? [196, 132, 84] : hue < 0.66 ? [210, 150, 110] : [170, 140, 110];
  img.vgrad(0, H * 0.78, skyTop, skyBottom);
  img.glow(W * (0.2 + r() * 0.6), H * 0.72, 260, [255, 196, 120], 0.35);
  // distant skyline
  for (let x = 0; x < W; x += 30 + r() * 50) {
    const bh = 60 + r() * 140;
    img.rect(x, H * 0.78 - bh, 26 + r() * 40, bh, [40, 36, 44], 0.75);
  }
  img.vgrad(Math.floor(H * 0.78), H, [36, 32, 30], [14, 13, 13]);

  const towers = Math.max(1, opts.towers ?? 1);
  const progress = opts.progress ?? 100;
  const baseY = H * 0.8;
  for (let t = 0; t < towers; t++) {
    const tw = 150 + r() * 70;
    const tx = W / 2 - (towers * (tw + 50)) / 2 + t * (tw + 50) + 25;
    const floors = Math.max(4, Math.round(opts.floors * (t === 0 ? 1 : 0.7 + r() * 0.25)));
    const fh = Math.min(22, (H * 0.68) / floors);
    const built = Math.round((floors * progress) / 100);
    // body
    for (let f = 0; f < floors; f++) {
      const y = baseY - (f + 1) * fh;
      if (f >= built) {
        // scaffold / frame only
        img.line(tx, y, tx + tw, y, [120, 110, 100], 1, 0.6);
        img.line(tx, y, tx, y + fh, [120, 110, 100], 1, 0.6);
        img.line(tx + tw, y, tx + tw, y + fh, [120, 110, 100], 1, 0.6);
        continue;
      }
      img.rect(tx, y, tw, fh, [34, 36, 42]);
      img.rect(tx, y + fh - 2, tw, 2, [70, 66, 62]); // slab edge
      const cols = Math.floor(tw / 18);
      for (let c = 0; c < cols; c++) {
        const lit = r() < 0.42;
        const col: RGB = lit ? [255, 205 + r() * 30, 130 + r() * 40] : [58, 70, 88];
        img.rect(tx + 4 + c * 18, y + 4, 11, fh - 9, col, lit ? 0.95 : 0.9);
      }
    }
    // gold fins
    for (let x = tx; x <= tx + tw; x += tw / 6) img.line(x, baseY - built * fh, x, baseY, [201, 164, 100], 2, 0.85);
    // crane when under construction
    if (progress < 100) {
      const top = baseY - floors * fh - 80;
      img.line(tx + tw * 0.7, baseY, tx + tw * 0.7, top, [230, 180, 60], 3);
      img.line(tx + tw * 0.7 - 160, top + 6, tx + tw * 0.7 + 90, top + 6, [230, 180, 60], 3);
      img.line(tx + tw * 0.7 + 60, top + 6, tx + tw * 0.7 + 60, top + 120, [200, 200, 200], 1);
    }
  }
  // street lights
  for (let x = 40; x < W; x += 140) {
    img.line(x, baseY + 10, x, baseY - 40, [60, 60, 60], 2);
    img.glow(x, baseY - 42, 26, [255, 210, 140], 0.6);
  }
  return img.png();
}

/** Blueprint floor plan (white lines on blue) */
export function floorPlan(seed: number, rooms = 3, w = 1400, h = 1000) {
  const r = rng(seed);
  const img = new Raster(w, h);
  img.rect(0, 0, w, h, [16, 52, 96]);
  for (let x = 0; x < w; x += 25) img.line(x, 0, x, h, [40, 84, 132], 1, 0.5);
  for (let y = 0; y < h; y += 25) img.line(0, y, w, y, [40, 84, 132], 1, 0.5);
  const white: RGB = [230, 240, 250];
  const ox = 150;
  const oy = 120;
  const pw = w - 300;
  const ph = h - 240;
  // outer walls
  img.line(ox, oy, ox + pw, oy, white, 8);
  img.line(ox + pw, oy, ox + pw, oy + ph, white, 8);
  img.line(ox + pw, oy + ph, ox, oy + ph, white, 8);
  img.line(ox, oy + ph, ox, oy, white, 8);
  // partitions
  const splits = Math.max(2, rooms + 1);
  let x = ox;
  for (let i = 1; i < splits; i++) {
    x = ox + (pw * i) / splits + (r() - 0.5) * 60;
    img.line(x, oy, x, oy + ph * (0.55 + r() * 0.2), white, 4);
    // door arc
    img.arc(x, oy + ph * 0.6, 50, -Math.PI / 2, 0, white);
  }
  const corridorY = oy + ph * 0.72;
  img.line(ox, corridorY, ox + pw * 0.75, corridorY, white, 4);
  // windows
  for (let i = 0; i < 6; i++) {
    const wx = ox + 80 + i * ((pw - 160) / 5);
    img.rect(wx - 30, oy - 6, 60, 12, [120, 190, 240]);
  }
  // dimension lines
  img.line(ox, oy - 60, ox + pw, oy - 60, white, 1);
  img.line(ox, oy - 70, ox, oy - 50, white, 2);
  img.line(ox + pw, oy - 70, ox + pw, oy - 50, white, 2);
  img.line(ox - 60, oy, ox - 60, oy + ph, white, 1);
  // furniture hints
  for (let i = 0; i < rooms; i++) img.rect(ox + 60 + i * (pw / splits), oy + 60, 120, 70, white, 0.18);
  return img.png();
}

/** Facade / section drawing */
export function facadeDrawing(seed: number, floors: number, w = 1400, h = 1000) {
  const r = rng(seed);
  const img = new Raster(w, h);
  img.rect(0, 0, w, h, [244, 240, 232]);
  for (let x = 0; x < w; x += 50) img.line(x, 0, x, h, [220, 214, 200], 1, 0.6);
  for (let y = 0; y < h; y += 50) img.line(0, y, w, y, [220, 214, 200], 1, 0.6);
  const ink: RGB = [30, 34, 42];
  const bw = 520;
  const bx = (w - bw) / 2;
  const fh = Math.min(40, (h - 200) / floors);
  const top = h - 100 - floors * fh;
  img.line(80, h - 100, w - 80, h - 100, ink, 3);
  img.line(bx, top, bx + bw, top, ink, 3);
  img.line(bx, top, bx, h - 100, ink, 3);
  img.line(bx + bw, top, bx + bw, h - 100, ink, 3);
  for (let f = 0; f < floors; f++) {
    const y = top + f * fh;
    img.line(bx, y, bx + bw, y, ink, 1);
    for (let c = 0; c < 8; c++) img.rect(bx + 18 + c * 63, y + 8, 34, fh - 16, [140, 160, 180], 0.55 + r() * 0.1);
  }
  // level markers
  for (let f = 0; f <= floors; f += 3) img.line(bx + bw + 20, top + f * fh, bx + bw + 80, top + f * fh, [176, 138, 78], 2);
  return img.png();
}

// ───────────────────────────── PDF ─────────────────────────────

/** Minimal one-page PDF (Helvetica, ASCII). Lines: [text, size, bold?] */
export function simplePdf(lines: [string, number, boolean?][], opts: { border?: boolean; seal?: string } = {}) {
  const esc = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[‘’ʻʼ`]/g, "'")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  let y = 770;
  const ops: string[] = [];
  if (opts.border) {
    ops.push("0.69 0.54 0.31 RG 3 w 30 30 535 782 re S");
    ops.push("0.69 0.54 0.31 RG 0.8 w 38 38 519 766 re S");
  }
  for (const [text, size, bold] of lines) {
    if (!text) {
      y -= size;
      continue;
    }
    ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf 60 ${y} Td (${esc(text)}) Tj ET`);
    y -= size * 1.55;
  }
  if (opts.seal) {
    ops.push("0.69 0.54 0.31 RG 2 w 470 110 m 470 110 l S");
    // circular-ish seal from line segments
    const cx = 460;
    const cy = 120;
    const pts = Array.from({ length: 37 }, (_, i) => [cx + 55 * Math.cos((i * Math.PI) / 18), cy + 55 * Math.sin((i * Math.PI) / 18)]);
    ops.push(`0.69 0.54 0.31 RG 2 w ${pts.map(([x, yy], i) => `${x!.toFixed(1)} ${yy!.toFixed(1)} ${i ? "l" : "m"}`).join(" ")} S`);
    ops.push(`BT /F2 9 Tf ${cx - 40} ${cy - 3} Td (${esc(opts.seal)}) Tj ET`);
  }
  const content = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
