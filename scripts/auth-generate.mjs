// Regenerates src/server/db/schema/auth.ts from the Better Auth config.
// The Better Auth CLI cannot load modules that import "server-only", so this script
// comments those imports out for the duration of the run and always restores them.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const files = [
  "src/server/auth/auth.ts",
  "src/server/env.ts",
  "src/server/db/client.ts",
  "src/server/db/connect.ts",
];
const marker = 'import "server-only";';
const disabled = '// auth:generate import "server-only";';
const originals = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
const header = readFileSync("src/server/db/schema/auth.ts", "utf8").split("*/")[0] + "*/\n";

try {
  for (const [file, source] of originals) writeFileSync(file, source.replace(marker, disabled));
  execFileSync(
    "pnpm",
    [
      "dlx",
      "auth@1.7.7",
      "generate",
      "--config",
      "src/server/auth/auth.ts",
      "--output",
      "src/server/db/schema/auth.ts",
      "--yes",
    ],
    { stdio: "inherit" },
  );
  const generated = readFileSync("src/server/db/schema/auth.ts", "utf8");
  if (!generated.startsWith("/**"))
    writeFileSync("src/server/db/schema/auth.ts", header + generated);
} finally {
  for (const [file, source] of originals) writeFileSync(file, source);
}
