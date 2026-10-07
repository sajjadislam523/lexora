import { describe, expect, it } from "vitest";

import { config } from "@/proxy";

import { PROTECTED_ROUTES } from "./auth-constants";
import { isProtectedPath, isReturnPath, safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it("keeps same-origin app paths, with query and hash", () => {
    expect(safeRedirect("/finder?q=important#results")).toBe("/finder?q=important#results");
    expect(safeRedirect("/settings")).toBe("/settings");
  });

  it("returns visitors to the public discovery page they came from", () => {
    expect(safeRedirect("/language/significant")).toBe("/language/significant");
    expect(safeRedirect("/explore?q=better%20word%20for%20important")).toBe(
      "/explore?q=better%20word%20for%20important",
    );
  });

  it.each([
    "https://evil.example/home",
    "//evil.example/home",
    "/\\evil.example",
    "javascript:alert(1)",
    "/sign-in",
    "/api/auth/sign-out",
    "/homepage",
    "/languages",
    "/explorer",
    "/design-system",
    "",
    null,
    undefined,
  ])("falls back to /home for %s", (target) => {
    expect(safeRedirect(target)).toBe("/home");
  });

  it("recognises protected paths by segment, not prefix", () => {
    expect(isProtectedPath("/home")).toBe(true);
    expect(isProtectedPath("/settings/profile")).toBe(true);
    expect(isProtectedPath("/homepage")).toBe(false);
    expect(isProtectedPath("/design-system")).toBe(false);
  });

  it("keeps public discovery pages public", () => {
    for (const path of ["/", "/explore", "/language/significant", "/sign-in", "/sign-up"]) {
      expect(isProtectedPath(path)).toBe(false);
    }
    expect(isReturnPath("/language/significant")).toBe(true);
    expect(isReturnPath("/explore")).toBe(true);
  });
});

describe("proxy matcher", () => {
  it("covers exactly the protected routes", () => {
    expect(config.matcher).toEqual(PROTECTED_ROUTES.map((route) => `${route}/:path*`));
  });

  it("never runs on public discovery pages", () => {
    for (const route of ["/explore", "/language", "/sign-in", "/sign-up", "/design-system"]) {
      expect(config.matcher.some((m) => m.startsWith(`${route}/`))).toBe(false);
    }
  });
});
