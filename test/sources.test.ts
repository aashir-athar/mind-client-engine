// Unit tests for the pure lead-source logic. The Overpass module imports config
// (for the network helpers), so we load env first; the functions under test are
// still pure. Run with `npm test`.
import "../worker/load-env";

import assert from "node:assert/strict";
import { test } from "node:test";
import { detectPainPoint, matchKeywords, matchService } from "../src/lib/keywords";
import { mapOverpassElements, resolveCategory } from "../src/lib/sources/overpass";
import { parsePasted } from "../src/lib/sources/paste";

test("matchService picks the most specific service", () => {
  assert.equal(matchService("we need a website redesign"), "Web Development");
  assert.equal(
    matchService("react native expo developer"),
    "Mobile App Development (React Native / Expo)",
  );
  assert.equal(matchService("my app crashes, firebase auth broken"), "App Rescue / Bug Fixing");
  assert.equal(
    matchService("crypto trading journal dashboard"),
    "Crypto Tools (dashboards, trading journals, landing pages)",
  );
  assert.equal(matchService("edit my videos for youtube"), "Video Editing");
  assert.equal(matchService("nothing relevant here"), null);
});

test("matchKeywords + detectPainPoint detect buying intent", () => {
  assert.ok(matchKeywords("Senior React Native Developer wanted").includes("react native developer"));
  assert.ok(detectPainPoint("We need a landing page for our startup mvp"));
  assert.equal(detectPainPoint("nice weather today"), null);
});

test("parsePasted: Instagram URL maps to the instagram field", () => {
  const r = parsePasted({
    url: "https://instagram.com/threadline.pk",
    text: "We need help with reels and content",
  });
  assert.ok(!("error" in r));
  if (!("error" in r)) {
    assert.equal(r.sourceType, "PASTE");
    assert.equal(r.instagram, "@threadline.pk");
    assert.equal(r.sourceUrl, "https://instagram.com/threadline.pk");
  }
});

test("parsePasted: text-only uses first line as name; empty errors", () => {
  const r = parsePasted({ text: "Acme Co\nLooking for a react native developer" });
  assert.ok(!("error" in r) && r.businessName === "Acme Co");
  const empty = parsePasted({});
  assert.ok("error" in empty);
});

test("resolveCategory maps presets and raw key=value", () => {
  assert.deepEqual(resolveCategory("cafe"), { key: "amenity", value: "cafe" });
  assert.deepEqual(resolveCategory("shop=bakery"), { key: "shop", value: "bakery" });
  assert.deepEqual(resolveCategory("shop"), { key: "shop", value: undefined });
});

test("mapOverpassElements: names required, missing website becomes a pain point", () => {
  const leads = mapOverpassElements([
    {
      type: "node",
      id: 1,
      tags: { name: "Cafe A", website: "https://cafea.example", amenity: "cafe", "addr:city": "Lahore" },
    },
    { type: "way", id: 2, tags: { name: "Cafe B", amenity: "cafe" } },
    { type: "node", id: 3, tags: { amenity: "cafe" } }, // no name → skipped
  ]);
  assert.equal(leads.length, 2);
  assert.equal(leads[0].website, "https://cafea.example");
  assert.equal(leads[0].painPoint, null);
  assert.equal(leads[0].sourceUrl, "https://www.openstreetmap.org/node/1");
  assert.equal(leads[0].location, "Lahore");
  assert.match(leads[1].painPoint ?? "", /No website/);
});
