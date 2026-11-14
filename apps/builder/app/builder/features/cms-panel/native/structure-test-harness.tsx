/**
 * The structure screens' tests mount `CmsScreen` the way
 * `cms-screen.test.tsx` does, over `createFakeCmsSource()` and
 * `createFakeCmsStructureSource()`. Tests only.
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { expect, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { TooltipProvider } from "@webstudio-is/design-system";
import { $cmsNativeDirty } from "./cms-native-stores";
import { CmsScreen, type CmsScreenProps } from "./cms-screen";
import { createFakeCmsSource, type FakeCmsSource } from "./fake-cms-source";
import {
  createFakeCmsStructureSource,
  type FakeCmsStructureSource,
} from "./fake-cms-structure-source";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export type Harness = {
  fake: FakeCmsSource;
  structure: FakeCmsStructureSource;
  props: CmsScreenProps;
};

let root: Root | undefined;
let container: HTMLElement | undefined;

export const harness: Harness = {
  fake: createFakeCmsSource(),
  structure: createFakeCmsStructureSource(),
  props: {} as CmsScreenProps,
};

export const resetHarness = () => {
  harness.fake = createFakeCmsSource();
  harness.structure = createFakeCmsStructureSource();
  harness.props = {
    source: harness.fake,
    structure: harness.structure,
    hidden: false,
    isVisible: true,
    onClose: vi.fn(),
    onShowClassic: vi.fn(),
  };
  $cmsNativeDirty.set(false);
};

export const draw = (overrides: Partial<CmsScreenProps> = {}) => {
  harness.props = { ...harness.props, ...overrides };
  act(() => {
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(CmsScreen, harness.props)
      )
    );
  });
};

export const mount = (overrides: Partial<CmsScreenProps> = {}) => {
  container = document.createElement("div");
  // the overlay's box: everything right of the rail
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);
  root = createRoot(container);
  draw(overrides);
};

export const unmount = () => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.restoreAllMocks();
};

/**
 * Lets the fakes' answers, and what they set, land. It first waits a frame:
 * the design system's Dialog reports its close a frame later, and that update
 * must land here, not inside the next click's act(), which would wait on an
 * overlay act itself holds open.
 */
export const settle = async () => {
  await act(async () => {
    if (vi.isFakeTimers()) {
      await vi.advanceTimersByTimeAsync(16);
    } else {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      if (vi.isFakeTimers()) {
        await vi.advanceTimersByTimeAsync(0);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
  }
};

export const reopen = async () => {
  draw({ isVisible: false });
  draw({ isVisible: true });
  await settle();
};

export const byLabel = (label: string) =>
  document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

export const buttonByText = (
  text: string,
  scope: Element | Document = document
) =>
  [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === text
  );

export const hasText = (text: string) =>
  document.body.textContent?.includes(text) ?? false;

export const rowOf = (slug: string) =>
  document.querySelector<HTMLElement>(`[data-cms-collection="${slug}"]`);

export const currentSlug = () =>
  document.querySelector<HTMLElement>("[data-cms-collection][data-current]")
    ?.dataset.cmsCollection;

export const tab = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (entry) => entry.textContent === name
  );

export const click = async (element: Element | null | undefined) => {
  expect(element).toBeTruthy();
  await act(async () => userEvent.click(element as HTMLElement));
  await settle();
};

/**
 * Closes the unsaved guard and waits for it to go. The design system's Dialog
 * reports its close a frame later, so a click sent before that frame lands
 * inside act() and waits on an overlay act itself holds open.
 */
const closeGuard = async (label: "Keep editing" | "Discard") => {
  await click(buttonByText(label));
  await vi.waitFor(() =>
    expect(hasText("Discard unsaved changes?")).toBe(false)
  );
  await settle();
};

export const keepEditing = () => closeGuard("Keep editing");

export const discardChanges = () => closeGuard("Discard");

export const menuItems = () =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].map(
    (item) => item.textContent
  );

export const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (item) => item.textContent === label
  );

/** Types into a control, replacing what it holds. */
export const typeInto = async (
  element: HTMLInputElement | HTMLTextAreaElement | null,
  text: string
) => {
  expect(element).toBeTruthy();
  await act(async () => userEvent.clear(element!));
  if (text !== "") {
    await act(async () => userEvent.type(element!, text));
  }
  await settle();
};

export const fieldRow = (key: string) =>
  document.querySelector<HTMLElement>(`[data-cms-field-row="${key}"]`);

export const fieldKeys = () =>
  [...document.querySelectorAll<HTMLElement>("[data-cms-field-row]")].map(
    (row) => row.dataset.cmsFieldRow
  );

/** A promise and its settle functions: a held answer. */
export const deferred = <Value,>() => {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/** Opens the Posts item and types over its Title: unsaved values. */
export const editItemTitle = async () => {
  await click(document.querySelector<HTMLElement>("[data-cms-item-id]"));
  const title = document.querySelector<HTMLInputElement>("#cms-field-title");
  await typeInto(title, "Mine");
  expect($cmsNativeDirty.get()).toBe(true);
};
