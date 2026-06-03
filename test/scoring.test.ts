// Unit tests for the pure scoring engine. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  auditSeverityFromResult,
  bandFor,
  deriveSignals,
  scoreLead,
  type ScoreSignals,
} from "../src/lib/scoring";

const NONE: ScoreSignals = {
  hasWebsite: false,
  websiteAudited: false,
  websiteIssues: 0,
  nicheMatch: false,
  matchedService: null,
  painPoint: false,
  hiringSignal: false,
  weakSocial: false,
  affordability: false,
  hasContact: false,
};

test("bandFor thresholds", () => {
  assert.equal(bandFor(0), "NOT_USEFUL");
  assert.equal(bandFor(24), "NOT_USEFUL");
  assert.equal(bandFor(25), "LOW");
  assert.equal(bandFor(45), "WARM");
  assert.equal(bandFor(69), "WARM");
  assert.equal(bandFor(70), "HOT");
  assert.equal(bandFor(100), "HOT");
});

test("auditSeverityFromResult: all bad vs healthy", () => {
  assert.equal(
    auditSeverityFromResult({
      https: false,
      mobileFriendly: false,
      hasSeoBasics: false,
      pageSpeedScore: 30,
      pageSizeKb: 5000,
    }),
    95, // 25 + 25 + 20 + 15 + 10
  );
  assert.equal(
    auditSeverityFromResult({ https: true, mobileFriendly: true, hasSeoBasics: true }),
    0,
  );
});

test("junk lead (no signals) scores 0 / NOT_USEFUL", () => {
  const r = scoreLead(NONE);
  assert.equal(r.score, 0);
  assert.equal(r.band, "NOT_USEFUL");
});

test("strong local-business lead with a broken site lands HOT and is explainable", () => {
  const signals = deriveSignals(
    {
      website: "http://lahorebakery.example",
      email: "hello@lahorebakery.example",
      matchedService: "Web Development",
      painPoint: "Website is HTTP-only and not mobile-friendly.",
      industry: "Food & Beverage",
      sourceType: "OVERPASS",
    },
    { https: false, mobileFriendly: false, hasSeoBasics: false, pageSpeedScore: 38, pageSizeKb: 120 },
  );
  const r = scoreLead(signals);
  // niche 25 + pain 20 + website round(20*85/100)=17 + contact 7 + afford 5 = 74
  assert.equal(r.score, 74);
  assert.equal(r.band, "HOT");
  assert.ok(r.reasons.some((x) => /Matches your service/.test(x)));
  assert.ok(r.reasons.some((x) => /fixable issues/.test(x)));
});

test("website opportunity is gated: only rewarded with niche match or contact", () => {
  const withMatch = scoreLead({ ...NONE, nicheMatch: true, matchedService: "Web Development" });
  assert.ok(withMatch.contributions.some((c) => c.rule === "website" && c.points === 10));

  const pureJunk = scoreLead(NONE);
  assert.ok(pureJunk.contributions.some((c) => c.rule === "website" && c.points === 0));
});

test("score is capped at 100", () => {
  const everything: ScoreSignals = {
    hasWebsite: true,
    websiteAudited: true,
    websiteIssues: 100,
    nicheMatch: true,
    matchedService: "Web Development",
    painPoint: true,
    hiringSignal: true,
    weakSocial: true,
    affordability: true,
    hasContact: true,
  };
  const r = scoreLead(everything);
  assert.equal(r.score, 100);
  assert.equal(r.band, "HOT");
});

test("deriveSignals detects hiring (RSS source) and weak-social (content service)", () => {
  const hiring = deriveSignals({ sourceType: "RSS", painPoint: "build broken" }, null);
  assert.equal(hiring.hiringSignal, true);

  const noHiring = deriveSignals({ painPoint: "wants a dashboard", sourceType: "REDDIT" }, null);
  assert.equal(noHiring.hiringSignal, false);

  const social = deriveSignals(
    { instagram: "@brand", matchedService: "Instagram / Short-form Content", painPoint: "low engagement" },
    null,
  );
  assert.equal(social.weakSocial, true);
});
