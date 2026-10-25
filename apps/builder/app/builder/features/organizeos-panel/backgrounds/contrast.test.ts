import { beforeEach, describe, expect, test } from "vitest";
import type { CssProperty, StyleValue } from "@webstudio-is/css-engine";
import type { Prop } from "@webstudio-is/sdk";
import { showAttribute } from "@webstudio-is/react-sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import { contrastRatio, toRgba, type Rgba } from "./color";
import {
  checkSectionContrast,
  maxBackgroundColors,
  namedTextComponents,
  rendersDesignerChildrenOnly,
  rendersNoOwnText,
  type ContrastReport,
} from "./contrast";
import { builtInPalette, presets, type PresetId } from "./presets";
import {
  el,
  organizeosNamespace,
  registerTestMetas,
  root,
  setupProject,
  toStyleValue,
  type Node,
  type TestStyle,
} from "./test-fixtures";

beforeEach(() => {
  registerTestMetas();
});

// body > wrapper > section > ...children
const sectionSelector = ["section", "wrapper", "body"];

const page = (children: Node[]) =>
  el("body", "Body", [el("wrapper", "Box", [el("section", "Box", children)])]);

const check = (
  children: Node[],
  styles: TestStyle[] = [],
  extra: { props?: Prop[]; breakpoint?: string } = {}
) => {
  setupProject({ tree: page(children), styles, ...extra });
  return checkSectionContrast(sectionSelector);
};

const text = (id = "text", content = "Hello") => el(id, "Text", [content]);

const style = (
  on: string,
  property: CssProperty,
  value: string | StyleValue,
  extra: Partial<TestStyle> = {}
): TestStyle => ({ on, property, value, ...extra });

const unparsedLayers = (...values: string[]): StyleValue => ({
  type: "layers",
  value: values.map((value) => ({ type: "unparsed", value })),
});

const only = (report: ContrastReport) => {
  expect(report.groups).toHaveLength(1);
  return report.groups[0];
};

const presetStyles = (on: string, id: PresetId, imageAssetId?: string) =>
  presets
    .find((preset) => preset.id === id)!
    .build(builtInPalette, { imageAssetId })
    .map(({ property, value }) => style(on, property, value));

describe("solid backgrounds", () => {
  test("dark text on white passes, light gray fails", () => {
    const pass = only(check([text()], [style("text", "color", "#333333")]));
    expect(pass).toMatchObject({ result: "pass", threshold: 4.5 });
    expect(pass.ratio).toBeCloseTo(12.63, 1);

    const report = check([text()], [style("text", "color", "#aaaaaa")]);
    expect(report.summary).toBe("fail");
    expect(only(report)).toMatchObject({
      result: "fail",
      sampleInstanceId: "text",
      sampleInstanceSelector: ["text", "section", "wrapper", "body"],
    });
  });

  test("the section's own color is the background", () => {
    const report = check(
      [text()],
      [
        style("section", "background-color", "#111111"),
        style("text", "color", "#ffffff"),
      ]
    );
    expect(report.summary).toBe("pass");
  });

  test("text with alpha is composited over the background", () => {
    // black at 30% over white is a light gray
    const group = only(
      check([text()], [style("text", "color", "rgb(0 0 0 / 0.3)")])
    );
    expect(group.result).toBe("fail");
    expect(group.ratio).toBeGreaterThan(2);
    expect(group.ratio).toBeLessThan(2.2);
  });

  test("a root variable resolves for a deep descendant's color", () => {
    const report = check(
      [el("a", "Box", [el("b", "Box", [text()])])],
      [style(root, "--ink", "#111111"), style("text", "color", "var(--ink)")]
    );
    expect(only(report).result).toBe("pass");
  });

  test("a color that can't be read (color-mix) can't be checked", () => {
    const colorMix: StyleValue = {
      type: "unparsed",
      value: "color-mix(in srgb, #111111, #ffffff)",
    };
    expect(
      only(check([text()], [style("text", "color", colorMix)]))
    ).toMatchObject({
      result: "cant-check",
      reason: "the text color can't be read",
    });
    expect(
      only(
        check(
          [text()],
          [
            style("text", "color", "#111111"),
            style("section", "background-color", colorMix),
          ]
        )
      )
    ).toMatchObject({
      result: "cant-check",
      reason: "a background color can't be read",
    });
  });

  test("a breakpoint override is checked at its breakpoint", () => {
    const styles = [
      style("text", "color", "#111111"),
      style("text", "color", "#cccccc", { breakpoint: "tablet" }),
    ];
    expect(check([text()], styles).summary).toBe("pass");
    expect(check([text()], styles, { breakpoint: "tablet" }).summary).toBe(
      "fail"
    );
  });

  test("a section with no text reports none, not pass", () => {
    expect(check([el("box", "Box", [])])).toEqual({
      summary: "none",
      groups: [],
    });
  });
});

describe("thresholds", () => {
  // #949494 on white is about 3.03:1: passes 3:1, fails 4.5:1
  const gray = "#949494";

  test("24px is large", () => {
    const group = only(
      check(
        [text()],
        [style("text", "color", gray), style("text", "font-size", "24px")]
      )
    );
    expect(group).toMatchObject({ large: true, threshold: 3, result: "pass" });
  });

  test("23px is not large", () => {
    const group = only(
      check(
        [text()],
        [style("text", "color", gray), style("text", "font-size", "23px")]
      )
    );
    expect(group).toMatchObject({
      large: false,
      threshold: 4.5,
      result: "fail",
    });
  });

  test("18.66px at 700 is large, at 600 it is not", () => {
    const bold = only(
      check(
        [text()],
        [
          style("text", "color", gray),
          style("text", "font-size", "18.66px"),
          style("text", "font-weight", "700"),
        ]
      )
    );
    expect(bold).toMatchObject({ large: true, threshold: 3 });
    const semibold = only(
      check(
        [text()],
        [
          style("text", "color", gray),
          style("text", "font-size", "18.66px"),
          style("text", "font-weight", "600"),
        ]
      )
    );
    expect(semibold).toMatchObject({ large: false, threshold: 4.5 });
  });

  test("an unstyled h1 is held to 3:1", () => {
    const group = only(
      check(
        [el("heading", "Heading", ["Title"])],
        [style("heading", "color", gray)]
      )
    );
    expect(group).toMatchObject({
      fontSize: 32,
      fontWeight: 700,
      large: true,
      threshold: 3,
      result: "pass",
    });
  });

  test("clamp() is held to 4.5:1", () => {
    const group = only(
      check(
        [text()],
        [
          style("text", "color", gray),
          style("text", "font-size", "clamp(2rem, 5vw, 4rem)"),
        ]
      )
    );
    expect(group).toMatchObject({ large: false, threshold: 4.5 });
    expect(group.fontSize).toBeUndefined();
  });

  test("em, rem and % sizes are resolved", () => {
    const report = check(
      [
        el("em", "Text", ["A"]),
        el("rem", "Text", ["B"]),
        el("pct", "Text", ["C"]),
        el("kw", "Text", ["D"]),
      ],
      [
        style("section", "font-size", "20px"),
        style("em", "color", "#000001"),
        style("rem", "color", "#000002"),
        style("pct", "color", "#000003"),
        style("kw", "color", "#000004"),
        style("em", "font-size", "1.2em"),
        style("rem", "font-size", "1.5rem"),
        style("pct", "font-size", "150%"),
        style("kw", "font-size", "x-large"),
      ]
    );
    expect(report.groups.map((group) => group.fontSize).sort()).toEqual([
      24, 24, 24, 30,
    ]);
  });
});

describe("default styles", () => {
  test("an unstyled link is checked with its default color", () => {
    const group = only(check([el("link", "Link", ["Read more"])]));
    expect(toRgba(toStyleValue("color", "#0000ee"))).toEqual(group.color);
    expect(group.result).toBe("pass");
    // the default link blue fails on navy
    const navy = only(
      check(
        [el("link", "Link", ["Read more"])],
        [style("section", "background-color", "#000080")]
      )
    );
    expect(navy.result).toBe("fail");
  });
});

describe("gradients", () => {
  const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };

  test("a red-to-blue gradient under dark text fails between its stops", () => {
    const from = toRgba(toStyleValue("color", "#ff0000"))!;
    const to = toRgba(toStyleValue("color", "#3399ff"))!;
    // both ends pass on their own
    expect(contrastRatio(black, from)).toBeGreaterThan(4.5);
    expect(contrastRatio(black, to)).toBeGreaterThan(4.5);
    const group = only(
      check(
        [text()],
        [
          style("text", "color", "#000000"),
          style(
            "section",
            "background-image",
            "linear-gradient(90deg, #ff0000 0%, #3399ff 100%)"
          ),
        ]
      )
    );
    expect(group.result).toBe("fail");
    expect(group.ratio).toBeLessThan(4.5);
  });

  test.each([
    ["radial-gradient(in oklch, #ffffff, #eeeeee)"],
    ["radial-gradient(circle in oklch, #ffffff, #eeeeee)"],
    ["conic-gradient(in hsl longer hue, #ffffff, #eeeeee)"],
    ["conic-gradient(from 90deg in oklch, #ffffff, #eeeeee)"],
    ["linear-gradient(to right in srgb-linear, #ffffff, #eeeeee)"],
  ])("an interpolation method can't be checked: %s", (gradient) => {
    const group = only(
      check(
        [text()],
        [
          style("text", "color", "#000000"),
          style("section", "background-image", unparsedLayers(gradient)),
        ]
      )
    );
    expect(group).toMatchObject({
      result: "cant-check",
      reason: "a gradient uses an interpolation method",
    });
  });

  test("a color hint can't be checked", () => {
    const group = only(
      check(
        [text()],
        [
          style("text", "color", "#000000"),
          style(
            "section",
            "background-image",
            "linear-gradient(#ffffff, 30%, #eeeeee)"
          ),
        ]
      )
    );
    expect(group).toMatchObject({
      result: "cant-check",
      reason: "a gradient uses a color hint",
    });
  });

  test("an ancestor's gradient over a transparent color is in the stack", () => {
    const group = only(
      check(
        [text()],
        [
          style("text", "color", "#ffffff"),
          style(
            "wrapper",
            "background-image",
            "linear-gradient(#000000, #222222)"
          ),
        ]
      )
    );
    expect(group.result).toBe("pass");
    expect(group.ratio).toBeGreaterThan(15);
  });

  test("a strong Bloom under a Wash ancestor is checkable", () => {
    const report = check(
      [text()],
      [
        ...presetStyles("wrapper", "wash-light"),
        ...presetStyles("section", "bloom-strong"),
        style("text", "color", "#111111"),
      ]
    );
    expect(only(report).result).toBe("pass");
  });

  test("a background above the cap can't be checked", () => {
    // six layers of 30 distinct translucent samples each
    const layer = (shift: number) =>
      `linear-gradient(rgb(${shift} 0 0 / 0.5), rgb(0 ${shift} 255 / 0.4), rgb(255 255 ${shift} / 0.6), rgb(${shift} 128 0 / 0.3))`;
    const group = only(
      check(
        [text()],
        [
          style("text", "color", "#000000"),
          style(
            "section",
            "background-image",
            unparsedLayers(...[10, 60, 110, 160, 210, 250].map(layer))
          ),
        ]
      )
    );
    expect(maxBackgroundColors).toBe(10_000);
    expect(group).toMatchObject({
      result: "cant-check",
      reason: "background too complex",
    });
  });
});

describe("images", () => {
  const image: StyleValue = {
    type: "layers",
    value: [{ type: "image", value: { type: "asset", value: "asset-1" } }],
  };

  test("an image with no layer above it can't be checked", () => {
    const group = only(
      check(
        [text()],
        [
          style("text", "color", "#000000"),
          style("section", "background-image", image),
        ]
      )
    );
    expect(group).toMatchObject({
      result: "cant-check",
      reason: "add a scrim layer above the image",
    });
  });

  test("an image under the light scrim preset passes for its reference text", () => {
    const group = only(
      check(
        [text()],
        [
          ...presetStyles("section", "image-scrim-light", "asset-1"),
          style("text", "color", "#111111"),
        ]
      )
    );
    expect(group.result).toBe("pass");
  });

  test("text whose luminance lies inside the image's range fails", () => {
    const group = only(
      check(
        [text()],
        [
          style("text", "color", "#777777"),
          // a weak white scrim above the image
          style("section", "background-image", {
            type: "layers",
            value: [
              {
                type: "unparsed",
                value:
                  "linear-gradient(rgb(255 255 255 / 0.3), rgb(255 255 255 / 0.3))",
              },
              { type: "image", value: { type: "asset", value: "asset-1" } },
            ],
          }),
        ]
      )
    );
    expect(group).toMatchObject({ result: "fail", ratio: 1 });
  });

  test("a translucent child above an image is a layer above it", () => {
    const group = only(
      check(
        [el("box", "Box", [text()])],
        [
          style("section", "background-image", image),
          style("box", "background-color", "rgb(0 0 0 / 0.8)"),
          style("text", "color", "#ffffff"),
        ]
      )
    );
    expect(group.result).toBe("pass");
  });
});

describe("effects", () => {
  const effects: Array<[string, TestStyle["property"], string]> = [
    ["opacity", "opacity", "0.9"],
    ["filter", "filter", "blur(2px)"],
    ["backdrop filter", "backdrop-filter", "blur(2px)"],
    ["blend mode", "mix-blend-mode", "multiply"],
  ];
  const places = [
    ["the section", "section"],
    ["an ancestor", "wrapper"],
    ["an intermediate child", "box"],
    ["the text instance", "text"],
  ];

  describe.each(effects)("%s", (_name, property, value) => {
    test.each(places)("on %s can't be checked", (_place, on) => {
      const group = only(
        check(
          [el("box", "Box", [text()])],
          [style("text", "color", "#000000"), style(on, property, value)]
        )
      );
      expect(group.result).toBe("cant-check");
      expect(group.reason).toBeDefined();
    });
  });

  test("background-blend-mode other than normal can't be checked", () => {
    const group = only(
      check(
        [text()],
        [
          style("text", "color", "#000000"),
          style("section", "background-color", "#ffffff"),
          style("section", "background-image", "linear-gradient(red, blue)"),
          style("section", "background-blend-mode", "multiply"),
        ]
      )
    );
    expect(group).toMatchObject({
      result: "cant-check",
      reason: "a background blend mode is set",
    });
  });

  test("background-clip: text can't be checked", () => {
    const group = only(
      check(
        [text()],
        [
          style("text", "color", "#000000"),
          style("text", "background-image", "linear-gradient(red, blue)"),
          style("text", "background-clip", "text"),
        ]
      )
    );
    expect(group).toMatchObject({
      result: "cant-check",
      reason: "a background is clipped to the text",
    });
  });

  test("full opacity is fine", () => {
    const group = only(
      check(
        [text()],
        [style("text", "color", "#000000"), style("text", "opacity", "1")]
      )
    );
    expect(group.result).toBe("pass");
  });
});

describe("text collection", () => {
  test("an opaque child stops the descent, a translucent one does not", () => {
    const opaque = check(
      [el("card", "Box", [text()])],
      [
        style("card", "background-color", "#000000"),
        style("text", "color", "#ffffff"),
      ]
    );
    expect(opaque.groups).toEqual([]);

    const translucent = check(
      [el("card", "Box", [text()])],
      [
        style("card", "background-color", "rgb(0 0 0 / 0.9)"),
        style("text", "color", "#ffffff"),
      ]
    );
    expect(only(translucent)).toMatchObject({
      result: "pass",
      sampleInstanceId: "text",
    });
  });

  test("an opaque child with an image is not a stop", () => {
    const report = check(
      [el("card", "Box", [text()])],
      [
        style("card", "background-color", "#000000"),
        style(
          "card",
          "background-image",
          "linear-gradient(rgb(0 0 0 / 0.5), rgb(0 0 0 / 0.5))"
        ),
        style("text", "color", "#ffffff"),
      ]
    );
    expect(only(report).result).toBe("pass");
  });

  test("data-ws-show false is skipped and an expression is kept", () => {
    const props: Prop[] = [
      {
        id: "p1",
        instanceId: "hidden",
        name: showAttribute,
        type: "boolean",
        value: false,
      },
      {
        id: "p2",
        instanceId: "bound",
        name: showAttribute,
        type: "expression",
        value: "$ws$dataSource$x",
      },
    ];
    const report = check(
      [el("hidden", "Text", ["Hidden"]), el("bound", "Text", ["Bound"])],
      [style("hidden", "color", "#eeeeee"), style("bound", "color", "#111111")],
      { props }
    );
    expect(only(report).sampleInstanceId).toBe("bound");
  });

  test("display: none is skipped", () => {
    const report = check(
      [el("gone", "Box", [text()])],
      [style("gone", "display", "none"), style("text", "color", "#eeeeee")]
    );
    expect(report.summary).toBe("none");
  });

  test("an expression child is text", () => {
    const report = check([el("value", "Text", [{ expression: "'x'" }])]);
    expect(only(report).sampleInstanceId).toBe("value");
  });

  test("groups key on color, size, weight and outcome", () => {
    const report = check(
      [
        el("one", "Text", ["A"]),
        el("two", "Text", ["B"]),
        el("three", "Text", ["C"]),
      ],
      [
        style("one", "color", "#111111"),
        style("two", "color", "#111111"),
        style("three", "color", "#aaaaaa"),
      ]
    );
    expect(report.summary).toBe("fail");
    expect(report.groups.map((group) => group.result)).toEqual([
      "fail",
      "pass",
    ]);
  });

  test("a FieldMessage with no children is a group", () => {
    const report = check(
      [el("message", `${organizeosNamespace}:FieldMessage`, [])],
      [style("message", "color", "#111111")]
    );
    expect(only(report)).toMatchObject({
      sampleInstanceId: "message",
      result: "pass",
    });
  });

  test("a light [data-message] descendant of Questions fails on its own", () => {
    const report = check(
      [
        el("questions", `${organizeosNamespace}:Questions`, [
          el("message", "ws:descendant", []),
        ]),
      ],
      [
        style("questions", "color", "#111111"),
        style("message", "color", "#dddddd"),
      ],
      {
        props: [
          {
            id: "selector",
            instanceId: "message",
            name: "selector",
            type: "string",
            value: " [data-message]",
          },
        ],
      }
    );
    expect(report.summary).toBe("fail");
    expect(report.groups).toHaveLength(2);
    expect(report.groups[0]).toMatchObject({
      result: "fail",
      sampleInstanceId: "message",
      sampleInstanceSelector: [
        "message",
        "questions",
        "section",
        "wrapper",
        "body",
      ],
    });
    expect(report.groups[1]).toMatchObject({
      result: "pass",
      sampleInstanceId: "questions",
    });
  });

  test("a ws:descendant of a Box is not a text group", () => {
    const report = check([
      el("box", "Box", [el("styling", "ws:descendant", [])]),
    ]);
    expect(report.summary).toBe("none");
  });
});

describe("component coverage", () => {
  // built as organizeos-panel.test.tsx builds its map
  const registered = Object.keys(organizeosMetas).map(
    (name) => `${organizeosNamespace}:${name}`
  );

  test("every registered OrganizeOS component is classified", () => {
    const unclassified = registered.filter(
      (name) =>
        namedTextComponents.has(name) === false &&
        rendersNoOwnText.has(name) === false &&
        rendersDesignerChildrenOnly.has(name) === false
    );
    expect(unclassified).toEqual([]);
  });

  test("the lists name only registered components and do not overlap", () => {
    const organizeosNamed = Array.from(namedTextComponents).filter((name) =>
      name.startsWith(`${organizeosNamespace}:`)
    );
    const all = [
      ...organizeosNamed,
      ...rendersNoOwnText,
      ...rendersDesignerChildrenOnly,
    ];
    expect(new Set(all).size).toBe(all.length);
    for (const name of all) {
      expect(registered).toContain(name);
    }
  });
});
