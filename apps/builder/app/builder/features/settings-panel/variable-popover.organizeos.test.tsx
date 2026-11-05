import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readLiteralValue } from "@organizeos/site-components/org-script";
import { createDefaultPages } from "@webstudio-is/project-build";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { DataSource } from "@webstudio-is/sdk";
import { $dataSources, $instances, $pages } from "~/shared/sync/data-stores";
import { registerContainers } from "~/shared/sync/sync-stores";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { VariablePopoverTrigger, validateJsonValue } from "./variable-popover";

declare global {
  // eslint-disable-next-line no-var
  var organizeosVariableDialogRan: unknown;
}

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@organizeos/site-components/org-script", { spy: true });

// Radix observes its content, and jsdom 20 has no ResizeObserver
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  // jsdom 20 measures no text, which the expression editor asks for
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  // jsdom 20 cannot read the expression editor's :has() rule
  const getComputedStyle = window.getComputedStyle.bind(window);
  vi.stubGlobal(
    "getComputedStyle",
    (element: Element, pseudo?: string | null) => {
      try {
        return getComputedStyle(element, pseudo);
      } catch {
        return document.createElement("div").style;
      }
    }
  );
  vi.mocked(readLiteralValue).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
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
    value: {
      type: "string[]",
      value: ["globalThis.organizeosVariableDialogRan = true"],
    },
  });
  // the preview read the stored value, as the builder formats it
  expect(readLiteralValue).toHaveBeenCalledWith(
    JSON.stringify(["globalThis.organizeosVariableDialogRan = true"], null, 2)
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
  const read = vi.mocked(readLiteralValue).mock.results.at(-1)?.value;
  expect(read).toEqual({ value: { title: "Hello", tags: ["a", "b"] } });
  expect(document.body.textContent).toContain("Edit Variable");
  expect(document.body.textContent).toContain("Hello");
});

test("a value that does not read as data is invalid while org script is paused", () => {
  expect(validateJsonValue(`1 + 1`)).toBe("error");
  expect(validateJsonValue(`"a" + "b"`)).toBe("error");
  // as the builder formats an object, in parentheses
  expect(validateJsonValue(`({ "a": [1, 2] })`)).toBe("");
  expect(validateJsonValue(`[1, "b"]`)).toBe("");
});
