import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, expect, test } from "vitest";
import { createDefaultPages } from "@webstudio-is/project-build";
import { TooltipProvider } from "@webstudio-is/design-system";
import { $pages } from "~/shared/sync/data-stores";
import { registerContainers } from "~/shared/sync/sync-stores";
import { SectionRedirects, __testing__ } from "./section-redirects";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.replaceChildren();
});

const scriptTarget = "javascript:void 0";

const renderRedirects = async (redirects: { old: string; new: string }[]) => {
  registerContainers();
  const pages = createDefaultPages({ rootInstanceId: "box" });
  pages.redirects = redirects;
  $pages.set(pages);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <TooltipProvider>
        <SectionRedirects />
      </TooltipProvider>
    );
  });
  return container;
};

test("a redirect whose target may not run is listed as text, not a link", async () => {
  const container = await renderRedirects([{ old: "/old", new: scriptTarget }]);
  expect(container.textContent).toContain(scriptTarget);
  const hrefs = [...container.querySelectorAll("a")].map((link) =>
    link.getAttribute("href")
  );
  expect(hrefs.some((href) => href?.startsWith("javascript:"))).toBe(false);
});

test("a stored path that may not run is not a link either", async () => {
  const container = await renderRedirects([{ old: scriptTarget, new: "/x" }]);
  const hrefs = [...container.querySelectorAll("a")].map((link) =>
    link.getAttribute("href")
  );
  expect(hrefs.some((href) => href?.startsWith("javascript:"))).toBe(false);
});

test("a redirect to a page or an https address is still a link", async () => {
  const container = await renderRedirects([
    { old: "/a", new: "/about" },
    { old: "/b", new: "https://example.org/" },
  ]);
  const hrefs = [...container.querySelectorAll("a")].map((link) =>
    link.getAttribute("href")
  );
  expect(hrefs).toContain("https://example.org/");
  expect(hrefs.some((href) => href?.endsWith("/about"))).toBe(true);
});

test("the form refuses a target that may not run while org script is paused", () => {
  expect(__testing__.validateToPath(scriptTarget, "/old")).not.toEqual([]);
  expect(__testing__.validateToPath("https://example.org/", "/old")).toEqual(
    []
  );
});
