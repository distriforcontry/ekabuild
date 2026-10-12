import { buildServer } from "./server";
import { env } from "./env";
import { prisma } from "./db";
import { closeBus, initBus } from "./lib/bus";
import { redis } from "./lib/redis";
import { closeSupportHub, initSupportHub } from "./realtime/support-hub";

const app = await buildServer();
await initBus();
await initSupportHub();

await app.listen({ port: env.PORT, host: env.HOST });
app.log.info(`EKA BUILD API (${env.INSTANCE_ID}) listening on :${env.PORT}`);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`${signal} received, draining…`);
  const force = setTimeout(() => process.exit(1), 15_000).unref();
  try {
    await closeSupportHub();
    await app.close();
    await closeBus();
    await redis?.quit().catch(() => {});
    await prisma.$disconnect();
  } finally {
    clearTimeout(force);
    process.exit(0);
  }
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
