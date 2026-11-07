import { beforeEach, describe, expect, test, vi } from "vitest";
import { ROOT_INSTANCE_ID, type Instances } from "@webstudio-is/sdk";
import {
  isRepeatedContentBlockOccurrence,
  parseContentBlockRenderScope,
  resolveContentBlockOccurrenceAssetId,
} from "./content-block-source-utils";

// OrganizeOS fork: upstream's cases that compute a bare name, keyed by name,
// run with org script allowed, as upstream runs them; while org script is
// paused an expression names only data sources (expressionMayRun, section 10
// of docs/ORGANIZEOS-FORK.md). The rest run paused, as the builder runs them.
const orgScript = vi.hoisted(() => ({ mayRun: false }));
vi.mock("@organizeos/site-components/org-script", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@organizeos/site-components/org-script")
  >()),
  orgScriptMayRun: () => orgScript.mayRun,
}));
const testsWithOrgScriptAllowed = new Set([
  "Content Block occurrence source > resolves a root-qualified variable scope",
  "Content Block occurrence source > resolves each bound Collection occurrence independently",
]);
beforeEach(() => {
  orgScript.mayRun = testsWithOrgScriptAllowed.has(
    expect.getState().currentTestName ?? ""
  );
});

const selector = ["block", "collection[item]", "collection", "body"];

describe("Content Block occurrence source", () => {
  test("parses only instance selectors", () => {
    expect(parseContentBlockRenderScope(JSON.stringify(selector))).toEqual(
      selector
    );
    expect(parseContentBlockRenderScope("{}")).toBeUndefined();
    expect(parseContentBlockRenderScope('["block",1]')).toBeUndefined();
  });

  test("resolves a root-qualified variable scope", async () => {
    const values = new Map([["asset", "article"]]);
    const rootQualified = new Map([
      [JSON.stringify([...selector, ROOT_INSTANCE_ID]), values],
    ]);
    await expect(
      resolveContentBlockOccurrenceAssetId({
        source: { type: "expression", value: "asset" },
        instanceSelector: selector,
        variableValuesByRenderScope: rootQualified,
      })
    ).resolves.toBe("article");
  });

  test("resolves each bound Collection occurrence independently", async () => {
    const first = ["block", "collection[first]", "collection", "body"];
    const second = ["block", "collection[second]", "collection", "body"];
    const values = new Map([
      [JSON.stringify(first), new Map([["asset", "a.mdx"]])],
      [JSON.stringify(second), new Map([["asset", "b.mdx"]])],
    ]);

    await expect(
      Promise.all(
        [first, second].map((instanceSelector) =>
          resolveContentBlockOccurrenceAssetId({
            source: { type: "expression", value: "asset" },
            instanceSelector,
            variableValuesByRenderScope: values,
          })
        )
      )
    ).resolves.toEqual(["a.mdx", "b.mdx"]);
  });

  test("detects repeated selectors consistently", () => {
    const instances = new Map(
      ["block", "collection", "body"].map((id) => [
        id,
        {
          type: "instance" as const,
          id,
          component: "Box",
          children: [],
        },
      ])
    ) as Instances;
    expect(
      isRepeatedContentBlockOccurrence({
        instanceSelector: selector,
        instances,
      })
    ).toBe(true);
    expect(
      isRepeatedContentBlockOccurrence({
        instanceSelector: ["block", "collection", "body"],
        instances,
      })
    ).toBe(false);
  });
});
