import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

// Load .env from the server directory, not from wherever node was invoked.
// This module must be imported before any module that reads process.env.
dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env"),
  quiet: true,
});
