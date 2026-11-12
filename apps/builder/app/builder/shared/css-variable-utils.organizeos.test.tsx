// OrganizeOS fork: the Cmd+K guard and routing (docs/ORGANIZEOS-FORK.md section 7)
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { toast, TooltipProvider } from "@webstudio-is/design-system";
import { toValue, type CssProperty } from "@webstudio-is/css-engine";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import { $projectSettings } from "~/shared/sync/data-stores";
import { executeStagedRuntimeMutation } from "~/shared/instance-utils/data";
import {
  registerTestMetas,
  root,
} from "~/builder/features/organizeos-panel/test-fixtures";
import {
  allDecls,
  boxStyle,
  css,
  project,
  registry,
  site,
  size,
  undoDepth,
  v,
  type Fixture,
} from "~/builder/features/variables/test-stores";
import {
  closeCommandPanel,
  openCommandPanel,
} from "~/builder/features/command-panel/command-state";
import { $cssVariableOptions } from "~/builder/features/command-panel/groups/css-variables-group";
import {
  $deletableUnusedCssVariables,
  $unusedCssVariables,
  DeleteCssVariableDialog,
  deleteCssVariable,
  deleteUnusedCssVariables,
  DeleteUnusedCssVariablesDialog,
  openDeleteUnusedCssVariablesDialog,
  RenameCssVariableDialog,
  renameCssVariable,
} from "./css-variable-utils";

const { toastError, toastInfo } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError, info: toastInfo } },
}));
// Spied, not replaced: a factory that imports the original module waits on
// itself in the browser runner (the module is in an import cycle).
vi.mock("~/shared/instance-utils/data", { spy: true });

enableMapSet();
registerContainers();
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | undefined;
let reactRoot: Root | undefined;

beforeEach(() => {
  registerTestMetas();
  vi.mocked(executeStagedRuntimeMutation).mockClear();
  toastError.mockClear();
  toastInfo.mockClear();
});

afterEach(() => {
  act(() => {
    reactRoot?.unmount();
  });
  reactRoot = undefined;
  container?.remove();
  container = undefined;
  vi.restoreAllMocks();
});

const render = (element: ReactElement) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  reactRoot = createRoot(container);
  act(() => {
    reactRoot?.render(createElement(TooltipProvider, null, element));
  });
};

const clickButton = async (label: string) => {
  const button = Array.from(document.querySelectorAll("button")).find(
    (item) => item.textContent === label
  );
  expect(button, label).toBeDefined();
  await act(async () => {
    button?.click();
  });
};

const failNextCommit = async () => {
  const { executeStagedRuntimeMutation: realExecute } = await vi.importActual<
    typeof import("~/shared/instance-utils/data")
  >("~/shared/instance-utils/data");
  vi.mocked(executeStagedRuntimeMutation).mockImplementationOnce((stage) =>
    realExecute((accumulator) => {
      stage(accumulator);
      throw new Error("Commit refused");
    })
  );
};

const six = css({
  "--base": "#ffffff",
  "--accent-1": "#2563eb",
  "--accent-2": "#2563eb",
  "--text": "#111111",
  "--font-heading": "system-ui",
  "--font-body": "system-ui",
});

const brandBlue: Fixture = {
  styles: [
    ...css({ "--x": "1px", "--brand-blue": "#1597b0" }),
    { on: "box", property: "color", value: v("brand-blue") },
    { on: "box", property: "--brand-blue" as CssProperty, value: "#000000" },
  ],
  code: "<style>a{color:var(--brand-blue)}</style>",
  organizeos: {
    variables: site(size("x", "c1"), {
      cssName: "brand-blue",
      collectionId: "c1",
      type: "color",
      name: "Brand Blue",
    }),
  },
};

const unreadable: Fixture = {
  styles: css({ "--gap": "8px" }),
  organizeos: { variables: { version: 2 } },
};

test("a protected name: rename returns invalid and the dialog shows it, with no success", async () => {
  project({
    styles: [
      ...six,
      { on: "box", property: "--accent-text" as CssProperty, value: "#000" },
      { on: root, property: "--focus-ring" as CssProperty, value: "#000" },
    ],
  });
  expect(renameCssVariable("--base", "--brand")).toEqual({
    type: "invalid",
    message: "Can't rename this variable",
  });
  // element-only
  expect(renameCssVariable("--accent-text", "--ink")).toEqual({
    type: "invalid",
    message: "Can't rename this variable",
  });
  const onConfirm = vi.fn();
  render(
    <RenameCssVariableDialog
      cssVariable={{ property: "--focus-ring" }}
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />
  );
  await clickButton("Rename");
  expect(document.body.textContent).toContain("Can't rename this variable");
  expect(onConfirm).not.toHaveBeenCalled();
});

test("a protected name: the delete dialog refuses and stays open", async () => {
  project({ styles: six });
  const onConfirm = vi.fn();
  render(
    <DeleteCssVariableDialog
      cssVariable={{ property: "--text" }}
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />
  );
  await clickButton("Delete");
  expect(document.body.textContent).toContain("Can't delete this variable");
  expect(document.body.textContent).toContain("Delete confirmation");
  expect(onConfirm).not.toHaveBeenCalled();
});

test("Delete unused leaves out protected names and names in project custom code", () => {
  project({
    styles: [
      ...six,
      ...css({ "--free": "1px", "--in-code": "1px" }),
      { on: "box", property: "--focus-ring" as CssProperty, value: "#000" },
    ],
    code: "<style>a{gap:var(--in-code)}</style>",
  });
  expect($deletableUnusedCssVariables.get()).toEqual(new Set(["--free"]));
});

test("the Cmd+K list still labels an unreferenced Brand or band variable unused", () => {
  project({
    styles: [
      ...six,
      { on: "box", property: "--focus-ring" as CssProperty, value: "#000" },
    ],
  });
  expect($unusedCssVariables.get()).toContain("--base");
  openCommandPanel();
  const usagesOf = (property: string) =>
    $cssVariableOptions.get().find((option) => option.property === property)
      ?.usages;
  expect(usagesOf("--base")).toBe(0);
  expect(usagesOf("--focus-ring")).toBe(0);
  closeCommandPanel();
});

test.each(["--accent-text", "--base"])(
  "a rename of a name declared only on elements to the protected %s is refused, staging nothing",
  (name) => {
    project({
      styles: [
        { on: "box", property: "--local" as CssProperty, value: "1px" },
        { on: "box", property: "color", value: v("local") },
      ],
    });
    expect(renameCssVariable("--local", name)).toEqual({
      type: "invalid",
      message: "This name is reserved",
    });
    expect(undoDepth()).toBe(0);
    expect(boxStyle("color")).toEqual({ type: "var", value: "local" });
  }
);

test("a rename of a registered root variable keeps its entry and rewrites everything", () => {
  project(brandBlue);
  expect(renameCssVariable("--brand-blue", "--primary")).toBeUndefined();
  expect(registry().variables[1]).toEqual({
    cssName: "primary",
    collectionId: "c1",
    type: "color",
    name: "primary",
  });
  expect(boxStyle("color")).toEqual({ type: "var", value: "primary" });
  expect(boxStyle("--primary")).toBeDefined();
  expect($projectSettings.get()?.meta.code).toContain("var(--primary)");
});

test.each(["--a-", "---a", "--a---b", "--Big", "--a b", "--text"])(
  "a rename to %s is refused as invalid, staging nothing",
  (name) => {
    project(brandBlue);
    expect(renameCssVariable("--brand-blue", name)?.type).toBe("invalid");
    expect(undoDepth()).toBe(0);
  }
);

test("the Cmd+K delete dialog calls onConfirm (which toasts success) only when the routed delete landed", async () => {
  project(brandBlue);
  const onConfirm = vi.fn();
  render(
    <DeleteCssVariableDialog
      cssVariable={{ property: "--brand-blue" }}
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />
  );
  await failNextCommit();
  await clickButton("Delete");
  expect(onConfirm).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Can't delete this variable");
  await clickButton("Delete");
  expect(onConfirm).toHaveBeenCalledOnce();
  // what the group's onConfirm does next
  deleteCssVariable("--brand-blue");
  // the routed delete; the follow-up upstream delete of a missing name adds no step
  expect(undoDepth()).toBe(1);
});

test("a routed rename whose commit throws returns invalid, so its dialog toasts no success", async () => {
  project(brandBlue);
  await failNextCommit();
  // RenameCssVariableDialog calls onConfirm, which toasts success, only on undefined
  expect(renameCssVariable("--brand-blue", "--primary")).toEqual({
    type: "invalid",
    message: "Can't change this variable",
  });
  expect(undoDepth()).toBe(0);
  await vi.waitFor(() =>
    expect(toastError).toHaveBeenCalledWith("Commit refused")
  );
});

test("a delete of a used root variable leaves no var() and drops its entry", () => {
  project(brandBlue);
  deleteCssVariable("--brand-blue");
  expect(
    allDecls().some((decl) => toValue(decl.value).includes("--brand-blue"))
  ).toBe(false);
  expect(
    registry().variables.some((entry) => entry.cssName === "brand-blue")
  ).toBe(false);
});

test("Delete unused: listed and element-only names in one transaction, returning the total", () => {
  project({
    styles: [
      ...css({ "--a": "1px", "--b": "1px" }),
      { on: "box", property: "--c" as CssProperty, value: "1px" },
    ],
    organizeos: { variables: site(size("a"), size("b")) },
  });
  expect(deleteUnusedCssVariables()).toBe(3);
  expect(undoDepth()).toBe(1);
  expect(registry().variables.map((entry) => entry.cssName)).toEqual([]);
  serverSyncStore.undo();
  expect(allDecls()).toHaveLength(3);
});

test("an unreadable registry: rename and the delete dialog refuse", async () => {
  project(unreadable);
  expect(renameCssVariable("--gap", "--space")).toEqual({
    type: "invalid",
    message: "Reload to rename this variable",
  });
  render(
    <DeleteCssVariableDialog
      cssVariable={{ property: "--gap" }}
      onClose={vi.fn()}
      onConfirm={vi.fn()}
    />
  );
  await clickButton("Delete");
  expect(document.body.textContent).toContain("Reload to delete variables");
});

test("an unreadable registry: Delete unused refuses in its dialog, with no success toast", async () => {
  project(unreadable);
  const toastSuccess = vi.spyOn(toast, "success");
  openDeleteUnusedCssVariablesDialog();
  render(<DeleteUnusedCssVariablesDialog />);
  await clickButton("Delete");
  expect(document.body.textContent).toContain("Reload to delete variables");
  expect(toastSuccess).not.toHaveBeenCalled();
});

test("an absent registry: routed rename and delete write no registry; the rename still rewrites custom code", () => {
  project({
    styles: [
      ...css({ "--gap": "8px" }),
      { on: "box", property: "margin-top", value: v("gap") },
    ],
    code: "<style>a{gap:var(--gap)}</style>",
  });
  renameCssVariable("--gap", "--space");
  expect($projectSettings.get()?.meta.code).toBe(
    "<style>a{gap:var(--space)}</style>"
  );
  expect($projectSettings.get()?.organizeos).toBeUndefined();
  deleteCssVariable("--space");
  expect(boxStyle("marginTop")).toEqual({ type: "unit", value: 8, unit: "px" });
  expect($projectSettings.get()?.organizeos).toBeUndefined();
});

test("a name declared only on elements keeps upstream's behaviour", () => {
  project({
    styles: [
      { on: "box", property: "--local" as CssProperty, value: "1px" },
      { on: "box", property: "color", value: v("local") },
    ],
  });
  expect(renameCssVariable("--local", "--other")).toBeUndefined();
  expect(boxStyle("color")).toEqual({ type: "var", value: "other" });
  expect(executeStagedRuntimeMutation).not.toHaveBeenCalled();
});
