import { existsSync } from "node:fs";

// Locally, integration tests use the development database from .env.local (Next's own loader
// skips .env.local when NODE_ENV=test). In CI the variables come from the workflow instead.
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
