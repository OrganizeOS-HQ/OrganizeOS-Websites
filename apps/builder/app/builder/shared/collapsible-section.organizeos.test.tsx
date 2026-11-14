import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, expect, test } from "vitest";
import { CollapsibleProvider, CollapsibleSection } from "./collapsible-section";

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

const renderElement = (element: React.ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  host = container;
  root = createRoot(container);
  act(() => root?.render(element));
};

const content = (text: string) =>
  Array.from(document.querySelectorAll("div")).find(
    (element) => element.textContent === text && element.children.length === 0
  );

const toggle = (label: string) => {
  const trigger = Array.from(
    document.querySelectorAll<HTMLElement>("[aria-expanded]")
  ).find((element) => element.parentElement?.textContent?.includes(label));
  act(() => trigger?.click());
};

test("a section with defaultOpen false starts closed and opens on click", () => {
  renderElement(
    <CollapsibleSection label="Closed first" defaultOpen={false}>
      <div>closed body</div>
    </CollapsibleSection>
  );
  expect(content("closed body")).toBeUndefined();
  toggle("Closed first");
  expect(content("closed body")).toBeDefined();
});

test("a section without defaultOpen still starts open", () => {
  renderElement(
    <CollapsibleSection label="Open first">
      <div>open body</div>
    </CollapsibleSection>
  );
  expect(content("open body")).toBeDefined();
});

test("inside a provider that opens every section, a defaultOpen false section stays closed", () => {
  renderElement(
    <CollapsibleProvider initialOpen="*">
      <CollapsibleSection label="Layout first">
        <div>layout body</div>
      </CollapsibleSection>
      <CollapsibleSection label="Advanced first" defaultOpen={false}>
        <div>advanced body</div>
      </CollapsibleSection>
    </CollapsibleProvider>
  );
  expect(content("layout body")).toBeDefined();
  expect(content("advanced body")).toBeUndefined();
  toggle("Advanced first");
  expect(content("advanced body")).toBeDefined();
});
