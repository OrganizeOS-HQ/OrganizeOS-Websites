import { describe, expect, test } from "vitest";
import type {
  AnimationAction,
  AnimationActionView,
  ScrollAnimation,
  ViewAnimation,
} from "@webstudio-is/sdk";
import newScrollAnimations from "./__fixtures__/new-scroll-animations.json";
import newViewAnimations from "./__fixtures__/new-view-animations.json";
import { clampStagger, isPinned, planAction, type Play } from "./play-action";

const viewAnimations = newViewAnimations as ViewAnimation[];
const scrollAnimations = newScrollAnimations as ScrollAnimation[];

const percent = (value: number) => ({
  type: "unit" as const,
  value,
  unit: "%" as const,
});

// The three OrganizeOS presets (spec 4.4), as the Motion area writes them.
const reveal: AnimationActionView = {
  type: "view",
  animations: [
    {
      name: "Reveal",
      timing: {
        rangeStart: ["entry", percent(0)],
        rangeEnd: ["entry", percent(60)],
        fill: "backwards",
        easing: "ease-out",
      },
      keyframes: [
        {
          offset: 0,
          styles: {
            opacity: { type: "unit", value: 0, unit: "number" },
            translate: {
              type: "tuple",
              value: [
                { type: "unit", value: 0, unit: "number" },
                { type: "unit", value: 12, unit: "px" },
              ],
            },
          },
        },
      ],
    },
  ],
};

const parallax: AnimationActionView = {
  type: "view",
  animations: [
    {
      name: "Gentle parallax",
      timing: {
        rangeStart: ["cover", percent(0)],
        rangeEnd: ["cover", percent(100)],
        fill: "both",
        easing: "linear",
      },
      keyframes: [
        {
          offset: 0,
          styles: {
            translate: {
              type: "tuple",
              value: [
                { type: "unit", value: 0, unit: "number" },
                { type: "unit", value: 24, unit: "px" },
              ],
            },
          },
        },
        {
          offset: 1,
          styles: {
            translate: {
              type: "tuple",
              value: [
                { type: "unit", value: 0, unit: "number" },
                { type: "unit", value: -24, unit: "px" },
              ],
            },
          },
        },
      ],
    },
  ],
};

const view = (
  animations: ViewAnimation[],
  rest: Partial<AnimationActionView> = {}
): AnimationAction => ({ type: "view", animations, ...rest });

/** Parses "entry 12.5%" into its name and percentage. */
const parseRange = (range: string | undefined) => {
  const match = /^([a-z-]+) (-?[0-9.]+)%$/.exec(range ?? "");
  expect(match).not.toBeNull();
  return { name: match![1], value: Number(match![2]) };
};

const byTarget = (plays: Play[]) =>
  [...plays].sort((a, b) => a.targetIndex - b.targetIndex);

describe("the presets", () => {
  test("Reveal: one view play per target, camelCase keyframes, entry 0% to 60%", () => {
    const plan = planAction({ action: reveal, targetCount: 2, stagger: 0 });
    expect(plan.skipped).toEqual([]);
    expect(plan.plays).toEqual(
      [0, 1].map((targetIndex) => ({
        targetIndex,
        animationIndex: 0,
        timeline: { kind: "view", axis: "block", inset: "auto auto" },
        keyframes: [{ offset: 0, opacity: "0", translate: "0 12px" }],
        options: {
          easing: "ease-out",
          fill: "backwards",
          rangeStart: "entry 0%",
          rangeEnd: "entry 60%",
        },
      }))
    );
  });

  test("timing carries no duration or delay", () => {
    const action = view([
      {
        ...reveal.animations[0],
        timing: {
          ...reveal.animations[0].timing,
          duration: { type: "unit", value: 2, unit: "s" },
          delay: { type: "unit", value: 1, unit: "s" },
        },
      },
    ]);
    const [play] = planAction({ action, targetCount: 1 }).plays;
    expect(play.options).not.toHaveProperty("duration");
    expect(play.options).not.toHaveProperty("delay");
  });

  test("Reveal staggered: 8% steps from entry 0%, every end at entry 60%", () => {
    const plan = planAction({ action: reveal, targetCount: 4, stagger: 8 });
    expect(plan.plays.map((play) => play.options.rangeStart)).toEqual([
      "entry 0%",
      "entry 8%",
      "entry 16%",
      "entry 24%",
    ]);
    for (const play of plan.plays) {
      expect(play.options.rangeEnd).toBe("entry 60%");
    }
  });

  test("Gentle parallax: two keyframes over cover, fill both", () => {
    const [play] = planAction({ action: parallax, targetCount: 1 }).plays;
    expect(play.keyframes).toEqual([
      { offset: 0, translate: "0 24px" },
      { offset: 1, translate: "0 -24px" },
    ]);
    expect(play.options).toEqual({
      easing: "linear",
      fill: "both",
      rangeStart: "cover 0%",
      rangeEnd: "cover 100%",
    });
  });

  test("iterations: a count as given, infinite as Infinity", () => {
    const withIterations = (iterations: number | "infinite") =>
      planAction({
        action: view([
          {
            ...parallax.animations[0],
            timing: { ...parallax.animations[0].timing, iterations },
          },
        ]),
        targetCount: 1,
      }).plays[0].options.iterations;
    expect(withIterations(3)).toBe(3);
    expect(withIterations("infinite")).toBe(Infinity);
  });

  test("debug and isPinned do not change the plays", () => {
    const plain = planAction({ action: reveal, targetCount: 1 });
    const flagged = planAction({
      action: { ...reveal, debug: true, isPinned: true },
      targetCount: 1,
    });
    expect(flagged).toEqual(plain);
  });
});

describe("upstream's presets (fixtures of its editor's files)", () => {
  test("every view preset plays, none skipped", () => {
    const plan = planAction({ action: view(viewAnimations), targetCount: 1 });
    expect(plan.skipped).toEqual([]);
    expect(plan.plays).toHaveLength(viewAnimations.length);
  });

  test("every scroll preset plays, none skipped", () => {
    const plan = planAction({
      action: { type: "scroll", animations: scrollAnimations },
      targetCount: 1,
    });
    expect(plan.skipped).toEqual([]);
    expect(plan.plays).toHaveLength(scrollAnimations.length);
  });

  test("view presets: ranges as named-range strings", () => {
    const plan = planAction({ action: view(viewAnimations), targetCount: 1 });
    expect(
      plan.plays.map((play) => [play.options.rangeStart, play.options.rangeEnd])
    ).toEqual([
      ["cover 0%", "cover 100%"],
      ["entry 0%", "entry 100%"],
      ["exit 0%", "exit 100%"],
      ["entry 0%", "entry 100%"],
      ["exit 0%", "exit 100%"],
      ["contain 0%", "contain 50%"],
      ["contain 50%", "contain 100%"],
      ["cover 0%", "cover 50%"],
      ["cover 50%", "cover 100%"],
    ]);
  });

  test("Fade In, Fly In and Wipe In keyframes", () => {
    const plays = planAction({
      action: view(viewAnimations),
      targetCount: 1,
    }).plays;
    const byName = (name: string) =>
      plays[viewAnimations.findIndex((animation) => animation.name === name)];
    expect(byName("New Animation").keyframes).toEqual([{ offset: 0 }]);
    expect(byName("Fade In").keyframes).toEqual([{ offset: 0, opacity: "0" }]);
    expect(byName("Fly In").keyframes).toEqual([
      { offset: 0, translate: "0 100px" },
    ]);
    expect(byName("Fly Out").keyframes).toEqual([
      { offset: 1, translate: "0 -100px" },
    ]);
    expect(byName("Wipe In").keyframes).toEqual([
      { offset: 0, clipPath: "inset(0 100% 0 0)" },
      { offset: 1, clipPath: "inset(0 0 0 0)" },
    ]);
    expect(byName("Wipe Out").keyframes).toEqual([
      { offset: 0, clipPath: "inset(0 0 0 0)" },
      { offset: 1, clipPath: "inset(0 0 0 100%)" },
    ]);
    expect(byName("Wipe In").options.fill).toBe("backwards");
  });

  test("scroll presets: start is the offset, end is measured back from 100%", () => {
    const plays = planAction({
      action: { type: "scroll", animations: scrollAnimations },
      targetCount: 1,
    }).plays;
    expect(
      plays.map((play) => [play.options.rangeStart, play.options.rangeEnd])
    ).toEqual([
      ["0px", "calc(100% - 0px)"],
      ["0%", "50dvh"],
      ["calc(100% - 50dvh)", "calc(100% - 0%)"],
    ]);
    expect(plays[1].keyframes).toEqual([{ offset: 0, opacity: "0" }]);
  });
});

describe("timelines", () => {
  test("scroll: the action's source and axis, nearest and block by default", () => {
    const plan = (rest: Partial<AnimationAction>) =>
      planAction({
        action: { type: "scroll", animations: scrollAnimations, ...rest },
        targetCount: 1,
      }).plays[0].timeline;
    expect(plan({})).toEqual({
      kind: "scroll",
      source: "nearest",
      axis: "block",
    });
    expect(
      plan({ source: "root", axis: "x" } as Partial<AnimationAction>)
    ).toEqual({
      kind: "scroll",
      source: "root",
      axis: "x",
    });
    expect(plan({ source: "closest" } as Partial<AnimationAction>)).toEqual({
      kind: "scroll",
      source: "closest",
      axis: "block",
    });
  });

  test("view insets: auto when missing, units and unparsed values as written", () => {
    const inset = (rest: Partial<AnimationActionView>) =>
      planAction({ action: view(viewAnimations, rest), targetCount: 1 })
        .plays[0].timeline;
    expect(inset({})).toEqual({
      kind: "view",
      axis: "block",
      inset: "auto auto",
    });
    expect(
      inset({
        axis: "inline",
        insetStart: { type: "unit", value: 10, unit: "px" },
        insetEnd: { type: "keyword", value: "auto" },
      })
    ).toEqual({ kind: "view", axis: "inline", inset: "10px auto" });
    expect(
      inset({
        insetEnd: { type: "unparsed", value: "calc(10% + 4px)" },
      })
    ).toEqual({ kind: "view", axis: "block", inset: "auto calc(10% + 4px)" });
  });

  test("an unparsed range offset is written as its string", () => {
    const [play] = planAction({
      action: view([
        {
          ...reveal.animations[0],
          timing: {
            rangeStart: [
              "entry",
              { type: "unparsed", value: "calc(10% + 4px)" },
            ],
            rangeEnd: ["exit", { type: "unit", value: 2, unit: "em" }],
          },
        },
      ]),
      targetCount: 1,
    }).plays;
    expect(play.options.rangeStart).toBe("entry calc(10% + 4px)");
    expect(play.options.rangeEnd).toBe("exit 2em");
  });
});

describe("what does not play (spec 4.7)", () => {
  test("a subject: the whole action", () => {
    const plan = planAction({
      action: view(viewAnimations, { subject: "--card" }),
      targetCount: 3,
    });
    expect(plan).toEqual({ plays: [], skipped: [{ reason: "subject" }] });
  });

  test("an enabled list: that animation only", () => {
    const plan = planAction({
      action: view([
        {
          ...reveal.animations[0],
          enabled: [
            ["base", true],
            ["sm", false],
          ],
        },
        parallax.animations[0],
      ]),
      targetCount: 2,
    });
    expect(plan.skipped).toEqual([{ reason: "enabled", animationIndex: 0 }]);
    expect(plan.plays.map((play) => play.animationIndex)).toEqual([1, 1]);
  });

  test("a var range value: that animation", () => {
    for (const timing of [
      { rangeStart: ["entry", { type: "var", value: "start" }] },
      { rangeEnd: ["entry", { type: "var", value: "end" }] },
    ] as ViewAnimation["timing"][]) {
      const plan = planAction({
        action: view([{ ...reveal.animations[0], timing }]),
        targetCount: 1,
      });
      expect(plan).toEqual({
        plays: [],
        skipped: [{ reason: "var-range", animationIndex: 0 }],
      });
    }
    const scroll = planAction({
      action: {
        type: "scroll",
        animations: [
          {
            ...scrollAnimations[0],
            timing: { rangeEnd: ["end", { type: "var", value: "end" }] },
          },
        ],
      },
      targetCount: 1,
    });
    expect(scroll.skipped).toEqual([
      { reason: "var-range", animationIndex: 0 },
    ]);
  });

  test("a var inset: the whole action", () => {
    const plan = planAction({
      action: view(viewAnimations, {
        insetStart: { type: "var", value: "inset" },
      }),
      targetCount: 1,
    });
    expect(plan).toEqual({ plays: [], skipped: [{ reason: "var-range" }] });
  });

  test("an unconvertible keyframe value: that animation", () => {
    const unconvertible: ViewAnimation["keyframes"][number]["styles"][] = [
      {
        transform: {
          type: "function",
          name: "rotate",
          args: { type: "unit", value: 10, unit: "deg" },
        },
      },
      {
        "box-shadow": {
          type: "shadow",
          position: "outset",
          offsetX: { type: "unit", value: 1, unit: "px" },
          offsetY: { type: "unit", value: 1, unit: "px" },
        },
      },
      {
        "background-image": {
          type: "image",
          value: { type: "asset", value: "asset-id" },
        },
      },
    ];
    for (const styles of unconvertible) {
      const plan = planAction({
        action: view([
          {
            ...reveal.animations[0],
            keyframes: [
              { offset: 0, styles: { opacity: percent(0) } },
              { offset: 1, styles },
            ],
          },
          parallax.animations[0],
        ]),
        targetCount: 1,
      });
      expect(plan.skipped).toEqual([
        { reason: "unconvertible", animationIndex: 0 },
      ]);
      expect(plan.plays.map((play) => play.animationIndex)).toEqual([1]);
    }
  });

  test("a value that is not an action plays nothing and reports nothing", () => {
    for (const action of [
      undefined,
      null,
      "view",
      {},
      { type: "view" },
      { type: "other", animations: [] },
    ]) {
      expect(planAction({ action, targetCount: 2 })).toEqual({
        plays: [],
        skipped: [],
      });
    }
  });

  test("a malformed animation is unconvertible", () => {
    const plan = planAction({
      action: { type: "view", animations: [null, { keyframes: "x" }] },
      targetCount: 1,
    });
    expect(plan.skipped).toEqual([
      { reason: "unconvertible", animationIndex: 0 },
      { reason: "unconvertible", animationIndex: 1 },
    ]);
  });

  test("no targets, no plays", () => {
    expect(planAction({ action: reveal, targetCount: 0 })).toEqual({
      plays: [],
      skipped: [],
    });
  });
});

describe("stagger (spec 4.2, 14.3)", () => {
  const unstaggered = { start: 0, end: 60 };

  test.each([1, 2, 8, 30])(
    "%i targets: ends unchanged, the last keeps at least half, no zero-length range",
    (targetCount) => {
      const plan = planAction({ action: reveal, targetCount, stagger: 8 });
      const plays = byTarget(plan.plays);
      expect(plays).toHaveLength(targetCount);
      let previous = -Infinity;
      for (const play of plays) {
        const start = parseRange(play.options.rangeStart);
        const end = parseRange(play.options.rangeEnd);
        expect(start.name).toBe("entry");
        expect(end).toEqual({ name: "entry", value: unstaggered.end });
        expect(end.value - start.value).toBeGreaterThan(0);
        expect(start.value).toBeGreaterThanOrEqual(previous);
        previous = start.value;
      }
      const last = plays[plays.length - 1];
      const width =
        parseRange(last.options.rangeEnd).value -
        parseRange(last.options.rangeStart).value;
      expect(width).toBeGreaterThanOrEqual(
        0.5 * (unstaggered.end - unstaggered.start)
      );
    }
  );

  test("one target is never staggered (n = 1)", () => {
    const [play] = planAction({
      action: reveal,
      targetCount: 1,
      stagger: 20,
    }).plays;
    expect(play.options.rangeStart).toBe("entry 0%");
  });

  test("the step scales down for many targets", () => {
    const plays = byTarget(
      planAction({ action: reveal, targetCount: 30, stagger: 8 }).plays
    );
    // 0.5 * 60 / 29, floored to a thousandth
    expect(parseRange(plays[1].options.rangeStart).value).toBe(1.034);
    expect(parseRange(plays[29].options.rangeStart).value).toBeLessThanOrEqual(
      30
    );
    expect(parseRange(plays[29].options.rangeStart).value).toBeGreaterThan(
      29.9
    );
  });

  test("starts from the range's own start", () => {
    const action = view([
      {
        ...reveal.animations[0],
        timing: {
          ...reveal.animations[0].timing,
          rangeStart: ["entry", percent(10)],
          rangeEnd: ["entry", percent(90)],
        },
      },
    ]);
    const plays = byTarget(
      planAction({ action, targetCount: 3, stagger: 5 }).plays
    );
    expect(plays.map((play) => play.options.rangeStart)).toEqual([
      "entry 10%",
      "entry 15%",
      "entry 20%",
    ]);
  });

  test("ignored across named ranges, for non-percentages, and on scroll actions", () => {
    const timings: ViewAnimation["timing"][] = [
      { rangeStart: ["entry", percent(0)], rangeEnd: ["exit", percent(60)] },
      {
        rangeStart: ["entry", { type: "unit", value: 0, unit: "px" }],
        rangeEnd: ["entry", percent(60)],
      },
      {
        rangeStart: ["entry", percent(0)],
        rangeEnd: ["entry", { type: "unparsed", value: "calc(60%)" }],
      },
      { rangeEnd: ["entry", percent(60)] },
    ];
    for (const timing of timings) {
      const plays = planAction({
        action: view([{ ...reveal.animations[0], timing }]),
        targetCount: 3,
        stagger: 8,
      }).plays;
      const starts = new Set(plays.map((play) => play.options.rangeStart));
      expect(starts.size).toBe(1);
    }
    const scroll = planAction({
      action: { type: "scroll", animations: [scrollAnimations[1]] },
      targetCount: 3,
      stagger: 8,
    }).plays;
    expect(scroll.map((play) => play.options.rangeStart)).toEqual([
      "0%",
      "0%",
      "0%",
    ]);
  });

  test("an empty or reversed range is not staggered", () => {
    const plays = planAction({
      action: view([
        {
          ...reveal.animations[0],
          timing: {
            rangeStart: ["entry", percent(60)],
            rangeEnd: ["entry", percent(60)],
          },
        },
      ]),
      targetCount: 3,
      stagger: 8,
    }).plays;
    expect(new Set(plays.map((play) => play.options.rangeStart))).toEqual(
      new Set(["entry 60%"])
    );
  });
});

describe("clampStagger", () => {
  test("holds the prop to 0..20, anything else off", () => {
    expect(clampStagger(8)).toBe(8);
    expect(clampStagger("12")).toBe(12);
    expect(clampStagger(50)).toBe(20);
    expect(clampStagger(-3)).toBe(0);
    expect(clampStagger(undefined)).toBe(0);
    expect(clampStagger("")).toBe(0);
    expect(clampStagger("x")).toBe(0);
    expect(clampStagger(Number.NaN)).toBe(0);
  });

  test("a stagger above 20 plays as 20", () => {
    const action = view([
      {
        ...reveal.animations[0],
        timing: {
          rangeStart: ["cover", percent(0)],
          rangeEnd: ["cover", percent(100)],
        },
      },
    ]);
    const plays = byTarget(
      planAction({ action, targetCount: 2, stagger: 45 }).plays
    );
    expect(plays[1].options.rangeStart).toBe("cover 20%");
  });
});

describe("isPinned", () => {
  test("reads the action's Run on canvas switch", () => {
    expect(isPinned({ ...reveal, isPinned: true })).toBe(true);
    expect(isPinned(reveal)).toBe(false);
    expect(isPinned(undefined)).toBe(false);
  });
});
