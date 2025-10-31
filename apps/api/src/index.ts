import Fastify from "fastify";
import fastifyCors from "@fastify/cors";

import { HOST, PORT, ROUTE_PREFIX } from "./config.js";
import { closePool } from "./db.js";
import { closeRedis } from "./redis.js";
import adminRoutes from "./routes/admin.js";
import hostsRoutes from "./routes/hosts.js";
import searchRoutes from "./routes/search.js";
import seedRoutes from "./routes/seed.js";

export function buildServer() {
  const app = Fastify({
    logger: true,
  });

  app.register(fastifyCors, {
    origin: true,
  });

  if (ROUTE_PREFIX) {
    app.register(adminRoutes, { prefix: ROUTE_PREFIX });
    app.register(hostsRoutes, { prefix: ROUTE_PREFIX });
    app.register(searchRoutes, { prefix: ROUTE_PREFIX });
    app.register(seedRoutes, { prefix: ROUTE_PREFIX });
  } else {
    app.register(adminRoutes);
    app.register(hostsRoutes);
    app.register(searchRoutes);
    app.register(seedRoutes);
  }

  app.addHook("onClose", async () => {
    await closePool();
    await closeRedis();
  });

  return app;
}

export async function main(): Promise<void> {
  const app = buildServer();

  const close = async () => {
    try {
      await app.close();
    } catch (error) {
      app.log.error(error, "Failed to close Fastify instance");
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  try {
    await app.listen({ host: HOST, port: PORT });
    app.log.info(`API server listening on http://${HOST}:${PORT}`);
  } catch (error) {
    app.log.error(error, "Failed to start API server");
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
