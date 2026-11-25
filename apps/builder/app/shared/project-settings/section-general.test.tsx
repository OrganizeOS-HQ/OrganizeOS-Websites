import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import { $projectSettings } from "~/shared/sync/data-stores";
import { executeRuntimeMutation } from "~/shared/instance-utils/data";
import { orgEmbedsMayShip } from "@organizeos/site-components/org-script";
import { SectionGeneral } from "./section-general";

// OrganizeOS fork: orgScriptMayRun is a constant false, and the Custom code box
// follows orgEmbedsMayShip() (docs/ORGANIZEOS-FORK.md section 10); the case for
// after the flip turns embeds on here, and one reads the real switch
// (realEmbeds)
const orgScript = vi.hoisted(() => ({
  mayRun: false,
  embeds: false,
  realEmbeds: false,
}));
vi.mock("@organizeos/site-components/org-script", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@organizeos/site-components/org-script")
    >();
  return {
    ...actual,
    orgScriptMayRun: () => orgScript.mayRun,
    orgEmbedsMayShip: () =>
      orgScript.realEmbeds ? actual.orgEmbedsMayShip() : orgScript.embeds,
  };
});

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
  orgScript.embeds = false;
  orgScript.realEmbeds = false;
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
  test("while embeds may not ship there is no Custom code box", () => {
    const host = renderSection("<script>1</script>");
    expect(getLabels(host)).not.toContain("Custom code");
    expect(getEditors(host)).toEqual([]);
    expect(host.textContent).not.toContain("<script>1</script>");
    expect(host.textContent).not.toContain("paused");
  });

  test("once embeds may ship it is the label and an editor, with no paragraph", () => {
    orgScript.embeds = true;
    const host = renderSection("<script>1</script>");
    expect(getLabels(host)).toContain("Custom code");
    const editor = getEditors(host).at(-1);
    expect(editor?.textContent).toBe("<script>1</script>");
    expect(editor?.getAttribute("contenteditable")).toBe("true");
    expect(host.textContent).not.toContain("<head>");
    expect(host.textContent).not.toContain("published site");
  });

  // the switch at its real default (spec 2026-11-20, PR C)
  test("with the embed switch at its default it is the label and an editable editor", () => {
    orgScript.realEmbeds = true;
    expect(orgEmbedsMayShip()).toBe(true);
    const host = renderSection("<script>1</script>");
    expect(getLabels(host)).toContain("Custom code");
    const editor = getEditors(host).at(-1);
    expect(editor?.textContent).toBe("<script>1</script>");
    expect(editor?.getAttribute("contenteditable")).toBe("true");
  });

  test("org script alone shows no box", () => {
    orgScript.mayRun = true;
    const host = renderSection("<script>1</script>");
    expect(getLabels(host)).not.toContain("Custom code");
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
