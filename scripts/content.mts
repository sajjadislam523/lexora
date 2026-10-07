/**
 * Content CLI (content/README.md):
 *
 *   pnpm content:check    validate content/ — no database needed (CI runs this)
 *
 * Runs under the `react-server` condition, like Next's server, so server-only modules load.
 */
import { readContentDir } from "@/server/content/files";
import { formatIssue, validateContent } from "@/server/content/validate";

async function check() {
  const result = validateContent(await readContentDir());
  if (!result.ok) {
    for (const issue of result.issues) console.error(formatIssue(issue));
    const count = result.issues.length;
    console.error(`\n✗ ${count} content ${count === 1 ? "issue" : "issues"}`);
    return 1;
  }
  const { items, intents, sources } = result.content;
  const senses = items.reduce((total, item) => total + item.senses.length, 0);
  console.log(
    `✓ content is valid: ${items.length} items, ${senses} senses, ${intents.length} intents, ${sources.length} sources`,
  );
  return 0;
}

const commands: Record<string, () => Promise<number>> = { check };

const command = process.argv[2] ?? "";
const run = commands[command];
if (!run) {
  console.error(`Usage: pnpm content:<${Object.keys(commands).join("|")}>`);
  process.exit(2);
}
process.exit(await run());
