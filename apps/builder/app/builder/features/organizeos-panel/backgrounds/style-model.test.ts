import { enableMapSet } from "immer";
import { beforeEach, describe, expect, test } from "vitest";
import { ROOT_INSTANCE_ID } from "@webstudio-is/sdk";
import { getComputedStyleDecl } from "~/shared/style-object-model";
import { quantize, toRgba } from "./color";
import {
  buildSectionStyleModel,
  listRootColorVariables,
  resolveFontSize,
  resolveFontWeight,
  selectorOf,
} from "./style-model";
import {
  el,
  registerTestMetas,
  root,
  setupProject,
  type Node,
  type TestStyle,
  type TestToken,
} from "./test-fixtures";

enableMapSet();

beforeEach(() => {
  registerTestMetas();
});

const section = ["section", "body"];

const page = (children: Node[]) =>
  el("body", "Body", [el("section", "Box", children)]);

const size = (instanceId: string) =>
  resolveFontSize(
    buildSectionStyleModel(section),
    selectorOf(instanceId, section)!
  );

const weight = (instanceId: string) =>
  resolveFontWeight(
    buildSectionStyleModel(section),
    selectorOf(instanceId, section)!
  );

const setup = (
  children: Node[],
  styles: TestStyle[] = [],
  extra: { tokens?: TestToken[]; breakpoint?: string } = {}
) => setupProject({ tree: page(children), styles, ...extra });

describe("selectorOf", () => {
  test("is the full selector up to the Global Root", () => {
    setup([el("box", "Box", [el("text", "Text", ["Hi"])])]);
    expect(selectorOf("text", section)).toEqual([
      "text",
      "box",
      "section",
      "body",
      ROOT_INSTANCE_ID,
    ]);
    expect(selectorOf("section", section)).toEqual([
      "section",
      "body",
      ROOT_INSTANCE_ID,
    ]);
  });

  test("is undefined outside the section", () => {
    setup([]);
    expect(selectorOf("elsewhere", section)).toBeUndefined();
  });
});

describe("buildSectionStyleModel", () => {
  test("knows the tags and components of the whole subtree and the root", () => {
    setup([el("box", "Box", [el("heading", "Heading", ["Title"])])]);
    const model = buildSectionStyleModel(section);
    expect(model.instanceComponents.get(ROOT_INSTANCE_ID)).toBe("ws:root");
    expect(model.instanceComponents.get("heading")).toBe("Heading");
    expect(model.instanceTags.get("heading")).toBe("h1");
    expect(model.instanceTags.get("body")).toBe("body");
    expect(model.matchingStates.size).toBe(0);
  });
});

describe("resolveFontSize and resolveFontWeight", () => {
  test("an h1 with no styles is 32px and 700", () => {
    setup([el("heading", "Heading", ["Title"])]);
    expect(size("heading")).toBe(32);
    expect(weight("heading")).toBe(700);
  });

  test("a Bold inside an unstyled h1 is 32px, not 64px", () => {
    setup([el("heading", "Heading", [el("bold", "Bold", ["Strong"])])]);
    expect(size("bold")).toBe(32);
    expect(weight("bold")).toBe(700);
  });

  test("an em inherited by a child is not rescaled", () => {
    setup(
      [el("box", "Box", [el("text", "Text", ["Hi"])])],
      [{ on: "box", property: "font-size", value: "2em" }]
    );
    expect(size("box")).toBe(32);
    expect(size("text")).toBe(32);
  });

  test("rem against 16px", () => {
    setup(
      [el("text", "Text", ["Hi"])],
      [
        { on: "section", property: "font-size", value: "10px" },
        { on: "text", property: "font-size", value: "1.5rem" },
      ]
    );
    expect(size("text")).toBe(24);
  });

  test("% against the parent's px", () => {
    setup(
      [el("text", "Text", ["Hi"])],
      [
        { on: "section", property: "font-size", value: "20px" },
        { on: "text", property: "font-size", value: "150%" },
      ]
    );
    expect(size("text")).toBe(30);
  });

  test("absolute keywords per CSS", () => {
    setup(
      [el("text", "Text", ["Hi"])],
      [{ on: "text", property: "font-size", value: "large" }]
    );
    expect(size("text")).toBe(18);
  });

  test("clamp() is not resolved", () => {
    setup(
      [el("text", "Text", ["Hi"])],
      [{ on: "text", property: "font-size", value: "clamp(1rem, 2vw, 3rem)" }]
    );
    expect(size("text")).toBeUndefined();
  });

  test("a token's font-size", () => {
    setup(
      [el("text", "Text", ["Hi"])],
      [{ on: "text", property: "font-size", value: "28px", token: "big" }],
      { tokens: [{ id: "big", name: "Big", on: ["text"] }] }
    );
    expect(size("text")).toBe(28);
  });

  test("a breakpoint override applies at its breakpoint only", () => {
    const styles: TestStyle[] = [
      { on: "text", property: "font-size", value: "16px" },
      {
        on: "text",
        property: "font-size",
        value: "30px",
        breakpoint: "tablet",
      },
    ];
    setup([el("text", "Text", ["Hi"])], styles);
    expect(size("text")).toBe(16);
    setup([el("text", "Text", ["Hi"])], styles, { breakpoint: "tablet" });
    expect(size("text")).toBe(30);
  });

  test("weights: numbers, normal, bold; bolder is not resolved", () => {
    setup(
      [
        el("a", "Text", ["A"]),
        el("b", "Text", ["B"]),
        el("c", "Text", ["C"]),
        el("d", "Text", ["D"]),
      ],
      [
        { on: "a", property: "font-weight", value: "600" },
        { on: "b", property: "font-weight", value: "bold" },
        { on: "c", property: "font-weight", value: "bolder" },
      ]
    );
    expect(weight("a")).toBe(600);
    expect(weight("b")).toBe(700);
    expect(weight("c")).toBeUndefined();
    expect(weight("d")).toBe(400);
  });
});

describe("colors through the model", () => {
  test("a link's default color resolves through the model", () => {
    setup([el("link", "Link", ["Read more"])]);
    const { usedValue } = getComputedStyleDecl({
      model: buildSectionStyleModel(section),
      instanceSelector: selectorOf("link", section),
      property: "color",
    });
    expect(quantize(toRgba(usedValue)!)).toBe("0,0,238,255");
  });

  test("a variable defined on Global Root resolves for a deep descendant", () => {
    setup(
      [el("a", "Box", [el("b", "Box", [el("text", "Text", ["Hi"])])])],
      [
        { on: root, property: "--brand", value: "#1597b0" },
        { on: "text", property: "color", value: "var(--brand)" },
      ]
    );
    const { usedValue } = getComputedStyleDecl({
      model: buildSectionStyleModel(section),
      instanceSelector: selectorOf("text", section),
      property: "color",
    });
    expect(quantize(toRgba(usedValue)!)).toBe("21,151,176,255");
  });
});

describe("listRootColorVariables", () => {
  test("lists Global Root's color variables, not a Box's, and reads a named color", () => {
    setup(
      [el("box", "Box", [])],
      [
        { on: root, property: "--brand", value: "#1597b0" },
        { on: root, property: "--accent", value: "teal" },
        { on: root, property: "--alias", value: "var(--brand)" },
        { on: root, property: "--space", value: "12px" },
        {
          on: root,
          property: "--wide",
          value: "#000000",
          breakpoint: "tablet",
        },
        { on: "box", property: "--box-color", value: "#ff0000" },
      ]
    );
    const colors = listRootColorVariables(buildSectionStyleModel(section));
    expect(
      colors.map(({ variable, rgba }) => [variable, quantize(rgba)])
    ).toEqual([
      ["brand", "21,151,176,255"],
      ["accent", "0,128,128,255"],
      ["alias", "21,151,176,255"],
    ]);
  });

  test("includes a breakpoint's variable at that breakpoint", () => {
    setup(
      [],
      [
        {
          on: root,
          property: "--wide",
          value: "#000000",
          breakpoint: "tablet",
        },
      ],
      { breakpoint: "tablet" }
    );
    expect(
      listRootColorVariables(buildSectionStyleModel(section)).map(
        (color) => color.variable
      )
    ).toEqual(["wide"]);
  });
});
