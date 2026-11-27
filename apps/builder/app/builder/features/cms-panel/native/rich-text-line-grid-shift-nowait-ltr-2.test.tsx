// T29.7 (walks 5 to 8): the Shift walks past a rule in left-to-right text, with no wait,
// 20 of 20, end where they end with a wait.
import { describe, test } from "vitest";
import { shiftPastRuleWalks } from "./rich-text-line-cells-shift-past-rule";
import { expectNoWaitWalk } from "./rich-text-line-cells-shift-nowait";

const walks = shiftPastRuleWalks.filter((walk) => walk.d === "ltr").slice(4, 8);

describe("the Shift walks past a rule with no wait", () => {
  test.each(walks)(
    "$id: no wait, 20 of 20, ends where the walk with a wait ends",
    (walk) => expectNoWaitWalk(walk),
    120_000
  );
});
