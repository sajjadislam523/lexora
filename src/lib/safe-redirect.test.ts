import { describe, expect, it } from "vitest";

import { config } from "@/proxy";

import { PROTECTED_ROUTES } from "./auth-constants";
import { isProtectedPath, safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it("keeps same-origin app paths, with query and hash", () => {
    expect(safeRedirect("/finder?q=important#results")).toBe("/finder?q=important#results");
    expect(safeRedirect("/language/significant")).toBe("/language/significant");
  });

  it.each([
    "https://evil.example/home",
    "//evil.example/home",
    "/\\evil.example",
    "javascript:alert(1)",
    "/sign-in",
    "/api/auth/sign-out",
    "/homepage",
    "",
    null,
    undefined,
  ])("falls back to /home for %s", (target) => {
    expect(safeRedirect(target)).toBe("/home");
  });

  it("recognises protected paths by segment, not prefix", () => {
    expect(isProtectedPath("/home")).toBe(true);
    expect(isProtectedPath("/language/significant")).toBe(true);
    expect(isProtectedPath("/homepage")).toBe(false);
    expect(isProtectedPath("/design-system")).toBe(false);
  });
});

describe("proxy matcher", () => {
  it("covers exactly the protected routes", () => {
    expect(config.matcher).toEqual(PROTECTED_ROUTES.map((route) => `${route}/:path*`));
  });
});
