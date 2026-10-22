import { existsSync } from "node:fs";

import { ALLOW_REMOTE_DB, guardDatabaseTarget } from "../scripts/database-target";

// Read the remote override from the shell before .env.local can supply it.
const allowRemote = process.env[ALLOW_REMOTE_DB];

// Locally, integration tests use the development database from .env.local (Next's own loader
// skips .env.local when NODE_ENV=test). In CI the variables come from the workflow instead.
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// Tests create and drop databases and write fixtures: only ever against a local database
// (CI's service container is localhost), unless the shell names the remote host.
guardDatabaseTarget(process.env.DATABASE_URL, "the test suite", allowRemote);
