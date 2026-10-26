/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  checkRotationStructure,
  getOwnPanels,
  getOwnTabLists,
  getOwnTabs,
  getSelectedIndex,
} from "./structure";

// Shaped like upstream's Tabs with the Rotating Tabs template inside:
// the control's button first, the tab list, then force-mounted panels.
const build = (html: string) => {
  document.body.innerHTML = `<div data-testid="root">${html}</div>`;
  const root = document.querySelector('[data-testid="root"]') as HTMLElement;
  const button = root.querySelector("button[data-control]") as HTMLElement;
  return { root, button };
};

const tabList = (count: number, selected = 0) =>
  `<div role="tablist">${Array.from(
    { length: count },
    (_, index) =>
      `<button role="tab" aria-selected="${index === selected}">Tab ${index}</button>`
  ).join("")}</div>`;

const panels = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => `<div role="tabpanel">Panel ${index}</div>`
  ).join("");

const control = `<button data-control type="button">Pause</button>`;

// jsdom lays nothing out, so offsetParent is always null there: these tests
// say which panels are rendered.
const renderPanels = (rendered: (panel: HTMLElement) => boolean) => {
  vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.getAttribute("role") === "tabpanel" && rendered(this)
        ? document.body
        : null;
    }
  );
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("checkRotationStructure", () => {
  test("accepts the template's shape: the control, then the tab list and its panels", () => {
    const { root, button } = build(control + tabList(3) + panels(3));
    expect(checkRotationStructure(root, button)).toBe(true);
  });

  test("ignores the canvas check beside the button, which is not a tab list", () => {
    const { root, button } = build(
      control +
        `<div data-organizeos-canvas-check="">Rotating Tabs needs attention</div>` +
        tabList(3) +
        panels(3)
    );
    expect(checkRotationStructure(root, button)).toBe(true);
  });

  test("refuses a control after the tab list", () => {
    const { root, button } = build(tabList(3) + control + panels(3));
    expect(checkRotationStructure(root, button)).toBe(false);
  });

  test("refuses a parent with no tab list, or with two of its own", () => {
    const none = build(control + panels(2));
    expect(checkRotationStructure(none.root, none.button)).toBe(false);
    const two = build(control + tabList(2) + tabList(2) + panels(2));
    expect(checkRotationStructure(two.root, two.button)).toBe(false);
  });

  test("refuses a control that is not a child of the root, and missing elements", () => {
    const { root, button } = build(
      `<div>${control}</div>` + tabList(2) + panels(2)
    );
    expect(checkRotationStructure(root, button)).toBe(false);
    expect(checkRotationStructure(null, button)).toBe(false);
    expect(checkRotationStructure(root, null)).toBe(false);
  });

  test("a Tabs nested in a panel is not the root's", () => {
    const nested = `<div>${tabList(2)}${panels(2)}</div>`;
    const { root, button } = build(
      control +
        tabList(2) +
        `<div role="tabpanel">Panel 0${nested}</div><div role="tabpanel">Panel 1</div>`
    );
    expect(checkRotationStructure(root, button)).toBe(true);
    expect(getOwnTabLists(root)).toHaveLength(1);
  });

  test("refuses two rendered panels: the inactive ones are not hidden", () => {
    const { root, button } = build(control + tabList(3) + panels(3));
    renderPanels(() => true);
    expect(checkRotationStructure(root, button)).toBe(false);
  });

  test("accepts one rendered panel, and none (a hidden section)", () => {
    const { root, button } = build(control + tabList(3) + panels(3));
    renderPanels((panel) => panel.textContent === "Panel 1");
    expect(checkRotationStructure(root, button)).toBe(true);
    vi.restoreAllMocks();
    renderPanels(() => false);
    expect(checkRotationStructure(root, button)).toBe(true);
  });

  test("counts only the root's own panels as rendered", () => {
    const nested = `<div>${tabList(2)}<div role="tabpanel">Inner 0</div></div>`;
    const { root, button } = build(
      control +
        tabList(2) +
        `<div role="tabpanel">Panel 0${nested}</div><div role="tabpanel">Panel 1</div>`
    );
    renderPanels((panel) => panel.textContent?.startsWith("Inner") === false);
    // Panel 0 and Panel 1 are both rendered: refused
    expect(checkRotationStructure(root, button)).toBe(false);
    vi.restoreAllMocks();
    renderPanels(
      (panel) =>
        panel.textContent?.startsWith("Panel 0") === true ||
        panel.textContent === "Inner 0"
    );
    // Panel 0 and the nested Tabs' panel inside it: one of the root's own
    expect(checkRotationStructure(root, button)).toBe(true);
  });
});

describe("getOwnTabs and getSelectedIndex", () => {
  test("lists the root's tabs in order, not a nested Tabs'", () => {
    const nested = `<div>${tabList(4, 3)}</div>`;
    const { root } = build(
      control +
        tabList(3, 2) +
        `<div role="tabpanel">Panel 0${nested}</div>` +
        panels(2)
    );
    const tabs = getOwnTabs(root);
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Tab 0",
      "Tab 1",
      "Tab 2",
    ]);
    expect(getSelectedIndex(tabs)).toBe(2);
  });

  test("gives -1 when no tab is selected", () => {
    const { root } = build(control + tabList(3, -1) + panels(3));
    expect(getSelectedIndex(getOwnTabs(root))).toBe(-1);
  });
});

describe("getOwnPanels", () => {
  test("lists the root's panels, not those of a Tabs nested in one", () => {
    const { root } = build(
      control +
        tabList(2) +
        `<div role="tabpanel" data-own="0">${tabList(2)}<div role="tabpanel">Inner</div></div>` +
        `<div role="tabpanel" data-own="1">Panel 1</div>`
    );
    expect(getOwnPanels(root).map((panel) => panel.dataset.own)).toEqual([
      "0",
      "1",
    ]);
  });
});
