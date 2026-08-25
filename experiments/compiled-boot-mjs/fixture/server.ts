import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import config from "./kortix.config.ts";

const server = createServer((request, response) => {
  response.setHeader("content-type", "application/json");

  if (request.url === config.routes.health) {
    response.end(JSON.stringify({ status: "ok", agent: config.agent.name }));
    return;
  }

  if (request.url === config.routes.config) {
    response.end(JSON.stringify(config));
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ error: "not_found" }));
});

server.listen(Number(process.env.PORT ?? 0), "127.0.0.1", () => {
  const address = server.address() as AddressInfo;
  process.stdout.write(
    `${JSON.stringify({ event: "ready", port: address.port })}\n`,
  );
});

const stop = () => server.close(() => process.exit(0));

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
