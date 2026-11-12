import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import { afterEach, expect, test, vi } from "vitest";
import { createDefaultPages } from "@webstudio-is/project-build";
import { TooltipProvider, toast } from "@webstudio-is/design-system";
import type { DataSource, Resource } from "@webstudio-is/sdk";
import {
  $dataSources,
  $instances,
  $pages,
  $props,
  $resources,
} from "~/shared/sync/data-stores";
import { registerContainers } from "~/shared/sync/sync-stores";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { selectInstance } from "~/shared/nano-states";
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
  vi.restoreAllMocks();
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

// OrganizeOS fork (fork doc section 9): the org's data catalog is locked in
// the builder. Closing an unchanged editor saves nothing to the catalog; a
// change is refused, says why and keeps the editor open.
const eventsResource: Resource = {
  id: "385fcd4c-92f8-5d7c-abfe-cb941b8f2449",
  name: "Events",
  method: "get",
  url: `"https://app.example.org/api/public/v1/events"`,
  headers: [{ name: "Authorization", value: `"Bearer osk_token"` }],
};
const eventsRootBinding: DataSource = {
  type: "resource",
  id: "6f1c2a3b-4d5e-5f60-8a1b-2c3d4e5f6a7b",
  scopeInstanceId: ":root",
  name: "Events",
  resourceId: eventsResource.id,
};

const openCatalogVariable = async () => {
  registerContainers();
  $instances.set(
    new Map([
      [
        "body",
        { id: "body", type: "instance", component: "Body", children: [] },
      ],
    ])
  );
  $pages.set(createDefaultPages({ rootInstanceId: "body" }));
  $props.set(new Map());
  $selectedPageId.set("home");
  selectInstance(["body"]);
  $resources.set(new Map([[eventsResource.id, eventsResource]]));
  $dataSources.set(new Map([[eventsRootBinding.id, eventsRootBinding]]));
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <TooltipProvider>
        <VariablePopoverTrigger variable={eventsRootBinding}>
          <button type="button" id="open-events">
            Events
          </button>
        </VariablePopoverTrigger>
      </TooltipProvider>
    );
  });
  await act(async () =>
    userEvent.click(document.getElementById("open-events")!)
  );
  const dialog = await vi.waitFor(() => {
    const current = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(current).not.toBeNull();
    return current!;
  });
  const close = async () => {
    await act(async () => {
      await userEvent.click(
        dialog.querySelector<HTMLButtonElement>('[aria-label="Close"]')!
      );
      await new Promise(requestAnimationFrame);
    });
  };
  return { dialog, close, unmount: () => act(() => root.unmount()) };
};

test("closing a catalog variable's editor unchanged closes it and writes no catalog Resource", async () => {
  const error = vi.spyOn(toast, "error");
  const { close, unmount } = await openCatalogVariable();
  const resources = $resources.get();
  await close();
  await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
  expect($resources.get()).toBe(resources);
  expect($dataSources.get().get(eventsRootBinding.id)).toEqual(
    eventsRootBinding
  );
  expect(error).not.toHaveBeenCalled();
  unmount();
});

test("changing a catalog variable's URL is refused: the message shows, the editor stays open, the store is unchanged", async () => {
  const error = vi.spyOn(toast, "error");
  const { dialog, close, unmount } = await openCatalogVariable();
  const resources = $resources.get();
  const url = dialog.querySelector<HTMLInputElement>('input[name="url"]')!;
  await act(async () =>
    userEvent.fill(
      dialog.querySelector<HTMLTextAreaElement>(
        'textarea[name="url-validator"]'
      )!,
      "https://app.example.org/api/public/v1/eventsx"
    )
  );
  await vi.waitFor(() => expect(url.value).toContain("eventsx"));
  await close();

  expect(error).toHaveBeenCalledWith(
    "Cannot change your organization's data catalog."
  );
  expect(document.querySelector('[role="dialog"]')).toBe(dialog);
  expect($resources.get()).toBe(resources);
  expect($dataSources.get().get(eventsRootBinding.id)).toEqual(
    eventsRootBinding
  );
  unmount();
});
