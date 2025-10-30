import Fastify from "fastify";
import fastifyCors from "@fastify/cors";

import { HOST, PORT } from "./config.js";
import { closePool } from "./db.js";
import searchRoutes from "./routes/search.js";

export function buildServer() {
  const app = Fastify({
    logger: true,
  });

  app.register(fastifyCors, {
    origin: true,
  });

  app.register(searchRoutes);

  app.addHook("onClose", async () => {
    await closePool();
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
