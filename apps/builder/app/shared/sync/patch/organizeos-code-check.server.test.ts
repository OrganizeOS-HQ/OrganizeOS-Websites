import { describe, expect, test } from "vitest";
import { createDefaultPages } from "@webstudio-is/project-build";
import {
  serializeData,
  serializePages,
} from "@webstudio-is/project-build/persistence";
import type { Prop } from "@webstudio-is/sdk";
import {
  findRefusedEntries,
  findRefusedPatchEntries,
} from "./organizeos-code-check.server";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
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

  test("checks every record of a namespace an entry replaces whole", () => {
    const replace = (props: Prop[]) =>
      entry("props", [
        {
          op: "replace",
          path: [],
          value: new Map(props.map((prop) => [prop.id, prop])),
        },
      ]);
    const refused = replace([expressionProp("p", `"a".constructor`)]);
    expect(findRefusedEntries(build(), [refused]).has(refused)).toBe(true);
    const clean = replace([expressionProp("p", `"a"`)]);
    expect(findRefusedEntries(build(), [clean]).size).toBe(0);
    // a saved failing value the replacement keeps is left alone
    const saved = build([expressionProp("p", "a()")]);
    const kept = replace([expressionProp("p", "a()")]);
    expect(findRefusedEntries(saved, [kept]).size).toBe(0);
  });

  test("checks every record of a namespace replaced whole with an array", () => {
    const refused = entry("props", [
      {
        op: "replace",
        path: [],
        value: [expressionProp("p", `"a".constructor`)],
      },
    ]);
    expect(findRefusedEntries(build(), [refused]).has(refused)).toBe(true);
  });

  test("applies an entry that removes a failing value", () => {
    const saved = build([expressionProp("p", "a()")]);
    const remove = entry("props", [{ op: "remove", path: ["p"] }]);
    expect(findRefusedEntries(saved, [remove]).size).toBe(0);
  });
  test("refuses an entry whose patch does not apply, and applies the others", () => {
    const unapplied = entry("props", [
      { op: "replace", path: ["missing", "value"], value: `"a"` },
    ]);
    const next = entry("props", [
      { op: "add", path: ["p"], value: expressionProp("p", `"a"`) },
    ]);
    expect(findRefusedEntries(build(), [unapplied, next])).toEqual(
      new Map([[unapplied, "This change cannot be applied"]])
    );
  });
});

describe("findRefusedPatchEntries", () => {
  const contextWith = (version: number, selected: string[] = []) =>
    ({
      postgrest: {
        client: {
          from: () => ({
            select: (columns: string) => {
              selected.push(columns);
              return {
                eq: () => ({
                  single: async () => ({
                    data: {
                      version,
                      lastTransactionId: "tx-saved",
                      ...build(),
                    },
                    error: null,
                  }),
                }),
              };
            },
          }),
        },
      },
    }) as unknown as AppContext;
  const write = () =>
    entry("props", [
      { op: "add", path: ["p"], value: expressionProp("p", "a()") },
    ]);

  test("checks the build at the version the client writes", async () => {
    const selected: string[] = [];
    const refused = write();
    const result = await findRefusedPatchEntries(
      contextWith(3, selected),
      "build",
      3,
      [refused]
    );
    expect(selected[0]?.split(", ")).toContain("version");
    expect(result).toEqual({
      status: "checked",
      refused: new Map([[refused, "This function is not allowed"]]),
    });
  });

  test("answers a version conflict when the build moved past the client's version", async () => {
    expect(
      await findRefusedPatchEntries(contextWith(4), "build", 3, [write()])
    ).toMatchObject({ status: "version_mismatched" });
  });

  test("answers a version conflict for a client ahead of the build", async () => {
    expect(
      await findRefusedPatchEntries(contextWith(3), "build", 4, [write()])
    ).toMatchObject({ status: "version_mismatched" });
  });

  test("passes the retry of a request already saved, which writes nothing", async () => {
    const retry = write();
    retry.transaction.id = "tx-saved";
    expect(
      await findRefusedPatchEntries(contextWith(4), "build", 3, [retry])
    ).toEqual({ status: "checked", refused: new Map() });
    // a client ahead of the build is not a retry
    expect(
      await findRefusedPatchEntries(contextWith(3), "build", 4, [retry])
    ).toMatchObject({ status: "version_mismatched" });
  });

  test("reads nothing when no entry writes a checked value", async () => {
    const selected: string[] = [];
    const style = entry("styles", [{ op: "add", path: ["s"], value: {} }]);
    expect(
      await findRefusedPatchEntries(contextWith(4, selected), "build", 3, [
        style,
      ])
    ).toEqual({ status: "checked", refused: new Map() });
    expect(selected).toEqual([]);
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
