import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import { createDefaultPages } from "@webstudio-is/project-build";
import { $pages } from "~/shared/sync/data-stores";
import { SectionGeneral } from "./section-general";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

const renderSection = (code: string | undefined) => {
  const pages = createDefaultPages({ rootInstanceId: "root" });
  pages.meta = { siteName: "Site", code };
  $pages.set(pages);
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

// The editors in the section, in order; Custom code is the last
const getEditors = (host: HTMLElement) =>
  Array.from(host.querySelectorAll<HTMLElement>(".cm-content"));

beforeEach(() => {
  $pages.set(undefined);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("SectionGeneral, Custom code", () => {
  // T9
  test("shows the saved code in an editor that cannot be edited", () => {
    const host = renderSection("<script>1</script>");
    const editor = getEditors(host).at(-1);
    expect(editor?.textContent).toBe("<script>1</script>");
    expect(editor?.getAttribute("contenteditable")).toBe("false");
  });

  test("says custom code is paused, and that it is kept", () => {
    const host = renderSection("<script>1</script>");
    expect(host.textContent).toContain(
      "Custom code is paused for now: it isn't added to any page of your published site. Scripts on your site could read the OrganizeOS sign-in of people who visit, so it stays off while we make it safe. The code saved here is kept and starts running again when it is."
    );
  });

  test("no longer says the code is added to the head and runs on the published site", () => {
    const host = renderSection("<script>1</script>");
    expect(host.textContent).not.toContain("end of the <head>");
    expect(host.textContent).not.toContain("will be added at the end");
    expect(host.textContent).not.toContain("will run only on the published");
  });

  test("is read-only when there is no code too", () => {
    const host = renderSection(undefined);
    const editor = getEditors(host).at(-1);
    expect(editor?.getAttribute("contenteditable")).toBe("false");
  });
});
