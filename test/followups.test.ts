// Unit tests for the pure follow-up policy. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  followUpDueDate,
  MAX_FOLLOWUP_STEP,
  shouldStopSequence,
} from "../src/lib/followups-policy";

test("shouldStopSequence stops on reply / closed status or any inbound reply", () => {
  assert.equal(shouldStopSequence({ status: "NEW", repliesCount: 0 }), false);
  assert.equal(shouldStopSequence({ status: "CONTACTED", repliesCount: 0 }), false);
  assert.equal(shouldStopSequence({ status: "FOLLOW_UP_NEEDED", repliesCount: 0 }), false);
  assert.equal(shouldStopSequence({ status: "REPLIED", repliesCount: 0 }), true);
  assert.equal(shouldStopSequence({ status: "WON", repliesCount: 0 }), true);
  assert.equal(shouldStopSequence({ status: "LOST", repliesCount: 0 }), true);
  assert.equal(shouldStopSequence({ status: "CONTACTED", repliesCount: 1 }), true);
});

test("followUpDueDate follows the Day 1 / 3 / 7 / 14 cadence", () => {
  const base = new Date("2026-01-01T00:00:00.000Z");
  const day = 86_400_000;
  assert.equal(followUpDueDate(base, 1).getTime() - base.getTime(), 1 * day);
  assert.equal(followUpDueDate(base, 2).getTime() - base.getTime(), 3 * day);
  assert.equal(followUpDueDate(base, 3).getTime() - base.getTime(), 7 * day);
  assert.equal(followUpDueDate(base, 4).getTime() - base.getTime(), 14 * day);
  assert.equal(MAX_FOLLOWUP_STEP, 4);
});
