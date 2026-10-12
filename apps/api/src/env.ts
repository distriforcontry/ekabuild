import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  INSTANCE_ID: z.string().default(process.env.HOSTNAME ?? "api-local"),
  PUBLIC_URL: z.string().default("http://localhost:3000"),
  COOKIE_DOMAIN: z.string().optional().default(""),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional().default(""),
  RABBITMQ_URL: z.string().optional().default(""),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  ACCESS_TTL_MIN: z.coerce.number().default(60),
  REFRESH_TTL_DAYS: z.coerce.number().default(30),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_DIR: z.string().default("./.data/uploads"),
  S3_ENDPOINT: z.string().optional().default(""),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("ekabuild"),
  S3_ACCESS_KEY: z.string().optional().default(""),
  S3_SECRET_KEY: z.string().optional().default(""),
  SMS_PROVIDER: z.enum(["mock", "eskiz"]).default("mock"),
  ESKIZ_EMAIL: z.string().optional().default(""),
  ESKIZ_PASSWORD: z.string().optional().default(""),
  ESKIZ_FROM: z.string().default("4546"),
  EIMZO_MODE: z.enum(["mock", "eimzo"]).default("mock"),
  EIMZO_SERVER_URL: z.string().default("http://eimzo-server:8080"),
  CADASTRE_PROVIDER: z.enum(["mock"]).default("mock"),
  MAX_UPLOAD_MB: z.coerce.number().default(200),
  TRUST_PROXY: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
