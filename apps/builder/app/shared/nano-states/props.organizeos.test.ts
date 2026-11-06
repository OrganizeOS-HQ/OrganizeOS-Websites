import { afterEach, expect, test, vi } from "vitest";
import { cleanStores } from "nanostores";
import { createDefaultPages } from "@webstudio-is/project-build";
import { setEnv } from "@webstudio-is/feature-flags";
import type { Prop } from "@webstudio-is/sdk";
import { $instances, $pages, $dataSources, $props } from "../sync/data-stores";
import { $propValuesByInstanceSelector } from "./props";
import { $selectedPageId } from "./pages";
import { getInstanceKey } from "../nano-states";
import { registerContainers } from "../sync/sync-stores";

// OrganizeOS fork: input validation for actions (code-check.ts in
// @organizeos/site-components) before the canvas compiles one.

registerContainers();
setEnv("*");

afterEach(() => {
  cleanStores($propValuesByInstanceSelector);
  vi.restoreAllMocks();
});

const actionOn = async (code: string, args: string[] = []) => {
  $instances.set(
    new Map([
      ["box", { id: "box", type: "instance", component: "Box", children: [] }],
    ])
  );
  const pages = createDefaultPages({
    homePageId: "pageId",
    rootInstanceId: "box",
  });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  $dataSources.set(
    new Map([
      [
        "var",
        {
          id: "var",
          scopeInstanceId: "box",
          type: "variable",
          name: "",
          value: { type: "number", value: 1 },
        },
      ],
    ])
  );
  const action: Prop = {
    id: "actionId",
    name: "onChange",
    instanceId: "box",
    type: "action",
    value: [{ type: "execute", args, code }],
  };
  // since 0.309.0 prop values are computed asynchronously
  $propValuesByInstanceSelector.set(new Map());
  $props.set(new Map([[action.id, action]]));
  return await vi.waitFor(() => {
    const value = $propValuesByInstanceSelector
      .get()
      .get(getInstanceKey(["box"]))
      ?.get("onChange");
    if (typeof value !== "function") {
      throw new Error("prop values are not computed yet");
    }
    return value as () => unknown;
  });
};

test.each([
  ["a name that is not an argument or a variable", "a = 1", []],
  ["a variable that is not in the build", "$ws$dataSource$other = 1", []],
  [
    "an argument name that is not a plain name",
    "$ws$dataSource$var = 1",
    ["a)"],
  ],
  ["a second statement", "$ws$dataSource$var = 1; $ws$dataSource$var = 2", []],
])(
  "an action with %s does nothing and is never compiled",
  async (_kind, code, args) => {
    const compile = vi.spyOn(globalThis, "Function");
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const action = await actionOn(code, args);
    expect(typeof action).toBe("function");
    expect(action()).toBeUndefined();
    expect(compile).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).not.toContain(code);
  }
);

test("an action that passes is compiled as before", async () => {
  const compile = vi.spyOn(globalThis, "Function");
  (await actionOn("$ws$dataSource$var = $ws$dataSource$var + 1"))();
  expect(compile).toHaveBeenCalled();
});
