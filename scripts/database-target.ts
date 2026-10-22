/**
 * The local-database guard for developer tooling: migrations (drizzle.config.ts), the content
 * import (scripts/content.mts), the integration tests (test/setup.ts) and the E2E teardown
 * (e2e/global-setup.ts). They read `.env.local`, which can hold a remote connection string, so
 * each one calls {@link guardDatabaseTarget} before it touches the database:
 *
 * - a local database (localhost, 127.0.0.1, ::1 or a Unix socket) is allowed — the Docker
 *   database from docker-compose.yml, and CI's service container;
 * - anything else is refused, unless the shell sets `LEXORA_ALLOW_REMOTE_DB` to that exact
 *   hostname for this one command. The override is read before any env file is loaded, so it
 *   can't be left in `.env.local`; `CI` grants nothing.
 *
 * Messages name the host and database only, never the user or password. Plain TypeScript with
 * no imports, so drizzle-kit, tsx and Vitest can all load it.
 */

export const ALLOW_REMOTE_DB = "LEXORA_ALLOW_REMOTE_DB";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type DatabaseTarget = {
  /** Hostname, without credentials or port; `(unix socket)` or `(unreadable)` when there's none. */
  host: string;
  /** The database name from the URL path. */
  database: string;
  local: boolean;
};

/** Where a connection string points, without its credentials. Unreadable URLs are not local. */
export function databaseTarget(url: string): DatabaseTarget {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { host: "(unreadable)", database: "", local: false };
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  // postgres.js also takes the host from `?host=` (an absolute path is a Unix socket).
  const host = (parsed.searchParams.get("host") ?? parsed.hostname).replace(/^\[|\]$/g, "");
  if (!host || host.startsWith("/")) return { host: "(unix socket)", database, local: true };
  return { host, database, local: LOCAL_HOSTS.has(host.toLowerCase()) };
}

export class RemoteDatabaseError extends Error {
  override name = "RemoteDatabaseError";
}

/**
 * Refuses `operation` against a non-local database unless `allowRemote` (the value of
 * `LEXORA_ALLOW_REMOTE_DB`, read before env files were loaded) is exactly its hostname, in which
 * case it warns loudly and allows it. No URL: nothing to guard.
 */
export function guardDatabaseTarget(
  url: string | undefined,
  operation: string,
  allowRemote: string | undefined,
  warn: (message: string) => void = console.warn,
): DatabaseTarget | undefined {
  if (!url) return undefined;
  const target = databaseTarget(url);
  if (target.local) return target;

  const where = `${target.host}${target.database ? ` (database “${target.database}”)` : ""}`;
  if (allowRemote !== undefined && allowRemote.trim().toLowerCase() === target.host.toLowerCase()) {
    warn(
      [
        "",
        "  ⚠  REMOTE DATABASE — the local-database guard was bypassed on purpose.",
        `  ⚠  ${operation} is running against ${where},`,
        `  ⚠  because ${ALLOW_REMOTE_DB} names this host.`,
        "",
      ].join("\n"),
    );
    return target;
  }

  throw new RemoteDatabaseError(
    [
      `Refusing to run ${operation} against ${where}: it isn't a local database.`,
      "Point DATABASE_URL in .env.local at the Docker database (postgres://lexora@localhost:5432/lexora).",
      `To target this remote database deliberately, run the command with ${ALLOW_REMOTE_DB}=${target.host} set in the shell.`,
    ].join("\n"),
  );
}
