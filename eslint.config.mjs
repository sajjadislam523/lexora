import { readdirSync } from "node:fs";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Architecture boundaries (docs/ARCHITECTURE.md → Dependency rules), enforced by lint.
 * Type-only imports are allowed across layers; runtime imports are not.
 */
const restrict = (patterns) => ({
  "@typescript-eslint/no-restricted-imports": ["error", { patterns, paths: [] }],
});
const pattern = (group, message) => ({ group, message, allowTypeImports: true });

const features = readdirSync("src/features", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

// Features rendered on public pages. Shared UI in components/** already can't import server code.
const publicFeatures = new Set(["discovery", "finder", "language"]);
const noServerInPublic = pattern(
  ["@/server/*"],
  "Public discovery code must not import server code. Account actions authenticate in their own endpoint.",
);
const noDemoInPublic = pattern(
  ["@/demo/*"],
  "Read language through @/language, not the prototype content behind it.",
);

// ESLint replaces (doesn't merge) rule options when several blocks match a file, so each file
// group gets exactly one block with all of its patterns.
const boundaries = [
  {
    // Shared UI, utilities and prototype content never reach into server code or features.
    files: ["src/components/**", "src/lib/**", "src/demo/**"],
    rules: restrict([
      pattern(
        ["@/server/*"],
        "Server code is server-only. Pass data in as props from a server component.",
      ),
      pattern(["@/features/*"], "Shared layers must not depend on features."),
    ]),
  },
  {
    // The shared language engine: content and search only. No UI, no server code, no user data.
    files: ["src/language/**"],
    ignores: ["src/language/index.ts"],
    rules: restrict([
      pattern(
        ["@/features/*", "@/components/*", "@/app/*", "@/server/*"],
        "The language engine holds content and search only; it must not depend on UI or server code.",
      ),
    ]),
  },
  {
    // Its composition root wires in the database repository, and nothing else from the server.
    files: ["src/language/index.ts"],
    rules: restrict([
      pattern(
        ["@/features/*", "@/components/*", "@/app/*"],
        "The language engine holds content and search only; it must not depend on UI.",
      ),
      pattern(
        [
          "@/server/*",
          "!@/server/db",
          "@/server/db/*",
          "!@/server/db/client",
          "!@/server/repositories",
          "@/server/repositories/*",
          "!@/server/repositories/language",
        ],
        "The language engine reads only the language repository — never auth or user data.",
      ),
    ]),
  },
  {
    // Language data access never reaches auth or learner data: the same results serve everyone.
    files: ["src/server/repositories/language/**"],
    rules: restrict([
      pattern(
        ["@/features/*", "@/components/*", "@/app/*", "@/demo/*"],
        "Server code must not import UI or prototype content.",
      ),
      pattern(
        ["@/server/auth/*", "@/server/repositories/*", "!@/server/repositories/language"],
        "The language repository must not read auth or user data.",
      ),
    ]),
  },
  {
    // Public routes (docs/ARCHITECTURE.md → Route boundary) render the same for everyone. They
    // never import server code, so they cannot load user data or call authenticated code, and
    // they read language through @/language rather than the prototype content behind it.
    files: ["src/app/(public)/**"],
    rules: restrict([noServerInPublic, noDemoInPublic]),
  },
  {
    // Server code is the bottom layer for data; it never imports UI.
    files: ["src/server/**"],
    ignores: ["src/server/repositories/language/**"],
    rules: restrict([
      pattern(
        ["@/features/*", "@/components/*", "@/app/*", "@/demo/*"],
        "Server code must not import UI or prototype content.",
      ),
    ]),
  },
  // Features don't import each other; shared needs move down into components/lexora, lib or server.
  ...features.map((feature) => ({
    files: [`src/features/${feature}/**`],
    rules: restrict([
      pattern(
        features.filter((other) => other !== feature).map((other) => `@/features/${other}/*`),
        "Features don't import each other. Move shared code into components/lexora, lib or server.",
      ),
      ...(publicFeatures.has(feature) ? [noServerInPublic] : []),
      ...(feature === "discovery" ? [noDemoInPublic] : []),
    ]),
  })),
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Underscore-prefixed bindings are intentionally unused (e.g. omitting a key by destructuring).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  ...boundaries,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
