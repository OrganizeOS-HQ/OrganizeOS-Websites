// T29.7 (walks 5 to 8): the Shift walks past a rule in right-to-left text, with no wait,
// 20 of 20, end where they end with a wait; 16.15's stops with a letter and
// Backspace with no wait.
import { describe, test } from "vitest";
import { shiftPastRuleWalks } from "./rich-text-line-cells-shift-past-rule";
import {
  expectNoWaitStop,
  expectNoWaitWalk,
} from "./rich-text-line-cells-shift-nowait";

const all = shiftPastRuleWalks.filter((walk) => walk.d === "rtl");
const walks = all.slice(4, 8);

describe("the Shift walks past a rule with no wait", () => {
  test.each(walks)(
    "$id: no wait, 20 of 20, ends where the walk with a wait ends",
    (walk) => expectNoWaitWalk(walk),
    120_000
  );
});

// rtl-Rlast's forward stops from the fifth, rtl-Rfirst's seventh stop back
const byId = (id: string) => all.find((walk) => walk.id === id)!;
describe("16.15's stops with no wait", () => {
  test.each([5, 6, 7, 8])(
    "rtl-Rlast, forward %i: a letter and Backspace with no wait equal them with a wait",
    (presses) => expectNoWaitStop(byId("rtl-Rlast"), presses, 0)
  );
  test("rtl-Rfirst, back 7: a letter and Backspace with no wait equal them with a wait", () =>
    expectNoWaitStop(byId("rtl-Rfirst"), 8, 7));
});
