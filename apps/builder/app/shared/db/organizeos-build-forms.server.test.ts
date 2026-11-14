import { describe, expect, test } from "vitest";
import {
  loadBuildForms,
  type BuildFormsClient,
} from "./organizeos-build-forms.server";

// OrganizeOS fork: the one read of a build's instances, props and pages that
// the publish step and the publisher share (plan
// 2026-11-13-builder-forms-fork-p2, Task 2).

const BUILD = "build-1";

const pagesJson = JSON.stringify({
  meta: {},
  homePage: {
    id: "home",
    name: "Home",
    path: "",
    title: '"Home"',
    rootInstanceId: "body",
    meta: {},
  },
  pages: [],
  folders: [{ id: "root", name: "Root", slug: "", children: ["home"] }],
});

const row = {
  instances: JSON.stringify([
    {
      type: "instance",
      id: "body",
      component: "Body",
      children: [{ type: "id", value: "root" }],
    },
    { type: "instance", id: "root", component: "Box", children: [] },
  ]),
  props: JSON.stringify([
    {
      id: "p1",
      instanceId: "root",
      name: "siteForm",
      type: "string",
      value: "x",
    },
  ]),
  pages: pagesJson,
};

const client = (
  answer: { data: unknown; error: unknown },
  asked: Array<[string, string, string, string]> = []
): BuildFormsClient => ({
  from: (table) => ({
    select: (columns) => ({
      eq: (column, value) => {
        asked.push([table, columns, column, value]);
        return { single: async () => answer };
      },
    }),
  }),
});

describe("loadBuildForms", () => {
  test("reads the build's instances, props and pages by id, as maps", async () => {
    const asked: Array<[string, string, string, string]> = [];
    const result = await loadBuildForms(
      client({ data: row, error: null }, asked),
      BUILD
    );
    expect(asked).toEqual([["Build", "instances, props, pages", "id", BUILD]]);
    expect([...(result?.instances.keys() ?? [])]).toEqual(["body", "root"]);
    expect(result?.props.get("p1")?.value).toBe("x");
    expect(
      result?.pages.pages.get(result.pages.homePageId)?.rootInstanceId
    ).toBe("body");
  });

  test("a read error or a missing row is undefined", async () => {
    expect(
      await loadBuildForms(client({ data: null, error: { code: "x" } }), BUILD)
    ).toBeUndefined();
    expect(
      await loadBuildForms(client({ data: null, error: null }), BUILD)
    ).toBeUndefined();
  });

  test("malformed JSON is undefined, never a throw", async () => {
    expect(
      await loadBuildForms(
        client({ data: { ...row, instances: "{" }, error: null }),
        BUILD
      )
    ).toBeUndefined();
  });
});
