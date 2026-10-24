import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ALLOW_REMOTE_DB,
  databaseTarget,
  guardDatabaseTarget,
  RemoteDatabaseError,
} from "../scripts/database-target";

/**
 * The local-database guard (scripts/database-target.ts). Nothing here connects to a database:
 * the remote hosts are fake, and the commands below refuse before opening a connection — the
 * remote host is on the reserved `.invalid` domain (RFC 6761), so even a broken guard couldn't
 * reach a real server.
 */
const SECRET = "s3cret-pw";
const NEON = `postgres://neondb_owner:${SECRET}@ep-example-host-a1b2c3d4-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require`;
const FAKE_REMOTE = `postgres://owner:${SECRET}@remote-db.invalid:5432/neondb`;

const allowed = (url: string, override?: string) =>
  guardDatabaseTarget(url, "a test", override, () => {});

describe("databaseTarget", () => {
  it.each([
    "postgres://lexora@localhost:5432/lexora",
    "postgresql://lexora:pw@127.0.0.1:5432/lexora",
    "postgres://lexora@[::1]:5432/lexora",
    "postgres://LOCALHOST/lexora",
    "postgres:///lexora?host=/var/run/postgresql",
  ])("treats %s as local", (url) => {
    expect(databaseTarget(url).local).toBe(true);
  });

  it.each([
    NEON,
    "postgres://lexora@db.example.com:5432/lexora",
    "postgres://lexora@localhost.evil.example/lexora",
    "postgres://lexora@127.0.0.1.nip.io/lexora",
    "postgres://lexora@10.0.0.5/lexora",
    "postgres://lexora@localhost/lexora?host=db.example.com",
    "not a url",
  ])("treats %s as remote", (url) => {
    expect(databaseTarget(url).local).toBe(false);
  });

  it("names the host and database without credentials", () => {
    expect(databaseTarget(NEON)).toEqual({
      host: "ep-example-host-a1b2c3d4-pooler.us-east-1.aws.neon.tech",
      database: "neondb",
      local: false,
    });
  });

  it("allows the CI database from the workflow", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    const url = /DATABASE_URL:\s*(\S+)/.exec(workflow)?.[1];
    expect(url).toBeDefined();
    expect(databaseTarget(url!).local).toBe(true);
  });
});

describe("guardDatabaseTarget", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows a local database and does nothing without a URL", () => {
    expect(allowed("postgres://lexora@localhost:5432/lexora")).toMatchObject({ local: true });
    expect(allowed("postgres://lexora@127.0.0.1:5432/lexora")).toMatchObject({ local: true });
    expect(guardDatabaseTarget(undefined, "a test", undefined)).toBeUndefined();
  });

  it("refuses a remote database by default, naming only its host", () => {
    expect(() => allowed(NEON)).toThrow(RemoteDatabaseError);
    try {
      allowed(NEON);
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("ep-example-host-a1b2c3d4-pooler.us-east-1.aws.neon.tech");
      expect(message).toContain(ALLOW_REMOTE_DB);
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain("neondb_owner");
    }
  });

  it("refuses an unreadable URL without echoing it", () => {
    expect(() => allowed(`postgres://u:${SECRET}@exa mple`)).toThrow(RemoteDatabaseError);
    expect(() => allowed(`postgres://u:${SECRET}@exa mple`)).not.toThrow(SECRET);
  });

  it("allows a remote database only when the override names that exact host, and warns", () => {
    const warn = vi.fn();
    const host = "ep-example-host-a1b2c3d4-pooler.us-east-1.aws.neon.tech";
    expect(guardDatabaseTarget(NEON, "a test", host, warn)).toMatchObject({ host, local: false });
    expect(warn).toHaveBeenCalledOnce();
    const message = warn.mock.calls[0]![0] as string;
    expect(message).toContain("REMOTE DATABASE");
    expect(message).toContain(host);
    expect(message).not.toContain(SECRET);
  });

  it.each(["1", "true", "yes", "other-host.neon.tech", "neon.tech", ""])(
    "refuses a remote database when the override is %j",
    (override) => {
      expect(() => allowed(NEON, override)).toThrow(RemoteDatabaseError);
    },
  );

  it("isn't bypassed by CI", () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("GITHUB_ACTIONS", "true");
    expect(() => allowed(NEON)).toThrow(RemoteDatabaseError);
  });
});

/**
 * The real commands, with a fake remote DATABASE_URL in the environment (it takes precedence over
 * .env.local in every loader) and no override. Each must refuse before connecting.
 */
describe("the guarded commands refuse a remote database", () => {
  const env = () => {
    const { [ALLOW_REMOTE_DB]: _override, ...rest } = process.env;
    return { ...rest, DATABASE_URL: FAKE_REMOTE, DATABASE_URL_UNPOOLED: FAKE_REMOTE };
  };
  const refused = (command: string, args: string[]) => {
    try {
      execFileSync(command, args, { env: env(), encoding: "utf8", stdio: "pipe", timeout: 60_000 });
    } catch (error) {
      const { status, stdout, stderr } = error as {
        status: number;
        stdout: string;
        stderr: string;
      };
      return { status, output: `${stdout}${stderr}` };
    }
    throw new Error(`${command} ${args.join(" ")} ran against a remote database`);
  };

  it.each([
    ["drizzle-kit migrate", "pnpm", ["exec", "drizzle-kit", "migrate"]],
    ["content:import", "pnpm", ["content:import"]],
    [
      "the test suite (test/setup.ts)",
      "pnpm",
      ["exec", "vitest", "run", "src/language/normalise.test.ts"],
    ],
  ])(
    "%s",
    (_, command, args) => {
      const { status, output } = refused(command, args as string[]);
      expect(status).not.toBe(0);
      expect(output).toContain("Refusing to run");
      expect(output).toContain("remote-db.invalid");
      expect(output).not.toContain(SECRET);
    },
    90_000,
  );
});
