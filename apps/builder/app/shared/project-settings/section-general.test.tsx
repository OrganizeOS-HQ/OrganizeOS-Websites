import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import { $projectSettings } from "~/shared/sync/data-stores";
import { executeRuntimeMutation } from "~/shared/instance-utils/data";
import { SectionGeneral } from "./section-general";

// OrganizeOS fork: orgScriptMayRun is a constant false while org script is
// paused (docs/ORGANIZEOS-FORK.md section 10); the case for after the unpause
// flips it here
const orgScript = vi.hoisted(() => ({ mayRun: false }));
vi.mock("@organizeos/site-components/org-script", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@organizeos/site-components/org-script")
  >()),
  orgScriptMayRun: () => orgScript.mayRun,
}));

vi.mock("~/shared/instance-utils/data", { spy: true });

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;
let previousSettings: ReturnType<typeof $projectSettings.get>;

// 0.309.0 keeps the project's meta in its settings, not in the pages
const renderSection = (code: string | undefined) => {
  $projectSettings.set({ meta: { siteName: "Site", code }, compiler: {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(TooltipProvider, null, createElement(SectionGeneral))
    );
  });
  return container;
};

const getEditors = (host: HTMLElement) =>
  Array.from(host.querySelectorAll<HTMLElement>(".cm-content"));

const getLabels = (host: HTMLElement) =>
  Array.from(host.querySelectorAll("label")).map((label) => label.textContent);

beforeEach(() => {
  orgScript.mayRun = false;
  vi.mocked(executeRuntimeMutation)
    .mockReset()
    .mockImplementation(() => undefined);
  previousSettings = $projectSettings.get();
  $projectSettings.set(undefined);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  $projectSettings.set(previousSettings);
});

describe("SectionGeneral, Custom code", () => {
  test("while org script is paused there is no Custom code box", () => {
    const host = renderSection("<script>1</script>");
    expect(getLabels(host)).not.toContain("Custom code");
    expect(getEditors(host)).toEqual([]);
    expect(host.textContent).not.toContain("<script>1</script>");
    expect(host.textContent).not.toContain("paused");
  });

  test("once org script may run it is the label and an editor, with no paragraph", () => {
    orgScript.mayRun = true;
    const host = renderSection("<script>1</script>");
    expect(getLabels(host)).toContain("Custom code");
    const editor = getEditors(host).at(-1);
    expect(editor?.textContent).toBe("<script>1</script>");
    expect(editor?.getAttribute("contenteditable")).toBe("true");
    expect(host.textContent).not.toContain("<head>");
    expect(host.textContent).not.toContain("published site");
  });
});

describe("SectionGeneral", () => {
  test("the favicon has no caption", () => {
    const host = renderSection(undefined);
    expect(getLabels(host)).toContain("Favicon");
    expect(host.textContent).not.toContain("Upload a square image");
  });

  test("editing the site name sends siteName only, never the saved code", () => {
    const host = renderSection("<script>1</script>");
    const input = host.querySelector<HTMLInputElement>(
      'input[placeholder="Current site name"]'
    );
    expect(input).not.toBeNull();
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setValue?.call(input, "New name");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(executeRuntimeMutation).toHaveBeenCalledTimes(1);
    expect(executeRuntimeMutation).toHaveBeenCalledWith({
      id: "projectSettings.update",
      input: { meta: { siteName: "New name" } },
    });
  });
});
