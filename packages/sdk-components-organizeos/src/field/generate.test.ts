import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  ARM_HEIGHT,
  armTransform,
  convergenceField,
  LEVELS,
  levelStyle,
  zoneDistance,
} from "./generate";
import { fixturePath, readFixture, toTuple } from "./read-fixture";

const fixture = readFixture();

const generate = (item: (typeof fixture.cases)[number]) =>
  convergenceField(
    item.width,
    item.height,
    item.spacing,
    item.focus,
    item.zone
  );

describe("the shared fixture", () => {
  test("is the homepage generator's, named by its source and commit", () => {
    expect(fixture.source).toBe("client/lib/marketing/convergence-field.ts");
    expect(fixture.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  test("holds the homepage's two uses, each Shape's defaults and the edge cases", () => {
    expect(fixture.cases.map((item) => item.name)).toEqual([
      "homepage-thesis-band",
      "homepage-pillars",
      "default-band",
      "default-wide",
      "default-panel",
      "default-square",
      "default-tall",
      "wide-density-24",
      "wide-density-96",
      "wide-focus-10-10",
      "wide-focus-90-90",
      "wide-zone-touching-edge",
    ]);
    for (const item of fixture.cases) {
      expect(item.arms.length, item.name).toBeGreaterThan(0);
    }
  });

  test("is the exact bytes the OrganizeOS script writes: one case per line, a trailing newline", () => {
    const text = readFileSync(fixturePath, "utf8");
    const lines = text.split("\n");
    expect(lines).toHaveLength(fixture.cases.length + 3);
    expect(lines.at(-1)).toBe("");
    expect(lines.at(-2)).toBe("]}");
    expect(lines[0]).toBe(
      `{"source":"${fixture.source}","commit":"${fixture.commit}","cases":[`
    );
    fixture.cases.forEach((item, index) => {
      const last = index === fixture.cases.length - 1;
      expect(lines[index + 1]).toBe(
        `${JSON.stringify(item)}${last ? "" : ","}`
      );
    });
  });
});

describe("convergenceField", () => {
  test.each(fixture.cases.map((item) => [item.name, item] as const))(
    "reproduces the fixture exactly: %s",
    (_name, item) => {
      // Compared as the JSON the fixture holds: the generator gives -0 for
      // some angles, which JSON writes as 0 and `toEqual` tells apart.
      expect(JSON.stringify(generate(item).map(toTuple))).toBe(
        JSON.stringify(item.arms)
      );
    }
  );

  test("pins the generator at a zone touching the edge: every arm solid", () => {
    const item = fixture.cases.find(
      (candidate) => candidate.name === "wide-zone-touching-edge"
    )!;
    expect(item.zone.rx).toBe(item.focus.x);
    const levels = new Set(generate(item).map((arm) => arm.level));
    expect([...levels]).toEqual([LEVELS]);
  });

  test.each(fixture.cases.map((item) => [item.name, item] as const))(
    "is mirror-symmetric around a centred focus: %s",
    (_name, item) => {
      if (item.focus.x * 2 !== item.width || item.focus.y * 2 !== item.height) {
        return;
      }
      const arms = generate(item);
      const at = new Map(arms.map((arm) => [`${arm.x},${arm.y}`, arm]));
      for (const arm of arms) {
        const mirroredX = at.get(`${2 * item.focus.x - arm.x},${arm.y}`);
        const mirroredY = at.get(`${arm.x},${2 * item.focus.y - arm.y}`);
        expect(mirroredX?.level).toBe(arm.level);
        expect(mirroredX?.size).toBe(arm.size);
        expect(mirroredY?.level).toBe(arm.level);
        expect(mirroredY?.size).toBe(arm.size);
      }
    }
  );

  test.each(fixture.cases.map((item) => [item.name, item] as const))(
    "leaves the clear zone empty and points every arm in 45-degree steps: %s",
    (_name, item) => {
      for (const arm of generate(item)) {
        expect(zoneDistance(arm, item.focus, item.zone)).toBeGreaterThan(1);
        expect(Math.abs(arm.deg % 45)).toBe(0);
        expect(arm.deg).toBeGreaterThan(-180);
        expect(arm.deg).toBeLessThanOrEqual(180);
        expect(arm.level).toBeGreaterThanOrEqual(1);
        expect(arm.level).toBeLessThanOrEqual(LEVELS);
      }
    }
  );
});

describe("the homepage's drawing math", () => {
  test("an arm's transform: translate, rotate, then scale to its size", () => {
    expect(
      armTransform({ x: 120, y: 45, deg: -135, size: 15.4, level: 3 })
    ).toBe(
      `translate(120 45) rotate(-135) scale(${(15.4 / ARM_HEIGHT).toFixed(3)})`
    );
    expect(armTransform({ x: 1, y: 2, deg: 0, size: 77, level: 6 })).toBe(
      "translate(1 2) rotate(0) scale(1.000)"
    );
  });

  test("each fade level mixes the outer color into the inner one, more opaque toward the edge", () => {
    expect(levelStyle(1, "#F4EFE6", "#3FC9E0")).toEqual({
      fill: "color-mix(in srgb, #F4EFE6 17%, #3FC9E0)",
      opacity: 0.37,
    });
    expect(levelStyle(3, "var(--outer)", "var(--inner)")).toEqual({
      fill: "color-mix(in srgb, var(--outer) 50%, var(--inner))",
      opacity: 0.6,
    });
    expect(levelStyle(LEVELS, "a", "b")).toEqual({
      fill: "color-mix(in srgb, a 100%, b)",
      opacity: 0.95,
    });
  });
});
