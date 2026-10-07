/**
 * Content CLI (content/README.md):
 *
 *   pnpm content:check            validate content/ — no database needed (CI runs this)
 *   pnpm content:import           validate, then import into DATABASE_URL in one transaction
 *   pnpm content:import --force   import even if the content is unchanged since the last release
 *
 * Runs under the `react-server` condition, like Next's server, so server-only modules load.
 */
import { execFileSync } from "node:child_process";

import nextEnv from "@next/env";

import { readContentDir } from "@/server/content/files";
import { importContent, UnsafeImportError } from "@/server/content/import";
import { formatIssue, validateContent, type ValidatedContent } from "@/server/content/validate";
import { connect } from "@/server/db/connect";

async function validate(): Promise<ValidatedContent | undefined> {
  const result = validateContent(await readContentDir());
  if (!result.ok) {
    for (const issue of result.issues) console.error(formatIssue(issue));
    const count = result.issues.length;
    console.error(`\n✗ ${count} content ${count === 1 ? "issue" : "issues"}`);
    return undefined;
  }
  const { items, intents, sources } = result.content;
  const senses = items.reduce((total, item) => total + item.senses.length, 0);
  console.log(
    `✓ content is valid: ${items.length} items, ${senses} senses, ${intents.length} intents, ${sources.length} sources`,
  );
  return result.content;
}

async function check() {
  return (await validate()) ? 0 : 1;
}

async function importCommand() {
  const content = await validate();
  if (!content) return 1;

  nextEnv.loadEnvConfig(process.cwd());
  // Like migrations, imports use the direct (non-pooled) connection when one is configured.
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
    return 1;
  }

  const db = connect(url, { max: 1 });
  try {
    const result = await importContent(db, content, {
      gitSha: gitSha(),
      force: process.argv.includes("--force"),
    });
    if (result.status === "unchanged") {
      console.log("✓ the database already has this content; nothing to import");
    } else {
      const counts = Object.entries(result.counts)
        .map(([name, count]) => `${count} ${name}`)
        .join(", ");
      console.log(`✓ imported release ${result.releaseId}: ${counts}`);
    }
    return 0;
  } catch (error) {
    if (error instanceof UnsafeImportError) {
      console.error(`✗ ${error.message}\n\nNothing was imported.`);
      return 1;
    }
    throw error;
  } finally {
    await db.$client.end();
  }
}

/** The commit the content came from, marked `-dirty` when content/ has uncommitted changes. */
function gitSha() {
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain", "content"], { encoding: "utf8" });
    return dirty.trim() ? `${sha}-dirty` : sha;
  } catch {
    return undefined;
  }
}

const commands: Record<string, () => Promise<number>> = { check, import: importCommand };

const command = process.argv[2] ?? "";
const run = commands[command];
if (!run) {
  console.error(`Usage: pnpm content:<${Object.keys(commands).join("|")}>`);
  process.exit(2);
}
process.exit(await run());
