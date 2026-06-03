// Unit tests for the pure email-policy helpers. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composeEmail,
  dailyCapReached,
  emailDomain,
  randomDelayMs,
  sameDomain,
  withinSendWindow,
} from "../src/lib/email-policy";

test("emailDomain extracts and lowercases the domain", () => {
  assert.equal(emailDomain("a@b.com"), "b.com");
  assert.equal(emailDomain("Foo@Bar.COM"), "bar.com");
  assert.equal(emailDomain("noatsign"), null);
});

test("sameDomain compares domains", () => {
  assert.equal(sameDomain("a@x.com", "b@x.com"), true);
  assert.equal(sameDomain("a@x.com", "b@y.com"), false);
});

test("withinSendWindow handles normal and overnight windows", () => {
  assert.equal(withinSendWindow(10, 9, 18), true);
  assert.equal(withinSendWindow(8, 9, 18), false);
  assert.equal(withinSendWindow(18, 9, 18), false); // end is exclusive
  assert.equal(withinSendWindow(9, 9, 18), true); // start inclusive
  // overnight wrap 22 → 6
  assert.equal(withinSendWindow(23, 22, 6), true);
  assert.equal(withinSendWindow(3, 22, 6), true);
  assert.equal(withinSendWindow(12, 22, 6), false);
  // any time
  assert.equal(withinSendWindow(5, 9, 9), true);
});

test("dailyCapReached compares count to cap", () => {
  assert.equal(dailyCapReached(19, 20), false);
  assert.equal(dailyCapReached(20, 20), true);
  assert.equal(dailyCapReached(21, 20), true);
});

test("composeEmail adds an unsubscribe footer; html is escaped, text is not", () => {
  const { text, html } = composeEmail({ body: "Hi <there>\nSecond line" });
  assert.ok(text.includes("Hi <there>"));
  assert.ok(text.includes("Second line"));
  assert.ok(/stop/i.test(text)); // unsubscribe footer
  assert.ok(html.includes("Hi &lt;there&gt;")); // escaped
  assert.ok(html.includes("<br>")); // newline → <br>
  assert.ok(/stop/i.test(html));
});

test("randomDelayMs stays within the requested bounds", () => {
  for (let i = 0; i < 50; i++) {
    const d = randomDelayMs(30, 120);
    assert.ok(d >= 30_000 && d <= 120_000, `delay ${d} out of bounds`);
  }
});
