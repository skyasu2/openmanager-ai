#!/usr/bin/env bash

set -euo pipefail

# Pick a free localhost port to avoid interactive prompt when 6006 is occupied.
find_free_port() {
  node -e '
const net = require("node:net");
const server = net.createServer();
server.unref();
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") {
    console.error("failed to resolve free port");
    process.exit(1);
  }
  process.stdout.write(String(address.port));
  server.close();
});
'
}

PORT="${STORYBOOK_SMOKE_PORT:-$(find_free_port)}"
echo "[storybook:smoke] using port ${PORT}"

storybook dev -p "${PORT}" --ci --smoke-test
