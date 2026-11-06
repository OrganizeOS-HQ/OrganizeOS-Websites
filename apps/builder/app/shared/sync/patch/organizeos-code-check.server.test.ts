import { describe, expect, test } from "vitest";
import {
  createDefaultPages,
  serializeData,
  serializePages,
} from "@webstudio-is/project-build";
import type { Prop } from "@webstudio-is/sdk";
import { findRefusedEntries } from "./organizeos-code-check.server";
import type { PatchEntry } from "./patch-normalize.server";

const expressionProp = (id: string, value: string): Prop => ({
  id,
  instanceId: "box",
  name: "title",
  type: "expression",
  value,
});

const build = (props: Prop[] = []) => ({
  pages: serializePages(
    createDefaultPages({ homePageId: "home", rootInstanceId: "box" })
  ),
  instances: serializeData(
    new Map([
      ["box", { type: "instance", id: "box", component: "Box", children: [] }],
    ])
  ),
  props: serializeData(new Map(props.map((prop) => [prop.id, prop]))),
  resources: "[]",
  dataSources: "[]",
});

let seq = 0;
const entry = (
  namespace: string,
  patches: Array<{ op: string; path: unknown[]; value?: unknown }>
): PatchEntry =>
  ({
    seq: ++seq,
    transaction: { id: `tx-${seq}`, payload: [{ namespace, patches }] },
    writer: { type: "token", authToken: "token" },
  }) as unknown as PatchEntry;

describe("findRefusedEntries", () => {
  test("refuses an entry that writes a refused expression, with the reason", () => {
    const write = entry("props", [
      { op: "add", path: ["p"], value: expressionProp("p", "a()") },
    ]);
    expect(findRefusedEntries(build(), [write])).toEqual(
      new Map([[write, "This function is not allowed"]])
    );
  });

  test("refuses a refused field written on its own", () => {
    const write = entry("props", [
      { op: "replace", path: ["p", "value"], value: "1; 2" },
    ]);
    expect(
      findRefusedEntries(build([expressionProp("p", "1")]), [write]).has(write)
    ).toBe(true);
  });

  test.each([
    [
      "an instance tag",
      entry("instances", [
        { op: "replace", path: ["box", "tag"], value: "script" },
      ]),
    ],
    [
      "a text expression",
      entry("instances", [
        {
          op: "replace",
          path: ["box", "children"],
          value: [{ type: "expression", value: "a()" }],
        },
      ]),
    ],
    [
      "a resource",
      entry("resources", [
        {
          op: "add",
          path: ["r"],
          value: {
            id: "r",
            name: "R",
            method: "get",
            url: `"https://example.org"`,
            headers: [{ name: "a b", value: `"b"` }],
          },
        },
      ]),
    ],
    [
      "a page setting",
      entry("pages", [
        {
          op: "replace",
          path: ["pages", "home", "meta", "description"],
          value: "a()",
        },
      ]),
    ],
    [
      "an action naming a variable not in the build",
      entry("props", [
        {
          op: "add",
          path: ["a"],
          value: {
            id: "a",
            instanceId: "box",
            name: "onClick",
            type: "action",
            value: [
              { type: "execute", args: [], code: "$ws$dataSource$x = 1" },
            ],
          },
        },
      ]),
    ],
  ])("refuses %s", (_kind, write) => {
    expect(findRefusedEntries(build(), [write]).has(write)).toBe(true);
  });

  test("applies the other entries, in order", () => {
    const first = entry("props", [
      { op: "add", path: ["p"], value: expressionProp("p", `"a"`) },
    ]);
    const refused = entry("props", [
      { op: "replace", path: ["p", "value"], value: "a()" },
    ]);
    // checked against the build with the first entry applied
    const last = entry("props", [
      { op: "replace", path: ["p", "name"], value: "alt" },
    ]);
    expect([
      ...findRefusedEntries(build(), [first, refused, last]).keys(),
    ]).toEqual([refused]);
  });

  test("applies an entry that leaves a saved failing value alone", () => {
    const saved = build([expressionProp("p", "a()")]);
    const rename = entry("props", [
      { op: "replace", path: ["p", "name"], value: "alt" },
    ]);
    const other = entry("props", [
      { op: "add", path: ["q"], value: expressionProp("q", `"b"`) },
    ]);
    expect(findRefusedEntries(saved, [rename, other]).size).toBe(0);
  });

  test("applies an entry that removes a failing value", () => {
    const saved = build([expressionProp("p", "a()")]);
    const remove = entry("props", [{ op: "remove", path: ["p"] }]);
    expect(findRefusedEntries(saved, [remove]).size).toBe(0);
  });
});

describe("the builder's own presets pass", () => {
  test("the catalog Resources and the Signup Form", async () => {
    const { buildOrgResourcePresets } =
      await import("~/shared/db/resource-presets.server");
    const { buildSignupFormData } =
      await import("~/shared/db/signup-form-preset.server");
    const { findCodeCheckFailure } =
      await import("@organizeos/site-components/org-script");
    const options = {
      projectId: "00000000-0000-4000-8000-000000000000",
      apiBaseUrl: "https://app.example.org/api/public/v1",
      readToken: "token",
    };
    const { resources } = await buildOrgResourcePresets(options);
    expect(findCodeCheckFailure({ resources })).toBeUndefined();
    const { data } = await buildSignupFormData(options);
    expect(
      findCodeCheckFailure({
        instances: data.instances.values(),
        props: data.props.values(),
        resources: data.resources.values(),
        dataSources: data.dataSources.values(),
      })
    ).toBeUndefined();
  });
});
