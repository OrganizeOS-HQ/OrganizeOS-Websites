// OrganizeOS fork: the builder UI's Markdown preview writes into the builder's
// own document only through the sanitized insertion path
// (~/shared/organizeos-untrusted-markup.tsx; docs/ORGANIZEOS-FORK.md
// section 10).
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, expect, test, vi } from "vitest";
import type { Asset } from "@webstudio-is/sdk";
import type { AssetContainer } from "~/builder/shared/assets";
import { MarkdownSplitView } from "./markdown-preview";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  delete (window as { __pwned?: unknown }).__pwned;
});

const image: Asset = {
  id: "image-id",
  projectId: "project-id",
  type: "image",
  name: "image.png",
  format: "png",
  size: 1,
  meta: { width: 1, height: 1 },
  createdAt: "2026-01-01T00:00:00.000Z",
};

const markdown: Asset = {
  id: "markdown-id",
  projectId: "project-id",
  type: "file",
  name: "post.md",
  format: "md",
  size: 1,
  meta: {},
  createdAt: "2026-01-01T00:00:00.000Z",
};

const render = (source: string, assetContainers: AssetContainer[] = []) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root?.render(
      <MarkdownSplitView
        open
        source={source}
        sourceAsset={markdown}
        folders={new Map()}
        assetContainers={assetContainers}
      >
        <div />
      </MarkdownSplitView>
    )
  );
};

/** The preview region that is shown, once the render settled. */
const preview = async (find: (region: Element) => boolean) => {
  let found: Element | undefined;
  await vi.waitFor(() => {
    found = Array.from(
      document.querySelectorAll('[aria-label="Markdown preview"]')
    ).find(
      (region) => (region as HTMLElement).hidden === false && find(region)
    );
    expect(found).toBeDefined();
  });
  return found as Element;
};

test("a handler and a javascript: link do not reach the builder's document", async () => {
  render(
    '<img src=x onerror="window.__pwned=1">\n\n[x](javascript:window.__pwned=1)'
  );
  const region = await preview((region) => region.querySelector("a") !== null);
  const img = region.querySelector("img");
  expect(img).not.toBeNull();
  expect(img?.hasAttribute("onerror")).toBe(false);
  expect(region.querySelector("a")?.hasAttribute("href")).toBe(false);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect((window as { __pwned?: unknown }).__pwned).toBeUndefined();
});

test("an image that is still uploading keeps its object URL", async () => {
  const objectURL = "blob:https://builder.example/upload";
  render("![Uploading](image-id)", [
    { status: "uploading", asset: image, objectURL } as AssetContainer,
  ]);
  const region = await preview(
    (region) => region.querySelector("img") !== null
  );
  expect(region.querySelector("img")?.getAttribute("src")).toBe(objectURL);
});

test("an iframe in the source renders no iframe", async () => {
  render('# Title\n\n<iframe src="https://x.example/"></iframe>');
  const region = await preview((region) => region.querySelector("h1") !== null);
  expect(region.querySelector("iframe")).toBeNull();
  expect(document.querySelector("iframe")).toBeNull();
});

// The preview is in the builder's own document: no style of the org's may
// restyle the builder, whatever upstream's Markdown filter lets through
test("a style element and a style attribute in the source do not survive", async () => {
  render(
    '# Styled\n\n<style>body { display: none }</style>\n\n<p style="color: red">x</p>\n\n<div style="position: fixed">y</div>'
  );
  const region = await preview((region) => region.querySelector("h1") !== null);
  expect(region.querySelector("style")).toBeNull();
  expect(region.querySelector("[style]")).toBeNull();
  expect(getComputedStyle(document.body).display).not.toBe("none");
});
