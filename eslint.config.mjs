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
    // Server code is the bottom layer for data; it never imports UI.
    files: ["src/server/**"],
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
