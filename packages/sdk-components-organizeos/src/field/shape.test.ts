import { describe, expect, test } from "vitest";
import { fixtureCase } from "./read-fixture";
import {
  clampField,
  fieldDefaults,
  shapeNames,
  shapes,
  validColor,
  type Shape,
} from "./shape";

const inputs = (field: ReturnType<typeof clampField>) => ({
  width: field.width,
  height: field.height,
  spacing: field.spacing,
  focus: field.focus,
  zone: field.zone,
});

const fixtureInputs = (name: string) => {
  const { width, height, spacing, focus, zone } = fixtureCase(name);
  return { width, height, spacing, focus, zone };
};

describe("Shapes", () => {
  test("five boxes, Band 3:1 first", () => {
    expect(shapes).toEqual({
      Band: { width: 1800, height: 600 },
      Wide: { width: 1600, height: 900 },
      Panel: { width: 1600, height: 800 },
      Square: { width: 1000, height: 1000 },
      Tall: { width: 900, height: 1200 },
    });
    expect(shapeNames).toEqual(["Band", "Wide", "Panel", "Square", "Tall"]);
  });
});

describe("clampField: defaults", () => {
  test("no props: a Band box, density 40, focus 50/50, zone 60% by 50%, aqua into cream, no motion", () => {
    expect(clampField({})).toEqual({
      shape: "Band",
      width: 1800,
      height: 600,
      spacing: 40,
      focus: { x: 900, y: 300 },
      zone: { rx: 540, ry: 150 },
      innerColor: "#3FC9E0",
      outerColor: "#F4EFE6",
      motion: "None",
    });
    expect(fieldDefaults).toMatchObject({
      shape: "Band",
      density: 40,
      focusX: 50,
      focusY: 50,
      zoneWidth: 60,
      zoneHeight: 50,
      motion: "None",
    });
  });

  test.each(shapeNames)(
    "the defaults on %s are the shared fixture's default case",
    (shape: Shape) => {
      expect(inputs(clampField({ shape }))).toEqual(
        fixtureInputs(`default-${shape.toLowerCase()}`)
      );
    }
  );

  test("anything that is not a value falls back to the default", () => {
    const junk = [undefined, null, "40", Number.NaN, Infinity, {}, [], true];
    for (const value of junk) {
      expect(
        clampField({
          shape: value,
          density: value,
          focusX: value,
          focusY: value,
          zoneWidth: value,
          zoneHeight: value,
          innerColor: value,
          outerColor: value,
          motion: value,
        }),
        String(value)
      ).toEqual(clampField({}));
    }
    expect(clampField({ shape: "band" }).shape).toBe("Band");
    expect(clampField({ shape: "toString" }).shape).toBe("Band");
    expect(clampField({ motion: "settle" }).motion).toBe("None");
  });
});

describe("clampField: every prop", () => {
  test("Shape picks the box", () => {
    for (const shape of shapeNames) {
      const field = clampField({ shape });
      expect(field.shape).toBe(shape);
      expect([field.width, field.height]).toEqual([
        shapes[shape].width,
        shapes[shape].height,
      ]);
    }
  });

  test("Density is the spacing in box units, 24..96, the same on every Shape", () => {
    expect(clampField({ density: 10 }).spacing).toBe(24);
    expect(clampField({ density: 24 }).spacing).toBe(24);
    expect(clampField({ density: 55.5 }).spacing).toBe(55.5);
    expect(clampField({ density: 96 }).spacing).toBe(96);
    expect(clampField({ density: 500 }).spacing).toBe(96);
    for (const shape of shapeNames) {
      expect(clampField({ shape, density: 64 }).spacing).toBe(64);
    }
    expect(inputs(clampField({ shape: "Wide", density: 24 }))).toEqual(
      fixtureInputs("wide-density-24")
    );
    expect(inputs(clampField({ shape: "Wide", density: 96 }))).toEqual(
      fixtureInputs("wide-density-96")
    );
  });

  test("Focus X and Y are percentages of the box, 10..90", () => {
    expect(clampField({ focusX: 0, focusY: 100 }).focus).toEqual({
      x: 180,
      y: 540,
    });
    expect(clampField({ focusX: 25, focusY: 75 }).focus).toEqual({
      x: 450,
      y: 450,
    });
    expect(clampField({ focusX: -5, focusY: 95 }).focus).toEqual(
      clampField({ focusX: 10, focusY: 90 }).focus
    );
  });

  test("Zone width and height are the ellipse's diameters in percent of the box, 10..90", () => {
    // Square, centred: 0.8 of the distance to the edge is 400, so no clamp
    expect(
      clampField({ shape: "Square", zoneWidth: 70, zoneHeight: 20 }).zone
    ).toEqual({ rx: 350, ry: 100 });
    expect(
      clampField({ shape: "Square", zoneWidth: 1, zoneHeight: 1 }).zone
    ).toEqual({ rx: 50, ry: 50 });
    expect(
      clampField({ shape: "Square", zoneWidth: 99, zoneHeight: 99 }).zone
    ).toEqual(
      clampField({ shape: "Square", zoneWidth: 90, zoneHeight: 90 }).zone
    );
  });

  test("Inner and Outer color pass through validColor", () => {
    const field = clampField({
      innerColor: "var(--brand)",
      outerColor: "red; background: url(x)",
    });
    expect(field.innerColor).toBe("var(--brand)");
    expect(field.outerColor).toBe("#F4EFE6");
  });

  test("Motion is None or Settle", () => {
    expect(clampField({ motion: "Settle" }).motion).toBe("Settle");
    expect(clampField({ motion: "None" }).motion).toBe("None");
  });
});

describe("clampField: the zone clamp", () => {
  test("each radius is at most 0.8 of the focus-to-nearest-edge distance on its axis", () => {
    // 90% of a Band box would reach past the edges: rx 810 > 0.8 * 900
    expect(clampField({ zoneWidth: 90, zoneHeight: 90 }).zone).toEqual({
      rx: 720,
      ry: 240,
    });
    // a focus near the edge holds the zone to 0.8 of that distance
    expect(
      inputs(clampField({ shape: "Wide", focusX: 10, focusY: 10 }))
    ).toEqual(fixtureInputs("wide-focus-10-10"));
    expect(
      inputs(clampField({ shape: "Wide", focusX: 90, focusY: 90 }))
    ).toEqual(fixtureInputs("wide-focus-90-90"));
  });

  test("never lets the zone touch an edge, where the generator draws every arm solid", () => {
    const touching = fixtureCase("wide-zone-touching-edge");
    const field = clampField({ shape: "Wide", zoneWidth: 90, zoneHeight: 90 });
    expect(field.zone.rx).toBeLessThan(touching.zone.rx);
    for (const shape of shapeNames) {
      for (const [focusX, focusY] of [
        [10, 10],
        [50, 50],
        [90, 10],
      ]) {
        const { width, height, focus, zone } = clampField({
          shape,
          focusX,
          focusY,
          zoneWidth: 90,
          zoneHeight: 90,
        });
        expect(zone.rx).toBeLessThanOrEqual(
          0.8 * Math.min(focus.x, width - focus.x)
        );
        expect(zone.ry).toBeLessThanOrEqual(
          0.8 * Math.min(focus.y, height - focus.y)
        );
      }
    }
  });
});

describe("validColor", () => {
  test.each([
    "#fff",
    "#ffff",
    "#3FC9E0",
    "#3FC9E080",
    "rgb(63 201 224)",
    "rgba(63, 201, 224, 0.5)",
    "rgb(63 201 224 / 50%)",
    "hsl(189 72% 56%)",
    "hsla(189, 72%, 56%, 0.4)",
    "oklch(0.78 0.12 210)",
    "oklch(78% 0.12 210deg / 0.8)",
    "oklab(0.78 -0.08 -0.06)",
    "color(display-p3 1 0 0)",
    "red",
    "Transparent",
    "currentcolor",
    "var(--name)",
    "var(--brand-aqua_2)",
    "var(--name, #fff)",
    "var(--name, rgb(0 0 0))",
    "var(--a, var(--b, red))",
    "  #fff  ",
  ])("accepts %s", (value) => {
    expect(validColor(value, "fallback")).toBe(value.trim());
  });

  test.each([
    "red; background: url(x)",
    "red}",
    "red/*",
    "rgb(0 0 0",
    "rgb(0 0 0))",
    "rgb((0 0 0)",
    "var(--x, url(x))",
    "var(--x); color: red",
    "var(--x, red); background: url(x)",
    "var(x)",
    "var(--x",
    "url(x)",
    "image(red)",
    "expression(alert(1))",
    "#ggg",
    "#12345",
    "rgb(0 0 0) red",
    'rgb("0")',
    "red\\;",
    "",
    "   ",
    "linear-gradient(red, blue)",
    `#${"f".repeat(300)}`,
  ])("rejects %s", (value) => {
    expect(validColor(value, "fallback")).toBe("fallback");
  });

  test("anything but a string is the fallback", () => {
    for (const value of [undefined, null, 0, {}, ["red"]]) {
      expect(validColor(value, "#000")).toBe("#000");
    }
  });
});
