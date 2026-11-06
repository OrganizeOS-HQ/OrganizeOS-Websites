import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, expect, test } from "vitest";
import { createDefaultPages } from "@webstudio-is/project-build";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { DataSource } from "@webstudio-is/sdk";
import { $dataSources, $instances, $pages } from "~/shared/sync/data-stores";
import { registerContainers } from "~/shared/sync/sync-stores";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { VariablePopoverTrigger } from "./variable-popover";
import { validateJsonValue } from "./variable-editors/json-editor";

declare global {
  // eslint-disable-next-line no-var
  var organizeosVariableDialogRan: unknown;
}

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.replaceChildren();
  globalThis.organizeosVariableDialogRan = undefined;
});

const openVariable = async (variable: DataSource) => {
  registerContainers();
  $instances.set(
    new Map([
      ["box", { id: "box", type: "instance", component: "Box", children: [] }],
    ])
  );
  $pages.set(createDefaultPages({ rootInstanceId: "box" }));
  $selectedPageId.set("home");
  $dataSources.set(new Map([[variable.id, variable]]));
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <TooltipProvider>
        <VariablePopoverTrigger variable={variable}>
          <button id="open">{variable.name}</button>
        </VariablePopoverTrigger>
      </TooltipProvider>
    );
  });
  await act(async () => {
    document.getElementById("open")!.click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
};

test("the variable dialog reads a stored value as data while org script is paused", async () => {
  await openVariable({
    type: "variable",
    id: "list",
    scopeInstanceId: "box",
    name: "list",
    // since 0.309.0 a string list is a JSON value
    value: {
      type: "json",
      value: ["globalThis.organizeosVariableDialogRan = true"],
    },
  });
  // the preview shows the stored text as data, and nothing in it ran
  expect(document.body.textContent).toContain(
    "globalThis.organizeosVariableDialogRan = true"
  );
  expect(globalThis.organizeosVariableDialogRan).toBeUndefined();
});

test("the variable dialog still shows a JSON value", async () => {
  await openVariable({
    type: "variable",
    id: "data",
    scopeInstanceId: "box",
    name: "data",
    value: { type: "json", value: { title: "Hello", tags: ["a", "b"] } },
  });
  expect(document.body.textContent).toContain("Hello");
});

test("a value that does not read as data is invalid while org script is paused", () => {
  expect(validateJsonValue(`1 + 1`)).toBe("error");
  expect(validateJsonValue(`"a" + "b"`)).toBe("error");
  // as the builder formats an object, in parentheses
  expect(validateJsonValue(`({ "a": [1, 2] })`)).toBe("");
  expect(validateJsonValue(`[1, "b"]`)).toBe("");
});

test("a value that fails input validation is invalid, whatever the switch", () => {
  expect(validateJsonValue(`"a".constructor`, true)).toBe("error");
  expect(validateJsonValue(`{ "__proto__": 1 }`, true)).toBe("error");
  expect(validateJsonValue(`[1, "b"]`, true)).toBe("");
});
