// Unit tests for the pure website-audit analyzer. Run with `npm test`.
// Uses Node's built-in test runner (node:test) loaded through tsx — no extra deps.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeHtml,
  computeSeverity,
  isAllowedByRobots,
} from "../src/lib/audit-analyze";

const GOOD_HTML = `<!doctype html><html><head>
  <title>Acme Web Studio</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="We build fast websites.">
  <meta property="og:title" content="Acme">
  <meta property="og:image" content="https://acme.example/og.png">
</head><body><h1>Welcome</h1><p>Hello there</p></body></html>`;

const BAD_HTML = `<html><head></head><body><p>no structure at all</p></body></html>`;

test("healthy page passes every check with no flags", () => {
  const r = analyzeHtml(GOOD_HTML, "https://acme.example/");
  assert.equal(r.https, true);
  assert.equal(r.mobileFriendly, true);
  assert.equal(r.hasSeoBasics, true);
  assert.equal(r.title, "Acme Web Studio");
  assert.equal(r.metaDescription, "We build fast websites.");
  assert.equal(r.h1Count, 1);
  assert.equal(r.ogImage, "https://acme.example/og.png");
  assert.deepEqual(r.flags, []);
  assert.equal(r.severity, 0);
  assert.match(r.summary, /^Healthy/);
});

test("broken http page raises the expected flags and high severity", () => {
  const r = analyzeHtml(BAD_HTML, "http://old.example/");
  assert.equal(r.https, false);
  assert.equal(r.mobileFriendly, false);
  assert.equal(r.hasSeoBasics, false);
  assert.equal(r.h1Count, 0);
  assert.deepEqual(
    r.flags.sort(),
    ["NO_HTTPS", "NOT_MOBILE_FRIENDLY", "NO_TITLE", "NO_META_DESCRIPTION", "NO_H1"].sort(),
  );
  // 25 + 25 + 15 + 15 + 10 = 90
  assert.equal(r.severity, 90);
  assert.match(r.summary, /no HTTPS/);
});

test("https check uses the FINAL url (after redirects)", () => {
  // Body is identical, but an http final URL must flag NO_HTTPS.
  const https = analyzeHtml(GOOD_HTML, "https://acme.example/");
  const http = analyzeHtml(GOOD_HTML, "http://acme.example/");
  assert.equal(https.https, true);
  assert.equal(http.https, false);
  assert.ok(http.flags.includes("NO_HTTPS"));
});

test("page size prefers content-length header, falls back to body bytes", () => {
  const withHeader = analyzeHtml(GOOD_HTML, "https://a.example/", "5120");
  assert.equal(withHeader.pageSizeKb, 5); // 5120 / 1024

  const noHeader = analyzeHtml(GOOD_HTML, "https://a.example/");
  assert.ok(noHeader.pageSizeKb >= 0); // decoded-body fallback, no crash

  const huge = analyzeHtml(GOOD_HTML, "https://a.example/", String(3 * 1024 * 1024));
  assert.ok(huge.flags.includes("LARGE_PAGE")); // 3 MB > 2 MB threshold
});

test("computeSeverity caps at 100", () => {
  assert.equal(computeSeverity([]), 0);
  assert.equal(
    computeSeverity([
      "NO_HTTPS",
      "NOT_MOBILE_FRIENDLY",
      "NO_TITLE",
      "NO_META_DESCRIPTION",
      "NO_H1",
      "LARGE_PAGE",
    ]),
    100, // 25+25+15+15+10+10 = 100
  );
});

test("robots.txt: disallowed paths blocked, others allowed", () => {
  const robots = "User-agent: *\nDisallow: /private";
  const ua = "MiNDClientEngine/0.1";
  const robotsUrl = "https://x.example/robots.txt";
  assert.equal(isAllowedByRobots(robotsUrl, robots, "https://x.example/private/p", ua), false);
  assert.equal(isAllowedByRobots(robotsUrl, robots, "https://x.example/about", ua), true);
});

test("robots.txt: no file means allowed", () => {
  assert.equal(
    isAllowedByRobots("https://x.example/robots.txt", null, "https://x.example/anything", "ua"),
    true,
  );
});
