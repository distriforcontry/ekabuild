import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { PassThrough, Transform, type Readable } from "node:stream";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";

/**
 * File storage abstraction.
 *  - local: a directory shared by every API replica (docker volume)
 *  - s3:    any S3-compatible object storage
 * Files are written while streaming, computing SHA-256 + size on the fly.
 */
export interface StoredFile {
  key: string;
  size: number;
  sha256: string;
}

export interface Storage {
  save(stream: Readable, key: string, mime: string): Promise<StoredFile>;
  read(key: string): Promise<Readable>;
  remove(key: string): Promise<void>;
}

function hashing() {
  const hash = crypto.createHash("sha256");
  let size = 0;
  const t = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hash.update(chunk);
      size += chunk.length;
      cb(null, chunk);
    },
  });
  return { t, done: () => ({ sha256: hash.digest("hex"), size }) };
}

class LocalStorage implements Storage {
  constructor(private root: string) {
    fs.mkdirSync(root, { recursive: true });
  }
  private full(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(path.resolve(this.root))) throw new Error("invalid key");
    return p;
  }
  async save(stream: Readable, key: string): Promise<StoredFile> {
    const target = this.full(key);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.part`;
    const h = hashing();
    await pipeline(stream, h.t, fs.createWriteStream(tmp));
    await fsp.rename(tmp, target);
    return { key, ...h.done() };
  }
  async read(key: string) {
    const p = this.full(key);
    await fsp.access(p);
    return fs.createReadStream(p);
  }
  async remove(key: string) {
    await fsp.rm(this.full(key), { force: true });
  }
}

class S3Storage implements Storage {
  private client = new S3Client({
    endpoint: env.S3_ENDPOINT || undefined,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: env.S3_ACCESS_KEY ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } : undefined,
  });
  async save(stream: Readable, key: string, mime: string): Promise<StoredFile> {
    // buffer to a temp file first so the upload has a known length and a hash
    const tmp = path.join(process.env.TMPDIR ?? "/tmp", `eka-${crypto.randomUUID()}`);
    const h = hashing();
    await pipeline(stream, h.t, fs.createWriteStream(tmp));
    const meta = h.done();
    try {
      await this.client.send(
        new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: fs.createReadStream(tmp), ContentType: mime, ContentLength: meta.size }),
      );
    } finally {
      await fsp.rm(tmp, { force: true });
    }
    return { key, ...meta };
  }
  async read(key: string) {
    const out = await this.client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    const body = out.Body as Readable;
    return body.pipe(new PassThrough());
  }
  async remove() {
    // objects are immutable evidence; deletion is intentionally a no-op
  }
}

export const storage: Storage = env.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage(env.STORAGE_DIR);

export const ALLOWED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "webp", "glb", "gltf", "dwg", "dxf", "ifc", "zip"]);

export function mimeFor(ext: string, fallback: string) {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    glb: "model/gltf-binary",
    gltf: "model/gltf+json",
    dwg: "image/vnd.dwg",
    dxf: "image/vnd.dxf",
    ifc: "application/x-step",
    zip: "application/zip",
  };
  return map[ext] ?? fallback;
}

export function newKey(ext: string) {
  const d = new Date();
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;
}
