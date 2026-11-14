// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { TooltipProvider } from "@webstudio-is/design-system";
import { CmsScreen, type CmsScreenProps } from "./cms-screen";
import { $cmsNativeDirty } from "./cms-native-stores";
import type { CmsCollection } from "./cms-source";
import {
  createFakeCmsSource,
  itemOf,
  itemsPageOf,
  POSTS_DETAIL,
  rowOf,
  type FakeCmsSource,
} from "./fake-cms-source";
import * as richTextHtml from "./rich-text-html";

// the save-time backstop, stubbed per test; by default it is the real one
vi.mock("./rich-text-html", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rich-text-html")>();
  return { ...actual, settleRichTextHtml: vi.fn(actual.settleRichTextHtml) };
});
const settleSpy = vi.mocked(richTextHtml.settleRichTextHtml);

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const V2 = "2026-11-12T10:00:02.5+00:00";
const NEW_ID = "44444444-4444-4444-8444-444444444444";

let root: Root | undefined;
let container: HTMLElement | undefined;
let fake: FakeCmsSource;

/** `width` is the overlay's box; the column takes 240 px of it. */
const mount = (width = 1200, overrides: Partial<CmsScreenProps> = {}) => {
  container = document.createElement("div");
  container.style.width = `${width}px`;
  container.style.height = "800px";
  document.body.appendChild(container);
  root = createRoot(container);
  const props: CmsScreenProps = {
    source: fake,
    hidden: false,
    isVisible: true,
    onClose: vi.fn(),
    onShowClassic: vi.fn(),
    ...overrides,
  };
  act(() => {
    root?.render(
      createElement(TooltipProvider, null, createElement(CmsScreen, props))
    );
  });
};

// Lets the fake source's answers, and what they set, land.
const settle = async () => {
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const byLabel = (label: string) =>
  document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

const buttonByText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === text
  );

const input = (id: string) =>
  document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
const titleInput = () => input("cms-field-title") as HTMLInputElement | null;
const conflictLine = () =>
  document.querySelector<HTMLElement>("[data-cms-conflict]");

const click = async (element: HTMLElement | null | undefined) => {
  expect(element).toBeTruthy();
  await act(async () => userEvent.click(element!));
  await settle();
};

const retype = async (
  element: HTMLInputElement | HTMLTextAreaElement | null,
  text: string
) => {
  expect(element).not.toBeNull();
  await act(async () => userEvent.clear(element!));
  if (text !== "") {
    await act(async () => userEvent.type(element!, text));
  }
  await settle();
};

const setFields = (fields: CmsCollection["fields"]) => {
  fake.getCollection.mockResolvedValue({
    collection: { ...POSTS_DETAIL, fields },
  });
};

const WITH_BODY: CmsCollection["fields"] = [
  ...POSTS_DETAIL.fields,
  { key: "body", label: "Body", kind: "richtext" },
];

const dataWith = (body: unknown, title = "Hello") => ({
  title,
  summary: null,
  author: null,
  body,
});

const bodyEditable = () =>
  vi.waitFor(() => {
    const element = document.querySelector<HTMLElement>(
      '[data-cms-field="cms-field-body"] [contenteditable="true"]'
    );
    expect(element).not.toBeNull();
    return element!;
  });

/** Types `text` over the body's whole value. */
const typeBody = async (text: string) => {
  const editable = await bodyEditable();
  await act(async () => userEvent.click(editable));
  await act(async () => userEvent.keyboard(`{Control>}a{/Control}${text}`));
  await settle();
};

const SETTLED = "<p>Two, as the editor writes it</p>";
const settles = () =>
  settleSpy.mockImplementation((html) =>
    html.includes("Two")
      ? { html: SETTLED, outcome: "settled" }
      : { html, outcome: "unchanged" }
  );

const sentBody = () =>
  (fake.updateItem.mock.lastCall?.[2].data.body ?? undefined) as
    | { html: string; text: string }
    | undefined;

const openWithBody = async (
  body: unknown = { html: "<p>One</p>", text: "One" }
) => {
  setFields(WITH_BODY);
  const item = itemOf({ data: dataWith(body) });
  fake.listItems.mockResolvedValue(itemsPageOf([rowOf(item)], 1, 1));
  fake.getItem.mockResolvedValue({ item });
  mount();
  await settle();
  await click(
    document.querySelector<HTMLElement>(`[data-cms-item-id="${item.id}"]`)
  );
  expect(titleInput()).not.toBeNull();
  return item;
};

beforeEach(() => {
  fake = createFakeCmsSource();
  $cmsNativeDirty.set(false);
  settleSpy.mockClear();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  settleSpy.mockReset();
  vi.restoreAllMocks();
});

describe("Save's rich-text backstop", () => {
  test("an edited rich-text value that settles is sent as the editor's own write", async () => {
    await openWithBody();
    await typeBody("Two");
    settles();
    fake.updateItem.mockImplementationOnce(async (_c, id, body) => ({
      item: itemOf({ id, data: body.data, updatedAt: V2 }),
    }));
    await click(buttonByText("Save"));
    expect(sentBody()?.html).toBe(SETTLED);
  });

  test("an edited value kept, or a backstop that throws, is sent as drafted", async () => {
    await openWithBody();
    await typeBody("Two");
    settleSpy.mockImplementation((html) => ({ html, outcome: "kept" }));
    fake.updateItem.mockResolvedValueOnce({ error: "unavailable" });
    fake.getItem.mockResolvedValueOnce({
      item: itemOf({ data: dataWith({ html: "<p>One</p>", text: "One" }) }),
    });
    await click(buttonByText("Save"));
    expect(sentBody()?.html).not.toBe(SETTLED);
    expect(sentBody()?.html).toContain("Two");
    settleSpy.mockImplementation(() => {
      throw new Error("no module");
    });
    fake.updateItem.mockResolvedValueOnce({ error: "unavailable" });
    fake.getItem.mockResolvedValueOnce({
      item: itemOf({ data: dataWith({ html: "<p>One</p>", text: "One" }) }),
    });
    await click(buttonByText("Save"));
    expect(fake.updateItem).toHaveBeenCalledTimes(2);
    expect(sentBody()?.html).toContain("Two");
  });

  test("an untouched rich-text field is sent byte-identical, and the backstop never sees it", async () => {
    const stored = {
      html: "<ul><li><p>a</p><p>b</p></li></ul>",
      text: "a b",
    };
    await openWithBody(stored);
    await retype(titleInput(), "Mine");
    fake.updateItem.mockImplementationOnce(async (_c, id, body) => ({
      item: itemOf({ id, data: body.data, updatedAt: V2 }),
    }));
    await click(buttonByText("Save"));
    expect(sentBody()?.html).toBe(stored.html);
    expect(settleSpy).not.toHaveBeenCalled();
  });

  test("Publish with edits saves the settled value, then publishes it", async () => {
    await openWithBody();
    await typeBody("Two");
    settles();
    fake.updateItem.mockImplementationOnce(async (_c, id, body) => ({
      item: itemOf({ id, data: body.data, updatedAt: V2 }),
    }));
    await click(buttonByText("Publish"));
    expect(sentBody()?.html).toBe(SETTLED);
    expect(fake.publishItem).toHaveBeenCalledTimes(1);
    expect(fake.publishItem.mock.lastCall?.[2]).toEqual({
      expectedUpdatedAt: V2,
    });
  });

  test("an unknown outcome that landed the settled value shows no Use my edit", async () => {
    await openWithBody();
    await typeBody("Two");
    settles();
    fake.updateItem.mockResolvedValueOnce({ error: "unavailable" });
    const landed = itemOf({
      data: dataWith({ html: SETTLED, text: "Two, as the editor writes it" }),
      updatedAt: V2,
    });
    fake.getItem.mockResolvedValueOnce({ item: landed });
    await click(buttonByText("Save"));
    expect(byLabel("Use my edit: Body")).toBeNull();
    expect(conflictLine()).toBeNull();
  });

  test("Publish with edits whose publish answer is lost after a settled Save leaves the editor clean", async () => {
    await openWithBody();
    await typeBody("Two");
    settles();
    fake.updateItem.mockImplementationOnce(async (_c, id, body) => ({
      item: itemOf({ id, data: body.data, updatedAt: V2 }),
    }));
    fake.publishItem.mockResolvedValueOnce({ error: "unavailable" });
    const published = itemOf({
      data: dataWith({ html: SETTLED, text: "Two, as the editor writes it" }),
      updatedAt: "2026-11-12T10:00:03.5+00:00",
    });
    fake.getItem.mockResolvedValueOnce({ item: published });
    await click(buttonByText("Publish"));
    expect(fake.publishItem).toHaveBeenCalledTimes(1);
    expect(byLabel("Use my edit: Body")).toBeNull();
    expect(conflictLine()).toBeNull();
    expect($cmsNativeDirty.get()).toBe(false);
  });

  test("an E6 replay that differs from the draft only by the settling makes one create call", async () => {
    setFields(WITH_BODY);
    mount();
    await settle();
    await click(buttonByText("New item"));
    await retype(titleInput(), "Hello world");
    await typeBody("Two");
    settles();
    fake.createItem.mockImplementationOnce(async (_c, body) => ({
      item: itemOf({
        id: NEW_ID,
        slug: "hello-world",
        data: body.data,
        updatedAt: V2,
      }),
      created: false,
    }));
    await click(buttonByText("Save"));
    expect(fake.createItem).toHaveBeenCalledTimes(1);
    expect(
      (fake.createItem.mock.lastCall?.[1].data.body as { html: string }).html
    ).toBe(SETTLED);
    expect(fake.updateItem).not.toHaveBeenCalled();
    // the replay stored the settled values: nothing is left to save
    expect($cmsNativeDirty.get()).toBe(false);
    expect(buttonByText("Save")?.disabled).toBe(true);
  });

  test("Use my edit after a conflict restores a rich-text draft as a Save would send it", async () => {
    await openWithBody();
    await typeBody("Two");
    settles();
    fake.updateItem.mockResolvedValueOnce({ error: "conflict" });
    await click(buttonByText("Save"));
    expect(conflictLine()).not.toBeNull();
    fake.getItem.mockResolvedValueOnce({
      item: itemOf({
        data: dataWith({ html: "<p>Theirs</p>", text: "Theirs" }),
        updatedAt: V2,
      }),
    });
    await click(buttonByText("Reload"));
    expect((await bodyEditable()).textContent).toBe("Theirs");
    await click(byLabel("Use my edit: Body"));
    await vi.waitFor(async () => {
      expect((await bodyEditable()).textContent).toBe(
        "Two, as the editor writes it"
      );
    });
    // round 6, K13: what was restored is no longer offered
    expect(byLabel("Use my edit: Body")).toBeNull();
  });
});
