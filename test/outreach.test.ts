// Unit tests for the pure outreach templates. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildTemplateDraft,
  offerFor,
  suggestChannel,
} from "../src/lib/outreach/templates";

test("email draft for Web Development is personalized and includes the value offer", () => {
  const d = buildTemplateDraft({
    businessName: "Lahore Bakery",
    contactName: "Imran",
    painPoint: "site not mobile-friendly",
    matchedService: "Web Development",
    auditSummary: "Issues: no HTTPS; not mobile-friendly.",
    channel: "EMAIL",
  });
  assert.ok(d.subject && d.subject.includes("Lahore Bakery"));
  assert.ok(d.body.startsWith("Hi Imran,"));
  assert.ok(d.body.includes("free 5-point audit"));
  assert.ok(/Best,/.test(d.body));
  // web service + an audit summary → the hook references the site audit
  assert.ok(d.body.includes("Lahore Bakery's site"));
});

test("DM draft has no subject, is short, and keeps the offer", () => {
  const d = buildTemplateDraft({
    businessName: "Threadline",
    contactName: "Nida",
    painPoint: "low engagement on posts",
    matchedService: "Instagram / Short-form Content",
    channel: "INSTAGRAM",
  });
  assert.equal(d.subject, undefined);
  assert.ok(d.body.startsWith("Hi Nida!"));
  assert.ok(d.body.includes("3-reel content plan"));
  assert.ok(d.body.length < 320);
});

test("falls back to a generic offer and greeting when no service/contact", () => {
  const d = buildTemplateDraft({ businessName: "Acme", channel: "EMAIL" });
  assert.ok(d.body.startsWith("Hi there,"));
  assert.ok(d.body.includes("free quick audit"));
});

test("painPoint is referenced when there is no web audit", () => {
  const d = buildTemplateDraft({
    businessName: "BlockTrail",
    matchedService: "Crypto Tools (dashboards, trading journals, landing pages)",
    painPoint: "wants a trading-journal dashboard",
    channel: "EMAIL",
  });
  assert.ok(d.body.includes("trading-journal dashboard"));
  assert.ok(d.body.includes("free mockup"));
});

test("suggestChannel follows the contact-availability priority", () => {
  assert.equal(suggestChannel({ email: "a@b.c", instagram: "@x" }), "EMAIL");
  assert.equal(suggestChannel({ instagram: "@x" }), "INSTAGRAM");
  assert.equal(suggestChannel({ linkedin: "u" }), "LINKEDIN");
  assert.equal(suggestChannel({ whatsapp: "+92300" }), "WHATSAPP");
  assert.equal(suggestChannel({ twitter: "@t" }), "TWITTER");
  assert.equal(suggestChannel({ sourceType: "REDDIT" }), "REDDIT");
  assert.equal(suggestChannel({}), "EMAIL");
});

test("offerFor returns the per-service offer", () => {
  assert.equal(offerFor("Video Editing"), "one free sample edit");
  assert.equal(offerFor(null), "a free quick audit");
});

test("follow-up draft is phrased as a follow-up and keeps the offer", () => {
  const email = buildTemplateDraft({
    businessName: "Acme",
    contactName: "Sam",
    matchedService: "Web Development",
    channel: "EMAIL",
    followUp: true,
  });
  assert.ok(email.subject && /following up/i.test(email.subject));
  assert.ok(/following up/i.test(email.body));
  assert.ok(email.body.includes("free 5-point audit"));

  const dm = buildTemplateDraft({ businessName: "Acme", channel: "INSTAGRAM", followUp: true });
  assert.equal(dm.subject, undefined);
  assert.ok(/following up/i.test(dm.body));
});
