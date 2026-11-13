import { enableMapSet } from "immer";
import { beforeEach, describe, expect, test } from "vitest";
import { ROOT_INSTANCE_ID } from "@webstudio-is/sdk";
import { getComputedStyleDecl } from "~/shared/style-object-model";
import { quantize, toRgba } from "./color";
import { buildSectionStyleModel, listRootColorVariables } from "./style-model";
import {
  el,
  registerTestMetas,
  root,
  setupProject,
  type Node,
  type TestStyle,
  type TestToken,
} from "~/builder/features/organizeos-panel/test-fixtures";

enableMapSet();

beforeEach(() => {
  registerTestMetas();
});

const section = ["section", "body"];

const page = (children: Node[]) =>
  el("body", "Body", [el("section", "Box", children)]);

const setup = (
  children: Node[],
  styles: TestStyle[] = [],
  extra: { tokens?: TestToken[]; breakpoint?: string } = {}
) => setupProject({ tree: page(children), styles, ...extra });

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

  // as upstream's $instanceTags reads it: a List's tag is its `ordered` prop's
  test("tags a List by its ordered prop, ol or ul", () => {
    setupProject({
      tree: page([el("ordered", "List"), el("unordered", "List")]),
      props: [
        {
          id: "ordered-prop",
          instanceId: "ordered",
          name: "ordered",
          type: "boolean",
          value: true,
        },
      ],
    });
    const model = buildSectionStyleModel(section);
    expect(model.instanceTags.get("ordered")).toBe("ol");
    expect(model.instanceTags.get("unordered")).toBe("ul");
  });
});

describe("colors through the model", () => {
  test("a link's default color resolves through the model", () => {
    setup([el("link", "Link", ["Read more"])]);
    const { usedValue } = getComputedStyleDecl({
      model: buildSectionStyleModel(section),
      instanceSelector: ["link", "section", "body", ROOT_INSTANCE_ID],
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
      instanceSelector: ["text", "b", "a", "section", "body", ROOT_INSTANCE_ID],
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
