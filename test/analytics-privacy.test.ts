import { describe, expect, it } from "vitest";

import { sanitizeAnalyticsEvent, sanitizeAnalyticsUrl } from "@/lib/analytics-privacy";

/**
 * Vercel Web Analytics must never receive what a learner typed (search text, return paths) or
 * the tokens in reset and verification links. `sanitizeAnalyticsEvent` is the `beforeSend` every
 * event passes through.
 */
const ORIGIN = "https://lexora-five-sigma.vercel.app";

describe("analytics URL sanitising", () => {
  it("leaves a page without a query string as it is", () => {
    expect(sanitizeAnalyticsUrl("/language/significant")).toBe("/language/significant");
    expect(sanitizeAnalyticsUrl(`${ORIGIN}/explore`)).toBe(`${ORIGIN}/explore`);
    expect(sanitizeAnalyticsUrl(`${ORIGIN}/`)).toBe(`${ORIGIN}/`);
  });

  it("removes the search query", () => {
    expect(sanitizeAnalyticsUrl("/finder?q=important")).toBe("/finder");
    expect(sanitizeAnalyticsUrl(`${ORIGIN}/explore?q=important`)).toBe(`${ORIGIN}/explore`);
  });

  it("removes queries with spaces and special characters, however they are encoded", () => {
    const queries = [
      "/explore?q=I%20want%20to%20express%20contrast",
      "/explore?q=I+want+to+express+contrast",
      "/explore?q=r%C3%A9sum%C3%A9%20%26%20%E2%80%9Cmore%E2%80%9D%3F",
      "/finder?q=Governments+should+____+more+money",
      "/explore?q=",
      "/explore?q",
    ];
    for (const url of queries) expect(sanitizeAnalyticsUrl(url), url).toBe(url.split("?")[0]);
  });

  it("removes only learner input when there are several parameters", () => {
    expect(
      sanitizeAnalyticsUrl("/sign-in?next=%2Fexplore%3Fq%3Dimportant&reason=session-expired"),
    ).toBe("/sign-in?reason=session-expired");
    expect(sanitizeAnalyticsUrl("/practice?step=2&q=important")).toBe("/practice?step=2");
    expect(sanitizeAnalyticsUrl("/explore?q=important&utm_source=newsletter")).toBe("/explore");
  });

  it("never lets search text through", () => {
    const sent = [
      "/finder?q=preposition+after+responsible",
      "/explore?q=natural%20speaking%20alternative%20to%20furthermore&q=second",
      "/sign-up?next=%2Ffinder%3Fq%3Dpreposition%2Bafter%2Bresponsible",
      `${ORIGIN}/sign-in?next=/explore?q=responsible&reason=signed-out`,
    ].map(sanitizeAnalyticsUrl);
    for (const url of sent) {
      expect(url).not.toMatch(/responsible|furthermore|preposition|second|q=|next=/i);
    }
  });

  it("drops the fragment, which carries reset and verification tokens", () => {
    expect(sanitizeAnalyticsUrl(`${ORIGIN}/reset-password#token=AbC123xyz`)).toBe(
      `${ORIGIN}/reset-password`,
    );
    expect(sanitizeAnalyticsUrl("/verify-email#token=eyJhbGciOiJIUzI1NiJ9.e30.sig")).toBe(
      "/verify-email",
    );
    expect(sanitizeAnalyticsUrl("/language/significant#sense-notable")).toBe(
      "/language/significant",
    );
  });

  it("keeps allowlisted parameters only with their expected values", () => {
    expect(sanitizeAnalyticsUrl("/sign-in?reason=password-reset")).toBe(
      "/sign-in?reason=password-reset",
    );
    expect(sanitizeAnalyticsUrl("/sign-in?reason=my%20secret%20note")).toBe("/sign-in");
    expect(sanitizeAnalyticsUrl("/practice?step=two")).toBe("/practice");
  });

  it("fails closed on a URL it can't parse", () => {
    expect(sanitizeAnalyticsUrl("http://[bad?q=important#token=x")).toBe("http://[bad");
  });

  it("sanitises the event's URL and keeps its type, without changing the original", () => {
    const event = { type: "pageview" as const, url: `${ORIGIN}/finder?q=important` };
    expect(sanitizeAnalyticsEvent(event)).toEqual({ type: "pageview", url: `${ORIGIN}/finder` });
    expect(event.url).toBe(`${ORIGIN}/finder?q=important`);
    expect(sanitizeAnalyticsEvent({ type: "event", url: "/explore?q=x" })).toEqual({
      type: "event",
      url: "/explore",
    });
  });
});
