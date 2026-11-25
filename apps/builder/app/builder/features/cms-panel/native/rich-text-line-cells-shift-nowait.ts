// The no-wait form of the Shift walks past a rule (T29.7, 15.12): each walk
// of `shiftPastRuleWalks` with a wait (settle and 150 ms after each press),
// then 20 times with no wait; the focus at the end of each way and the
// letter and Backspace at the 16.15 stops are the same.
import { expect } from "vitest";
import {
  at,
  caretKey,
  keys,
  letter,
  backspace,
  mount,
  noWait,
  short,
  type Step,
  waited,
} from "./rich-text-line-test-kit";
import { lastHtml } from "./rich-text-test-harness";
import {
  MOST_PRESSES,
  pageEdge,
  type ShiftWalk,
} from "./rich-text-line-cells-shift-past-rule";

const shiftKey = (key: string) => keys(`{Shift>}{${key}}{/Shift}`);

/** The walk with a wait: the number of presses each way, and its stops. */
const waitedWalk = async (walk: ShiftWalk) => {
  await mount(walk.stored);
  await at(walk.start)();
  const stops: Record<"F" | "B", string[]> = { F: [], B: [] };
  for (const [way, key] of [
    ["F", walk.forward],
    ["B", walk.backward],
  ] as const) {
    for (let press = 1; press <= MOST_PRESSES; press += 1) {
      await waited(shiftKey(key))();
      stops[way].push(caretKey());
      if (pageEdge() === (way === "F" ? "end" : "start")) {
        break;
      }
    }
  }
  return stops;
};

const pressesOf = (key: string, count: number): Step[] =>
  Array.from({ length: count }, () => shiftKey(key));

/** The walk with no wait, 20 times: each way ends where the waited one does. */
export const expectNoWaitWalk = async (walk: ShiftWalk) => {
  const stops = await waitedWalk(walk);
  const differ: string[] = [];
  for (let time = 0; time < 20; time += 1) {
    await mount(walk.stored);
    await at(walk.start)();
    await noWait(...pressesOf(walk.forward, stops.F.length))();
    const forward = caretKey();
    await noWait(...pressesOf(walk.backward, stops.B.length))();
    const backward = caretKey();
    if (forward !== stops.F.at(-1) || backward !== stops.B.at(-1)) {
      differ.push(`${time}: ${forward} ${backward}`);
    }
  }
  expect(differ).toEqual([]);
};

/**
 * A stop of the walk, `forward` presses then `backward` presses, then a
 * letter or Backspace: no wait equals with a wait.
 */
export const expectNoWaitStop = async (
  walk: ShiftWalk,
  forward: number,
  backward: number
) => {
  for (const [name, key] of [
    ["a letter", letter],
    ["Backspace", backspace],
  ] as const) {
    const steps = [
      ...pressesOf(walk.forward, forward),
      ...pressesOf(walk.backward, backward),
      key,
    ];
    const run = async (pace: typeof noWait) => {
      const onChange = await mount(walk.stored);
      await at(walk.start)();
      await pace(...steps)();
      return onChange.mock.calls.length > 0
        ? short(lastHtml(onChange))
        : "none";
    };
    const slow = await run(waited);
    expect(slow, name).not.toBe("none");
    expect(await run(noWait), name).toBe(slow);
  }
};
