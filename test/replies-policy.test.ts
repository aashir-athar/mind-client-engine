// Unit tests for the pure reply-classification helpers. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { UNSUB_FOOTER } from "../src/lib/email-policy";
import {
  cleanAddress,
  isBounceSender,
  isFreeMailDomain,
  isLikelyAutomated,
  isOptOut,
  stripQuotedAndFooter,
} from "../src/lib/replies-policy";

test("isOptOut detects opt-out language, ignores normal replies", () => {
  assert.equal(isOptOut("Please unsubscribe me from this"), true);
  assert.equal(isOptOut("STOP messaging me"), true);
  assert.equal(isOptOut("not interested, thanks"), true);
  assert.equal(isOptOut("remove me from your list"), true);
  assert.equal(isOptOut("Sure, let's chat next week!"), false);
  assert.equal(isOptOut("stopwatch app idea"), false); // word boundary: 'stopwatch' ≠ 'stop'
  assert.equal(isOptOut(""), false);
  assert.equal(isOptOut(null), false);
});

test("stripQuotedAndFooter removes quotes + our footer (prevents self opt-out)", () => {
  const body = `Sounds great, let's talk!\n\nOn Mon, Jan 1, Sam wrote:\n> the earlier message body\n\n${UNSUB_FOOTER}`;
  const clean = stripQuotedAndFooter(body);
  assert.ok(clean.includes("Sounds great"));
  assert.ok(!clean.includes("earlier message"));
  assert.ok(!clean.includes("stop")); // footer (which contains "stop") was stripped
  assert.equal(isOptOut(clean), false); // so a friendly quoted reply is NOT a false opt-out
});

test("isLikelyAutomated flags bounces / no-reply / out-of-office (sender, subject, headers)", () => {
  assert.equal(isLikelyAutomated("mailer-daemon@mail.com", "Undeliverable"), true);
  assert.equal(isLikelyAutomated("no-reply@stripe.com", "Receipt"), true);
  assert.equal(isLikelyAutomated("sara@acme.com", "Automatic reply: away"), true);
  assert.equal(isLikelyAutomated("sara@acme.com", "Re: your note"), false);
  assert.equal(isLikelyAutomated("sara@acme.com", "Re: hi", { autoSubmitted: "auto-replied" }), true);
  assert.equal(isLikelyAutomated("sara@acme.com", "Re: hi", { precedence: "bulk" }), true);
  assert.equal(isLikelyAutomated("sara@acme.com", "Re: hi", { returnPath: "<>" }), true);
  assert.equal(isLikelyAutomated("sara@acme.com", "Re: hi", {}), false);
});

test("isFreeMailDomain guards the domain fallback", () => {
  assert.equal(isFreeMailDomain("gmail.com"), true);
  assert.equal(isFreeMailDomain("outlook.com"), true);
  assert.equal(isFreeMailDomain("acmecorp.com"), false);
  assert.equal(isFreeMailDomain(null), false);
});

test("isBounceSender flags mailer-daemon / postmaster", () => {
  assert.equal(isBounceSender("mailer-daemon@mail.com"), true);
  assert.equal(isBounceSender("postmaster@corp.com"), true);
  assert.equal(isBounceSender("sara@acme.com"), false);
});

test("cleanAddress trims and lowercases", () => {
  assert.equal(cleanAddress("  Sara@ACME.com "), "sara@acme.com");
  assert.equal(cleanAddress(null), null);
  assert.equal(cleanAddress(""), null);
});
