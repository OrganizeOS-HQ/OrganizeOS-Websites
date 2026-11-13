// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { toast, TooltipProvider } from "@webstudio-is/design-system";
import { CmsScreen, type CmsScreenProps } from "./cms-screen";
import { $cmsNativeDirty, refreshCmsNative } from "./cms-native-stores";
import type {
  CmsAccess,
  CmsCollection,
  CmsItem,
  CmsItemStatus,
  CmsResult,
} from "./cms-source";
import {
  createFakeCmsSource,
  itemOf,
  itemsPageOf,
  PEOPLE,
  POSTS,
  POSTS_DETAIL,
  rowOf,
  VERSION,
  type FakeCmsSource,
} from "./fake-cms-source";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const V2 = "2026-11-12T10:00:02.5+00:00";
const V3 = "2026-11-12T10:00:03.75+00:00";
const NEW_ID = "44444444-4444-4444-8444-444444444444";
/** A referenced item since deleted: E5 by id no longer answers it. */
const GONE = "99999999-9999-4999-8999-999999999999";
const ANN = "55555555-5555-4555-8555-555555555555";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const byLabel = (label: string) =>
  document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

const buttonByText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === text
  );

const hasText = (text: string) =>
  document.body.textContent?.includes(text) ?? false;

const header = () =>
  document.querySelector<HTMLElement>("[data-cms-editor-header]");

/** The header's buttons that carry a word: its actions. */
const headerActions = () =>
  [...(header()?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
    .map((button) => button.textContent ?? "")
    .filter((text) => text !== "");

const input = (id: string) =>
  document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
const titleInput = () => input("cms-field-title") as HTMLInputElement | null;
const addressInput = () => input("cms-field-slug") as HTMLInputElement | null;

const fieldError = (id: string) =>
  document
    .querySelector<HTMLElement>(`[data-cms-field="${id}"]`)
    ?.querySelector<HTMLElement>('[role="alert"]')?.textContent;

const conflictLine = () =>
  document.querySelector<HTMLElement>("[data-cms-conflict]");

const isDisabled = (text: string) => buttonByText(text)?.disabled;

const chipText = () =>
  header()?.querySelector<HTMLElement>("[data-cms-status]")?.textContent;

const crumbParts = () => {
  const crumb = document.querySelector<HTMLElement>("[data-cms-crumb]");
  const parts = [...(crumb?.children ?? [])].map(
    (element) => element.textContent
  );
  // the collection part, then the item part, apart from the "/" between
  return { collection: parts[0], item: parts[2] };
};

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

/** Mounts the screen with `item` listed and opens it. */
const openItem = async (item: CmsItem = itemOf(), width?: number) => {
  fake.listItems.mockResolvedValue(itemsPageOf([rowOf(item)], 1, 1));
  fake.getItem.mockResolvedValue({ item });
  mount(width);
  await settle();
  await click(
    document.querySelector<HTMLElement>(`[data-cms-item-id="${item.id}"]`)
  );
  expect(titleInput()).not.toBeNull();
};

const menuTexts = () =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].map(
    (element) => element.textContent
  );

const menuItem = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (element) => element.textContent === text
  );

const dialogButton = (text: string) =>
  [
    ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ].find((button) => button.textContent === text);

const access = (overrides: Partial<CmsAccess>): CmsAccess => ({
  canEdit: true,
  canPublish: true,
  canManageSettings: false,
  ...overrides,
});

const openNewItem = async () => {
  mount();
  await settle();
  await click(buttonByText("New item"));
  expect(titleInput()).not.toBeNull();
};

const setFields = (fields: CmsCollection["fields"]) => {
  fake.getCollection.mockResolvedValue({
    collection: { ...POSTS_DETAIL, fields },
  });
};

const STALE_FIELDS: CmsCollection["fields"] = [
  POSTS_DETAIL.fields[0],
  POSTS_DETAIL.fields[2],
  { key: "subtitle", label: "Subtitle", kind: "text" },
];

beforeEach(() => {
  fake = createFakeCmsSource();
  $cmsNativeDirty.set(false);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.restoreAllMocks();
});

describe("saving, publishing and discarding", () => {
  test.each([
    [{ canEdit: false, canPublish: false }, [], true],
    [{ canEdit: true, canPublish: false }, ["Save"], false],
    [{ canEdit: true, canPublish: true }, ["Save", "Publish"], false],
  ] as const)(
    "with %o the header's action buttons are %o; every field disabled: %s",
    async (flags, actions, allDisabled) => {
      fake.getAccess.mockResolvedValue({
        ...flags,
        canManageSettings: false,
      } satisfies CmsAccess);
      await openItem();
      expect(byLabel("Back")).not.toBeNull();
      expect(headerActions()).toEqual(actions);
      const controls = [
        ...document.querySelectorAll<HTMLInputElement>(
          "[data-cms-editor-fields] input, [data-cms-editor-fields] textarea"
        ),
      ];
      expect(controls.length).toBeGreaterThanOrEqual(3);
      expect(controls.every((control) => control.disabled)).toBe(allDisabled);
    }
  );

  test("Save is primary without canPublish, neutral beside a primary Publish with it", async () => {
    fake.getAccess.mockResolvedValue({
      canEdit: true,
      canPublish: false,
      canManageSettings: false,
    });
    await openItem();
    expect(buttonByText("Save")?.dataset.buttonColor).toBe("primary");
    act(() => root?.unmount());
    container?.remove();

    fake.getAccess.mockResolvedValue({
      canEdit: true,
      canPublish: true,
      canManageSettings: false,
    });
    await openItem();
    expect(buttonByText("Save")?.dataset.buttonColor).toBe("neutral");
    expect(buttonByText("Publish")?.dataset.buttonColor).toBe("primary");
  });

  test("Save sends E7 with the exact version, and the answer becomes the baseline", async () => {
    await openItem();
    expect(buttonByText("Save")?.disabled).toBe(true);
    await retype(titleInput(), "Hello again");
    fake.updateItem.mockResolvedValueOnce({
      item: itemOf({
        data: { title: "Hello again", summary: null, author: null },
        updatedAt: V2,
      }),
    });
    await click(buttonByText("Save"));
    expect(fake.updateItem).toHaveBeenCalledWith(
      POSTS.id,
      itemOf().id,
      expect.objectContaining({
        data: { title: "Hello again", summary: null, author: null },
        expectedUpdatedAt: VERSION,
      })
    );
    expect(buttonByText("Save")?.disabled).toBe(true);
    expect($cmsNativeDirty.get()).toBe(false);

    await retype(titleInput(), "Hello once more");
    fake.updateItem.mockResolvedValueOnce({
      item: itemOf({
        data: { title: "Hello once more", summary: null, author: null },
        updatedAt: V3,
      }),
    });
    await click(buttonByText("Save"));
    expect(fake.updateItem).toHaveBeenLastCalledWith(
      POSTS.id,
      itemOf().id,
      expect.objectContaining({ expectedUpdatedAt: V2 })
    );
  });

  test("Save on a published item stages it: the chip reads Staged changes and Discard changes shows", async () => {
    await openItem(itemOf({ status: "published" }));
    expect(chipText()).toBe("Published");
    expect(buttonByText("Discard changes")).toBeUndefined();
    await retype(titleInput(), "Hello staged");
    fake.updateItem.mockResolvedValueOnce({
      item: itemOf({
        status: "published",
        hasStagedChanges: true,
        data: { title: "Hello staged", summary: null, author: null },
        updatedAt: V2,
      }),
    });
    await click(buttonByText("Save"));
    expect(chipText()).toBe("Staged changes");
    expect(buttonByText("Discard changes")).toBeDefined();
  });

  test("Publish with unsaved edits saves, then publishes with the saved version", async () => {
    await openItem();
    await retype(titleInput(), "Hello again");
    const order: string[] = [];
    fake.updateItem.mockImplementationOnce(async () => {
      order.push("updateItem");
      return {
        item: itemOf({
          data: { title: "Hello again", summary: null, author: null },
          updatedAt: V2,
        }),
      };
    });
    fake.publishItem.mockImplementationOnce(async () => {
      order.push("publishItem");
      return {
        item: itemOf({
          status: "published",
          data: { title: "Hello again", summary: null, author: null },
          updatedAt: V3,
        }),
      };
    });
    await click(buttonByText("Publish"));
    expect(order).toEqual(["updateItem", "publishItem"]);
    expect(fake.publishItem).toHaveBeenCalledWith(POSTS.id, itemOf().id, {
      expectedUpdatedAt: V2,
    });
    expect(chipText()).toBe("Published");
  });

  test("Publish on a new item creates it, then publishes it with the version E6 returned", async () => {
    await openNewItem();
    await retype(titleInput(), "Hello world");
    expect(addressInput()?.value).toBe("hello-world");
    const made = itemOf({
      id: NEW_ID,
      slug: "hello-world",
      data: { title: "Hello world", summary: null, author: null },
      updatedAt: V2,
    });
    fake.createItem.mockResolvedValueOnce({ item: made, created: true });
    fake.publishItem.mockResolvedValueOnce({
      item: { ...made, status: "published", updatedAt: V3 },
    });
    await click(buttonByText("Publish"));
    expect(fake.createItem).toHaveBeenCalledWith(
      POSTS.id,
      expect.objectContaining({
        clientId: expect.stringMatching(UUID_RE),
        data: { title: "Hello world", summary: null, author: null },
      })
    );
    expect(fake.publishItem).toHaveBeenCalledWith(POSTS.id, NEW_ID, {
      expectedUpdatedAt: V2,
    });
    expect(fake.updateItem).not.toHaveBeenCalled();
    expect(chipText()).toBe("Published");
  });

  test.each([
    ["a draft", "draft", false, false, "Publish", true],
    ["an archived item", "archived", false, false, "Publish", true],
    [
      "a published item, nothing to publish",
      "published",
      false,
      false,
      "Publish changes",
      false,
    ],
    [
      "a published item with staged changes",
      "published",
      true,
      false,
      "Publish changes",
      true,
    ],
    [
      "a published item with unsaved edits",
      "published",
      false,
      true,
      "Publish changes",
      true,
    ],
  ] as const)(
    "%s offers %s",
    async (_name, status: CmsItemStatus, staged, edited, label, enabled) => {
      await openItem(itemOf({ status, hasStagedChanges: staged }));
      if (edited) {
        await retype(titleInput(), "Hello edited");
      }
      const button = buttonByText(label);
      expect(button).toBeDefined();
      expect(button?.disabled).toBe(enabled === false);
    }
  );

  test("Discard changes asks Discard staged changes?, and Cancel leaves it", async () => {
    await openItem(itemOf({ status: "published", hasStagedChanges: true }));
    await click(buttonByText("Discard changes"));
    expect(hasText("Discard staged changes?")).toBe(true);
    await click(buttonByText("Cancel"));
    // the dialog leaves once its closing animation ends
    await vi.waitFor(() =>
      expect(hasText("Discard staged changes?")).toBe(false)
    );
    expect(fake.discardItemChanges).not.toHaveBeenCalled();
    expect(chipText()).toBe("Staged changes");
  });

  test("Discard sends E8b with the version, and the answer becomes the baseline", async () => {
    await openItem(itemOf({ status: "published", hasStagedChanges: true }));
    fake.discardItemChanges.mockResolvedValueOnce({
      item: itemOf({ status: "published", updatedAt: V2 }),
    });
    await click(buttonByText("Discard changes"));
    await click(buttonByText("Discard"));
    expect(fake.discardItemChanges).toHaveBeenCalledWith(
      POSTS.id,
      itemOf().id,
      { expectedUpdatedAt: VERSION }
    );
    expect(chipText()).toBe("Published");
    expect(buttonByText("Discard changes")).toBeUndefined();
    await retype(titleInput(), "Hello again");
    fake.updateItem.mockResolvedValueOnce({ item: itemOf({ updatedAt: V3 }) });
    await click(buttonByText("Save"));
    expect(fake.updateItem).toHaveBeenCalledWith(
      POSTS.id,
      itemOf().id,
      expect.objectContaining({ expectedUpdatedAt: V2 })
    );
  });

  test("the address follows the title until edited", async () => {
    await openNewItem();
    await retype(titleInput(), "Hello world");
    expect(addressInput()?.value).toBe("hello-world");
    await retype(addressInput(), "custom");
    await retype(titleInput(), "Other");
    expect(addressInput()?.value).toBe("custom");
    act(() => root?.unmount());
    container?.remove();

    // an item whose address is its title's derivation follows it
    await openItem(itemOf({ slug: "hello" }));
    await retype(titleInput(), "Hello there");
    expect(addressInput()?.value).toBe("hello-there");
    act(() => root?.unmount());
    container?.remove();

    // one whose address differs does not
    await openItem(itemOf({ slug: "greeting" }));
    await retype(titleInput(), "Hello there");
    expect(addressInput()?.value).toBe("greeting");
  });

  test("Save stays disabled while a write is in flight", async () => {
    await openNewItem();
    await retype(titleInput(), "Hello world");
    const held = deferred<CmsResult<{ item: CmsItem; created: boolean }>>();
    fake.createItem.mockReturnValueOnce(held.promise);
    const save = buttonByText("Save")!;
    await act(async () => userEvent.click(save));
    expect(save.disabled).toBe(true);
    await act(async () => userEvent.click(save, { force: true }));
    expect(fake.createItem).toHaveBeenCalledTimes(1);
    held.resolve({
      item: itemOf({
        id: NEW_ID,
        slug: "hello-world",
        data: { title: "Hello world", summary: null, author: null },
      }),
      created: true,
    });
    await settle();
    expect(fake.createItem).toHaveBeenCalledTimes(1);
  });

  test("Save and Publish wait for an upload in flight", async () => {
    setFields([
      ...POSTS_DETAIL.fields,
      { key: "cover", label: "Cover", kind: "image" },
    ]);
    await openItem(
      itemOf({
        data: { title: "Hello", summary: null, author: null, cover: null },
      })
    );
    // an edit first, so Save was enabled before the upload
    await retype(titleInput(), "Hello again");
    expect(isDisabled("Save")).toBe(false);
    expect(isDisabled("Publish")).toBe(false);
    const held = deferred<CmsResult<{ url: string; path: string }>>();
    fake.uploadImage.mockReturnValueOnce(held.promise);
    const input = document
      .querySelector<HTMLElement>('[data-cms-field="cms-field-cover"]')
      ?.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" })
    );
    await act(async () => {
      input!.files = transfer.files;
      input!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    expect(fake.uploadImage).toHaveBeenCalledTimes(1);
    expect(isDisabled("Save")).toBe(true);
    expect(isDisabled("Publish")).toBe(true);
    await act(async () => {
      held.resolve({ url: "https://cdn.example.org/a.png", path: "a.png" });
    });
    // the upload answers once the file's size is measured too
    await vi.waitFor(() => {
      expect(isDisabled("Save")).toBe(false);
      expect(isDisabled("Publish")).toBe(false);
    });
    expect($cmsNativeDirty.get()).toBe(true);
    await click(buttonByText("Save"));
    expect(fake.updateItem).toHaveBeenCalledWith(
      POSTS.id,
      itemOf().id,
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Hello again",
          cover: expect.objectContaining({
            url: "https://cdn.example.org/a.png",
            path: "a.png",
          }),
        }),
      })
    );
  });

  test("the fields column is 448 px of controls within 16 px of padding, centred", async () => {
    // the main region is 1200 px: the overlay less the 240 px column
    await openItem(itemOf(), 1440);
    const main = document.querySelector<HTMLElement>("[data-cms-native-main]")!;
    expect(main.getBoundingClientRect().width).toBe(1200);
    const fields = document.querySelector<HTMLElement>(
      "[data-cms-editor-fields]"
    );
    expect(fields).not.toBeNull();
    const box = fields!.getBoundingClientRect();
    expect(box.width).toBe(480);
    const style = getComputedStyle(fields!);
    expect(style.paddingLeft).toBe("16px");
    expect(style.paddingRight).toBe("16px");
    const outer = main.getBoundingClientRect();
    const left = box.left - outer.left;
    const right = outer.right - box.right;
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  // Review Focus 1
  test("after Classic CMS changes the fields, Save sends exactly the new schema's keys", async () => {
    await openItem(
      itemOf({ data: { title: "Hello", summary: "S", author: null, old: "x" } })
    );
    await retype(titleInput(), "Hello again");
    setFields(STALE_FIELDS);
    act(() => refreshCmsNative());
    await settle();
    expect(titleInput()?.value).toBe("Hello again");
    expect(input("cms-field-subtitle")?.value).toBe("");
    fake.updateItem.mockResolvedValueOnce({ item: itemOf({ updatedAt: V2 }) });
    await click(buttonByText("Save"));
    const body = fake.updateItem.mock.calls[0][2];
    expect(body.data).toEqual({
      title: "Hello again",
      author: null,
      subtitle: null,
    });
  });

  test("a clean editor that gains a switch and a multi-reference field stays clean", async () => {
    await openItem();
    expect(isDisabled("Save")).toBe(true);
    setFields([
      ...POSTS_DETAIL.fields,
      { key: "featured", label: "Featured", kind: "switch" },
      {
        key: "related",
        label: "Related",
        kind: "multireference",
        reference: { collectionId: POSTS.id, multiple: true },
      },
    ]);
    // the item's own read fails, so only the fields change
    fake.getItem.mockResolvedValue({ error: "unavailable" });
    act(() => refreshCmsNative());
    await settle();
    expect(document.querySelector("#cms-field-featured")).not.toBeNull();
    expect($cmsNativeDirty.get()).toBe(false);
    expect(isDisabled("Save")).toBe(true);
  });

  test("invalid with no field refetches the fields, so the next Save sends their keys", async () => {
    const error = vi.spyOn(toast, "error");
    await openItem();
    await retype(titleInput(), "Hello again");
    const calls = fake.getCollection.mock.calls.length;
    // the frame's change never arrived (another tab)
    setFields(STALE_FIELDS);
    fake.updateItem.mockResolvedValueOnce({ error: "invalid" });
    await click(buttonByText("Save"));
    expect(fake.getCollection).toHaveBeenCalledTimes(calls + 1);
    expect(error).toHaveBeenCalledWith("Not saved");
    expect(fake.getCollection.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      error.mock.invocationCallOrder[0]
    );
    expect(titleInput()?.value).toBe("Hello again");
    fake.updateItem.mockResolvedValueOnce({ item: itemOf({ updatedAt: V2 }) });
    await click(buttonByText("Save"));
    const body = fake.updateItem.mock.calls[1][2];
    expect(body.data).toEqual({
      title: "Hello again",
      author: null,
      subtitle: null,
    });
  });

  // Review Focus 5
  test("a 120-character item name truncates in the crumb, and the header does not overflow", async () => {
    const name = "N".repeat(120);
    await openItem(
      itemOf({ data: { title: name, summary: null, author: null } })
    );
    expect(crumbParts()).toEqual({ collection: "Posts", item: name });
    const crumb = document.querySelector<HTMLElement>("[data-cms-crumb]")!;
    const itemPart = crumb.children[2] as HTMLElement;
    expect(itemPart.scrollWidth).toBeGreaterThan(itemPart.clientWidth);
    const head = header()!;
    expect(head.scrollWidth).toBeLessThanOrEqual(head.clientWidth);
    const main = document.querySelector<HTMLElement>("[data-cms-native-main]")!;
    expect(head.getBoundingClientRect().right).toBeLessThanOrEqual(
      main.getBoundingClientRect().right
    );
    for (const action of ["Save", "Publish"]) {
      const button = buttonByText(action)!;
      expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
        main.getBoundingClientRect().right
      );
    }
    await act(async () => userEvent.hover(itemPart));
    await vi.waitFor(
      () => {
        expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
          name
        );
      },
      { timeout: 3000 }
    );
  });
});

describe("conflicts, unknown outcomes and field errors", () => {
  const mine = itemOf({ data: { title: "Mine", summary: null, author: null } });
  const theirs = itemOf({
    data: { title: "Theirs", summary: "Theirs S", author: null },
    updatedAt: V2,
  });
  const made = (title: string, updatedAt = V2) =>
    itemOf({
      id: NEW_ID,
      slug: "hello-world",
      data: { title, summary: null, author: null },
      updatedAt,
    });

  test.each([
    ["updateItem", itemOf()],
    ["publishItem", itemOf()],
    [
      "discardItemChanges",
      itemOf({ status: "published", hasStagedChanges: true }),
    ],
  ] as const)(
    "%s answered conflict shows Changed by someone else with Reload",
    async (method, item) => {
      fake[method].mockResolvedValueOnce({ error: "conflict" });
      await openItem(item);
      expect(conflictLine()).toBeNull();
      if (method === "updateItem") {
        await retype(titleInput(), "Mine");
        await click(buttonByText("Save"));
      } else if (method === "publishItem") {
        await click(buttonByText("Publish"));
      } else {
        await click(buttonByText("Discard changes"));
        await click(buttonByText("Discard"));
      }
      expect(fake[method]).toHaveBeenCalledTimes(1);
      expect(conflictLine()?.textContent).toContain("Changed by someone else");
      expect(buttonByText("Reload")).toBeDefined();
    }
  );

  test("Reload keeps the person's edit aside, and Use my edit puts it back", async () => {
    await openItem();
    await retype(titleInput(), "Mine");
    fake.updateItem.mockResolvedValueOnce({ error: "conflict" });
    await click(buttonByText("Save"));
    fake.getItem.mockResolvedValueOnce({ item: theirs });
    await click(buttonByText("Reload"));
    expect(titleInput()?.value).toBe("Theirs");
    expect(input("cms-field-summary")?.value).toBe("Theirs S");
    expect(byLabel("Use my edit: Title")).not.toBeNull();
    expect(byLabel("Use my edit: Summary")).toBeNull();
    await click(byLabel("Use my edit: Title"));
    expect(titleInput()?.value).toBe("Mine");
    fake.updateItem.mockResolvedValueOnce({
      item: itemOf({
        data: { title: "Mine", summary: "Theirs S", author: null },
        updatedAt: V3,
      }),
    });
    await click(buttonByText("Save"));
    expect(fake.updateItem).toHaveBeenLastCalledWith(
      POSTS.id,
      itemOf().id,
      expect.objectContaining({
        data: { title: "Mine", summary: "Theirs S", author: null },
        expectedUpdatedAt: V2,
      })
    );
    expect(conflictLine()).toBeNull();
    expect(byLabel("Use my edit: Title")).toBeNull();
  });

  test("a write that landed in the platform's stored form leaves the editor clean, with no conflict line", async () => {
    setFields([
      ...POSTS_DETAIL.fields,
      { key: "tint", label: "Tint", kind: "color" },
      { key: "body", label: "Body", kind: "richtext" },
    ]);
    await openItem(
      itemOf({
        data: {
          title: "Hello",
          summary: null,
          author: null,
          tint: null,
          body: { html: "<p>One</p>", text: "One" },
        },
      })
    );
    await retype(titleInput(), "Mine ");
    await retype(input("cms-field-tint"), "#aabbcc");
    const editable = await vi.waitFor(() => {
      const element = document.querySelector<HTMLElement>(
        '[data-cms-field="cms-field-body"] [contenteditable="true"]'
      );
      expect(element).not.toBeNull();
      return element!;
    });
    await act(async () => userEvent.click(editable));
    await act(async () => userEvent.keyboard("{Control>}a{/Control}Two"));
    await settle();
    fake.updateItem.mockResolvedValueOnce({ error: "unavailable" });
    // the platform trimmed, upper-cased and sanitised what it stored
    fake.getItem.mockResolvedValueOnce({
      item: itemOf({
        data: {
          title: "Mine",
          summary: null,
          author: null,
          tint: "#AABBCC",
          body: { html: "<p>Two</p>", text: "Two" },
        },
        slug: "mine",
        updatedAt: V2,
      }),
    });
    await click(buttonByText("Save"));
    const sent = fake.updateItem.mock.lastCall?.[2].data.body as {
      html: string;
    };
    expect(sent.html).toContain("Two");
    expect(conflictLine()).toBeNull();
    expect(document.querySelector("[data-cms-use-mine]")).toBeNull();
    expect($cmsNativeDirty.get()).toBe(false);
    expect(isDisabled("Save")).toBe(true);
  });

  test("Use my edit is disabled while a write is in flight", async () => {
    await openItem();
    await retype(titleInput(), "Mine");
    await retype(input("cms-field-summary"), "My S");
    fake.updateItem.mockResolvedValueOnce({ error: "conflict" });
    await click(buttonByText("Save"));
    fake.getItem.mockResolvedValueOnce({ item: theirs });
    await click(buttonByText("Reload"));
    await click(byLabel("Use my edit: Title"));
    const useSummary = () =>
      byLabel("Use my edit: Summary") as HTMLButtonElement | null;
    expect(useSummary()?.disabled).toBe(false);
    const held = deferred<CmsResult<{ item: CmsItem }>>();
    fake.updateItem.mockReturnValueOnce(held.promise);
    await click(buttonByText("Save"));
    expect(useSummary()?.disabled).toBe(true);
    held.resolve({
      item: itemOf({
        data: { title: "Mine", summary: "Theirs S", author: null },
        updatedAt: V3,
      }),
    });
    await settle();
    expect(useSummary()).toBeNull();
  });

  test("Publish whose E8a answer was lost after its save never brings back what the save retired", async () => {
    await openItem();
    await retype(titleInput(), "Mine");
    await retype(input("cms-field-summary"), "My S");
    fake.updateItem.mockResolvedValueOnce({ error: "conflict" });
    await click(buttonByText("Save"));
    fake.getItem.mockResolvedValueOnce({ item: theirs });
    await click(buttonByText("Reload"));
    expect(byLabel("Use my edit: Title")).not.toBeNull();
    expect(byLabel("Use my edit: Summary")).not.toBeNull();
    await click(byLabel("Use my edit: Title"));
    const saved = itemOf({
      data: { title: "Mine", summary: "Theirs S", author: null },
      updatedAt: V3,
    });
    fake.updateItem.mockResolvedValueOnce({ item: saved });
    fake.publishItem.mockResolvedValueOnce({ error: "unavailable" });
    fake.getItem.mockResolvedValueOnce({
      item: {
        ...saved,
        status: "published",
        updatedAt: "2026-11-12T10:00:04+00:00",
      },
    });
    await click(buttonByText("Publish"));
    expect(fake.updateItem).toHaveBeenCalledTimes(2);
    expect(fake.publishItem).toHaveBeenCalledTimes(1);
    expect(titleInput()?.value).toBe("Mine");
    expect(input("cms-field-summary")?.value).toBe("Theirs S");
    expect(byLabel("Use my edit: Summary")).toBeNull();
    expect(byLabel("Use my edit: Title")).toBeNull();
    expect(conflictLine()).toBeNull();
    expect($cmsNativeDirty.get()).toBe(false);
  });

  test("after E6 times out or answers unavailable, the next Save sends the same clientId, and a 200 opens that item", async () => {
    const error = vi.spyOn(toast, "error");
    await openNewItem();
    await retype(titleInput(), "Hello world");
    fake.createItem.mockResolvedValueOnce({ error: "unavailable" });
    await click(buttonByText("Save"));
    expect(error).toHaveBeenCalledWith("Try again in a minute");
    fake.createItem.mockResolvedValueOnce({
      item: made("Hello world"),
      created: false,
    });
    await click(buttonByText("Save"));
    expect(fake.createItem).toHaveBeenCalledTimes(2);
    const [first, second] = fake.createItem.mock.calls.map(
      ([, body]) => body.clientId
    );
    expect(first).toMatch(UUID_RE);
    expect(second).toBe(first);
    expect(crumbParts()).toEqual({ collection: "Posts", item: "Hello world" });
    expect(isDisabled("Save")).toBe(true);
    expect($cmsNativeDirty.get()).toBe(false);
  });

  test("a 200 replay keeps the edits made since the first attempt, and the next Save is an E7", async () => {
    await openNewItem();
    await retype(titleInput(), "Hello world");
    fake.createItem.mockResolvedValueOnce({ error: "unavailable" });
    await click(buttonByText("Save"));
    await retype(titleInput(), "Hello world 2");
    fake.createItem.mockResolvedValueOnce({
      item: made("Hello world"),
      created: false,
    });
    await click(buttonByText("Save"));
    expect(titleInput()?.value).toBe("Hello world 2");
    expect(isDisabled("Save")).toBe(false);
    expect($cmsNativeDirty.get()).toBe(true);
    fake.updateItem.mockResolvedValueOnce({
      item: made("Hello world 2", V3),
    });
    await click(buttonByText("Save"));
    expect(fake.updateItem).toHaveBeenCalledWith(
      POSTS.id,
      NEW_ID,
      expect.objectContaining({
        data: expect.objectContaining({ title: "Hello world 2" }),
        expectedUpdatedAt: V2,
      })
    );
    expect(fake.createItem).toHaveBeenCalledTimes(2);
    expect(isDisabled("Save")).toBe(true);
  });

  test("Publish on a new item whose E6 replayed older values saves them first", async () => {
    await openNewItem();
    await retype(titleInput(), "Hello world");
    fake.createItem.mockResolvedValueOnce({ error: "unavailable" });
    await click(buttonByText("Save"));
    await retype(titleInput(), "Hello world 2");
    const order: string[] = [];
    fake.createItem.mockImplementationOnce(async () => {
      order.push("createItem");
      return { item: made("Hello world"), created: false };
    });
    fake.updateItem.mockImplementationOnce(async () => {
      order.push("updateItem");
      return { item: made("Hello world 2", V3) };
    });
    fake.publishItem.mockImplementationOnce(async () => {
      order.push("publishItem");
      return {
        item: {
          ...made("Hello world 2", "2026-11-12T10:00:04+00:00"),
          status: "published",
        },
      };
    });
    await click(buttonByText("Publish"));
    expect(order).toEqual(["createItem", "updateItem", "publishItem"]);
    expect(fake.updateItem).toHaveBeenCalledWith(
      POSTS.id,
      NEW_ID,
      expect.objectContaining({
        data: expect.objectContaining({ title: "Hello world 2" }),
        expectedUpdatedAt: V2,
      })
    );
    expect(fake.publishItem).toHaveBeenCalledWith(POSTS.id, NEW_ID, {
      expectedUpdatedAt: V3,
    });
    expect(chipText()).toBe("Published");
  });

  /** A new item with a rich-text Body: the Title typed, the Body "Two". */
  const openNewItemWithBody = async (title: string) => {
    setFields([
      ...POSTS_DETAIL.fields,
      { key: "body", label: "Body", kind: "richtext" },
    ]);
    await openNewItem();
    await retype(titleInput(), title);
    const editable = await vi.waitFor(() => {
      const element = document.querySelector<HTMLElement>(
        '[data-cms-field="cms-field-body"] [contenteditable="true"]'
      );
      expect(element).not.toBeNull();
      return element!;
    });
    await act(async () => userEvent.click(editable));
    await act(async () => userEvent.keyboard("Two"));
    await settle();
  };

  /** The item the first E6 made, as the platform stored it. */
  const madeWithBody = (title: string, slug: string) =>
    itemOf({
      id: NEW_ID,
      slug,
      data: {
        title,
        summary: null,
        author: null,
        body: { html: "<p>Two</p>", text: "Two" },
      },
      updatedAt: V2,
    });

  test("an E6 replay that stored the person's values leaves the editor clean", async () => {
    await openNewItemWithBody("Hello world");
    fake.createItem.mockResolvedValueOnce({ error: "unavailable" });
    await click(buttonByText("Save"));
    const sent = fake.createItem.mock.lastCall?.[1].data.body as {
      html: string;
    };
    expect(sent.html).not.toBe("<p>Two</p>");
    fake.createItem.mockResolvedValueOnce({
      item: madeWithBody("Hello world", "hello-world"),
      created: false,
    });
    await click(buttonByText("Save"));
    expect(fake.createItem).toHaveBeenCalledTimes(2);
    expect(fake.updateItem).not.toHaveBeenCalled();
    expect($cmsNativeDirty.get()).toBe(false);
    expect(isDisabled("Save")).toBe(true);
  });

  test("Publish after an E6 replay that stored the person's values, trimmed and sanitised, publishes with no E7", async () => {
    await openNewItemWithBody("Hello ");
    fake.createItem.mockResolvedValueOnce({ error: "unavailable" });
    await click(buttonByText("Save"));
    const order: string[] = [];
    fake.createItem.mockImplementationOnce(async (_, body) => {
      order.push("createItem");
      return {
        item: madeWithBody("Hello", body.slug ?? "hello"),
        created: false,
      };
    });
    fake.updateItem.mockImplementationOnce(async () => {
      order.push("updateItem");
      return { error: "unavailable" };
    });
    fake.publishItem.mockImplementationOnce(async () => {
      order.push("publishItem");
      return {
        item: {
          ...madeWithBody("Hello", "hello"),
          status: "published",
          updatedAt: V3,
        },
      };
    });
    await click(buttonByText("Publish"));
    expect(order).toEqual(["createItem", "publishItem"]);
    expect(fake.publishItem).toHaveBeenCalledWith(POSTS.id, NEW_ID, {
      expectedUpdatedAt: V2,
    });
  });

  test("after E6 answers not_found, the next Save sends a fresh clientId", async () => {
    const error = vi.spyOn(toast, "error");
    await openNewItem();
    await retype(titleInput(), "Hello world");
    fake.createItem.mockResolvedValueOnce({ error: "not_found" });
    await click(buttonByText("Save"));
    expect(error).toHaveBeenCalledWith("Item not found");
    fake.createItem.mockResolvedValueOnce({
      item: made("Hello world"),
      created: true,
    });
    await click(buttonByText("Save"));
    const [first, second] = fake.createItem.mock.calls.map(
      ([, body]) => body.clientId
    );
    expect(first).toMatch(UUID_RE);
    expect(second).toMatch(UUID_RE);
    expect(second).not.toBe(first);
  });

  test("after E7 is unavailable, the item is fetched before Save, Publish and Discard enable again", async () => {
    const staged = itemOf({ status: "published", hasStagedChanges: true });
    await openItem(staged);
    await retype(titleInput(), "Mine");
    const held = deferred<CmsResult<{ item: CmsItem }>>();
    fake.getItem.mockReturnValueOnce(held.promise);
    fake.updateItem.mockResolvedValueOnce({ error: "unavailable" });
    const calls = fake.getItem.mock.calls.length;
    await click(buttonByText("Save"));
    expect(fake.getItem).toHaveBeenCalledTimes(calls + 1);
    expect(isDisabled("Save")).toBe(true);
    expect(isDisabled("Publish changes")).toBe(true);
    expect(isDisabled("Discard changes")).toBe(true);
    held.resolve({ item: staged });
    await settle();
    expect(isDisabled("Save")).toBe(false);
    expect(isDisabled("Publish changes")).toBe(false);
    expect(isDisabled("Discard changes")).toBe(false);
  });

  test.each([
    [
      "nothing landed (the same version)",
      "same",
      "still dirty, no conflict line",
    ],
    [
      "the write landed (the person's values)",
      "landed",
      "clean, no conflict line",
    ],
    ["another write landed", "other", "the conflict line and Use my edit"],
    ["the fetch failed", "failed", "the conflict line"],
  ] as const)(
    "after E7 is unavailable and %s: %s",
    async (_name, outcome, _expected) => {
      await openItem();
      await retype(titleInput(), "Mine");
      fake.updateItem.mockResolvedValueOnce({ error: "unavailable" });
      fake.getItem.mockResolvedValueOnce(
        outcome === "same"
          ? { item: itemOf() }
          : outcome === "landed"
            ? { item: { ...mine, slug: "mine", updatedAt: V2 } }
            : outcome === "other"
              ? { item: theirs }
              : { error: "unavailable" }
      );
      await click(buttonByText("Save"));
      if (outcome === "same") {
        expect(titleInput()?.value).toBe("Mine");
        expect($cmsNativeDirty.get()).toBe(true);
        expect(isDisabled("Save")).toBe(false);
        expect(conflictLine()).toBeNull();
      } else if (outcome === "landed") {
        expect(titleInput()?.value).toBe("Mine");
        expect($cmsNativeDirty.get()).toBe(false);
        expect(isDisabled("Save")).toBe(true);
        expect(conflictLine()).toBeNull();
        expect(byLabel("Use my edit: Title")).toBeNull();
      } else if (outcome === "other") {
        expect(titleInput()?.value).toBe("Theirs");
        expect(conflictLine()?.textContent).toContain(
          "Changed by someone else"
        );
        expect(byLabel("Use my edit: Title")).not.toBeNull();
        expect(byLabel("Use my edit: Summary")).toBeNull();
      } else {
        expect(titleInput()?.value).toBe("Mine");
        expect(conflictLine()?.textContent).toContain(
          "Changed by someone else"
        );
        expect(buttonByText("Reload")).toBeDefined();
      }
    }
  );

  test("client checks run first: an empty required Title is Required, and nothing is sent", async () => {
    await openItem();
    await retype(titleInput(), "");
    await click(buttonByText("Save"));
    expect(fieldError("cms-field-title")).toBe("Required");
    expect(fake.updateItem).not.toHaveBeenCalled();
  });

  test.each([
    [
      { error: "invalid", field: "title" },
      "Title",
      "cms-field-title",
      "Not valid",
      itemOf(),
    ],
    [
      { error: "slug_taken" },
      "Address",
      "cms-field-slug",
      "Address in use",
      itemOf(),
    ],
    // the door's shape: no field; the author E5 no longer finds is named
    [
      { error: "reference_invalid" },
      "Author",
      "cms-field-author",
      "Item not found",
      itemOf({ data: { title: "Hello", summary: null, author: GONE } }),
    ],
  ] as const)(
    "%o shows under %s: %s",
    async (failure, _label, id, text, item) => {
      const error = vi.spyOn(toast, "error");
      await openItem(item);
      await retype(titleInput(), "Mine");
      fake.updateItem.mockResolvedValueOnce(failure);
      await click(buttonByText("Save"));
      expect(fieldError(id)).toBe(text);
      expect(error).not.toHaveBeenCalled();
      expect(titleInput()?.value).toBe("Mine");
    }
  );

  test("reference_invalid marks each reference and multi-reference field holding an item E5 no longer finds", async () => {
    const error = vi.spyOn(toast, "error");
    setFields([
      ...POSTS_DETAIL.fields,
      {
        key: "editors",
        label: "Editors",
        kind: "multireference",
        reference: { collectionId: PEOPLE.id, multiple: true },
      },
      {
        key: "reviewer",
        label: "Reviewer",
        kind: "reference",
        reference: { collectionId: PEOPLE.id, multiple: false },
      },
    ]);
    fake.searchItems.mockImplementation(async (_collectionId, query) => ({
      items: (query.ids ?? [])
        .filter((id) => id === ANN)
        .map((id) => ({ id, title: "Ann", status: "published" as const })),
    }));
    await openItem(
      itemOf({
        data: {
          title: "Hello",
          summary: null,
          author: ANN,
          editors: [ANN, GONE],
          reviewer: null,
        },
      })
    );
    await retype(titleInput(), "Mine");
    fake.updateItem.mockResolvedValueOnce({ error: "reference_invalid" });
    await click(buttonByText("Save"));
    expect(fieldError("cms-field-editors")).toBe("Item not found");
    expect(fieldError("cms-field-author")).toBeUndefined();
    expect(fieldError("cms-field-reviewer")).toBeUndefined();
    expect(error).not.toHaveBeenCalled();
    expect(titleInput()?.value).toBe("Mine");
  });

  test("reference_invalid with no field to name is the toast Item not found, never Not saved", async () => {
    const error = vi.spyOn(toast, "error");
    await openItem();
    await retype(titleInput(), "Mine");
    fake.updateItem.mockResolvedValueOnce({ error: "reference_invalid" });
    await click(buttonByText("Save"));
    expect(error).toHaveBeenCalledWith("Item not found");
    expect(error).not.toHaveBeenCalledWith("Not saved");
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(titleInput()?.value).toBe("Mine");
  });

  test("invalid with no field is the toast Not saved", async () => {
    const error = vi.spyOn(toast, "error");
    await openItem();
    await retype(titleInput(), "Mine");
    fake.updateItem.mockResolvedValueOnce({ error: "invalid" });
    await click(buttonByText("Save"));
    expect(error).toHaveBeenCalledWith("Not saved");
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(titleInput()?.value).toBe("Mine");
  });

  test("invalid on a field the editor does not draw refetches the fields, then the toast Not saved", async () => {
    const error = vi.spyOn(toast, "error");
    await openItem();
    await retype(titleInput(), "Mine");
    const calls = fake.getCollection.mock.calls.length;
    fake.updateItem.mockResolvedValueOnce({ error: "invalid", field: "gone" });
    await click(buttonByText("Save"));
    expect(fake.getCollection).toHaveBeenCalledTimes(calls + 1);
    expect(error).toHaveBeenCalledWith("Not saved");
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(titleInput()?.value).toBe("Mine");
  });

  test.each([
    ["a draft, full width", "draft", false, 1040, ["Archive", "Delete"]],
    [
      "a published item, canPublish",
      "published",
      false,
      1040,
      ["Unpublish", "Archive", "Delete"],
    ],
    ["an archived item", "archived", false, 1040, ["Restore", "Delete"]],
    [
      "a staged item, compact",
      "published",
      true,
      800,
      ["Discard changes", "Unpublish", "Archive", "Delete"],
    ],
  ] as const)(
    "the Item menu of %s holds %o",
    async (_name, status, staged, width, items) => {
      await openItem(itemOf({ status, hasStagedChanges: staged }), width);
      if (width === 800) {
        // the 800 px editor gives a header under 600 px
        expect(header()!.getBoundingClientRect().width).toBeLessThan(600);
        expect(buttonByText("Discard changes")).toBeUndefined();
      }
      await click(byLabel("Item menu"));
      expect(menuTexts()).toEqual(items);
      expect(
        document.querySelector('[role="menu"] [role="separator"]')
      ).not.toBeNull();
      if (staged) {
        await click(menuItem("Discard changes"));
        expect(hasText("Discard staged changes?")).toBe(true);
      }
    }
  );

  test("no Item menu for a new item or without canEdit; no Unpublish without canPublish", async () => {
    await openNewItem();
    expect(byLabel("Item menu")).toBeNull();
    act(() => root?.unmount());
    container?.remove();

    fake = createFakeCmsSource();
    fake.getAccess.mockResolvedValue(
      access({ canEdit: false, canPublish: false })
    );
    await openItem(itemOf({ status: "published" }));
    expect(byLabel("Item menu")).toBeNull();
    act(() => root?.unmount());
    container?.remove();

    fake = createFakeCmsSource();
    fake.getAccess.mockResolvedValue(
      access({ canEdit: true, canPublish: false })
    );
    await openItem(itemOf({ status: "published" }));
    await click(byLabel("Item menu"));
    expect(menuTexts()).toEqual(["Archive", "Delete"]);
  });
});

describe("the Item menu's actions (Task 19)", () => {
  const PUBLISHED = itemOf({ status: "published", updatedAt: VERSION });

  test.each([
    ["Unpublish", PUBLISHED, "draft", "Draft"],
    ["Archive", PUBLISHED, "archived", "Archived"],
    ["Restore", itemOf({ status: "archived" }), "draft", "Draft"],
  ] as const)(
    "%s with unsaved edits saves, then changes the status, then reads the item",
    async (label, item, status, chip) => {
      fake.updateItem.mockImplementation(async (_c, id, body) => ({
        item: { ...item, id, data: body.data, updatedAt: V2 },
      }));
      fake.setItemsStatus.mockResolvedValue({ changed: [item.id] });
      await openItem(item);
      await retype(titleInput(), "Edited");
      fake.getItem.mockResolvedValue({
        item: {
          ...item,
          status,
          hasStagedChanges: false,
          data: { ...item.data, title: "Edited" },
          updatedAt: V3,
        },
      });
      await click(byLabel("Item menu"));
      await click(menuItem(label));
      expect(fake.updateItem).toHaveBeenCalledTimes(1);
      expect(fake.setItemsStatus).toHaveBeenCalledWith(POSTS.id, {
        ids: [item.id],
        status,
      });
      const order = [
        fake.updateItem.mock.invocationCallOrder[0],
        fake.setItemsStatus.mock.invocationCallOrder[0],
        fake.getItem.mock.invocationCallOrder.at(-1)!,
      ];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(chipText()).toBe(chip);
      expect(isDisabled("Save")).toBe(true);
      expect(titleInput()?.value).toBe("Edited");
    }
  );

  test("a save that conflicts stops: no status call", async () => {
    fake.updateItem.mockResolvedValue({ error: "conflict" });
    await openItem(PUBLISHED);
    await retype(titleInput(), "Edited");
    await click(byLabel("Item menu"));
    await click(menuItem("Archive"));
    expect(fake.updateItem).toHaveBeenCalledTimes(1);
    expect(fake.setItemsStatus).not.toHaveBeenCalled();
    expect(conflictLine()).not.toBeNull();
  });

  test("Restore answered slug_taken marks Address", async () => {
    fake.setItemsStatus.mockResolvedValue({ error: "slug_taken" });
    await openItem(itemOf({ status: "archived" }));
    await click(byLabel("Item menu"));
    await click(menuItem("Restore"));
    expect(fieldError("cms-field-slug")).toBe("Address in use");
  });

  test("Archive answered unavailable reads E4 and shows what it finds", async () => {
    const error = vi.spyOn(toast, "error");
    fake.setItemsStatus.mockResolvedValue({ error: "unavailable" });
    await openItem(PUBLISHED);
    const reads = fake.getItem.mock.calls.length;
    fake.getItem.mockResolvedValue({
      item: { ...PUBLISHED, status: "archived", updatedAt: V2 },
    });
    await click(byLabel("Item menu"));
    await click(menuItem("Archive"));
    expect(fake.getItem.mock.calls.length).toBe(reads + 1);
    expect(chipText()).toBe("Archived");
    expect(error).not.toHaveBeenCalled();
    act(() => root?.unmount());
    container?.remove();

    // it still reads published: the chip stays
    fake = createFakeCmsSource();
    fake.setItemsStatus.mockResolvedValue({ error: "unavailable" });
    await openItem(PUBLISHED);
    await click(byLabel("Item menu"));
    await click(menuItem("Archive"));
    expect(chipText()).toBe("Published");
    expect(error).not.toHaveBeenCalled();
  });

  test("a failed read after Unpublish shows Try again in a minute with Retry", async () => {
    fake.setItemsStatus.mockResolvedValue({ changed: [PUBLISHED.id] });
    await openItem(PUBLISHED);
    fake.getItem.mockResolvedValueOnce({ error: "unavailable" });
    await click(byLabel("Item menu"));
    await click(menuItem("Unpublish"));
    expect(hasText("Try again in a minute")).toBe(true);
    fake.getItem.mockResolvedValue({
      item: { ...PUBLISHED, status: "draft", updatedAt: V2 },
    });
    await click(buttonByText("Retry"));
    expect(hasText("Try again in a minute")).toBe(false);
    expect(chipText()).toBe("Draft");
  });

  test("Delete asks Delete 1 post?, then closes the editor without the guard", async () => {
    const onItemWritten = vi.fn();
    fake.deleteItems.mockResolvedValue({ deleted: [PUBLISHED.id] });
    fake.listItems.mockResolvedValue(itemsPageOf([rowOf(PUBLISHED)], 1, 1));
    fake.getItem.mockResolvedValue({ item: PUBLISHED });
    mount(1200, { onItemWritten });
    await settle();
    await click(
      document.querySelector<HTMLElement>(
        `[data-cms-item-id="${PUBLISHED.id}"]`
      )
    );
    await retype(titleInput(), "Unsaved");
    await click(byLabel("Item menu"));
    await click(menuItem("Delete"));
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Delete 1 post?"
    );
    expect(document.activeElement?.textContent).toBe("Cancel");
    const listCalls = fake.listItems.mock.calls.length;
    await click(dialogButton("Delete"));
    expect(fake.deleteItems).toHaveBeenCalledWith(POSTS.id, {
      ids: [PUBLISHED.id],
    });
    expect(titleInput()).toBeNull();
    expect(hasText("Discard unsaved changes?")).toBe(false);
    expect($cmsNativeDirty.get()).toBe(false);
    expect(fake.listItems.mock.calls.length).toBeGreaterThan(listCalls);
    expect(onItemWritten).toHaveBeenCalledWith("posts", undefined);
  });

  test("Delete answered unavailable closes when E4 is not_found, and stays with a toast when it is found", async () => {
    const error = vi.spyOn(toast, "error");
    fake.deleteItems.mockResolvedValue({ error: "unavailable" });
    await openItem(PUBLISHED);
    fake.getItem.mockResolvedValue({ error: "not_found" });
    await click(byLabel("Item menu"));
    await click(menuItem("Delete"));
    await click(dialogButton("Delete"));
    expect(titleInput()).toBeNull();
    act(() => root?.unmount());
    container?.remove();

    fake = createFakeCmsSource();
    fake.deleteItems.mockResolvedValue({ error: "unavailable" });
    await openItem(PUBLISHED);
    await click(byLabel("Item menu"));
    await click(menuItem("Delete"));
    await click(dialogButton("Delete"));
    expect(titleInput()).not.toBeNull();
    expect(error).toHaveBeenCalledWith("Try again in a minute");
  });

  test.each([
    ["Archive", "setItemsStatus"],
    ["Delete", "deleteItems"],
  ] as const)(
    "%s answered not_found toasts Item not found",
    async (label, method) => {
      const error = vi.spyOn(toast, "error");
      fake[method].mockResolvedValue({ error: "not_found" });
      await openItem(PUBLISHED);
      await click(byLabel("Item menu"));
      await click(menuItem(label));
      if (label === "Delete") {
        await click(dialogButton("Delete"));
      }
      expect(error).toHaveBeenCalledWith("Item not found");
      expect(titleInput()).not.toBeNull();
    }
  );

  test("after Delete the focus is on the table's first row", async () => {
    const other = itemOf({
      id: NEW_ID,
      slug: "other",
      data: { title: "Other", summary: null, author: null },
    });
    let rows = [rowOf(PUBLISHED), rowOf(other)];
    fake.listItems.mockImplementation(async () =>
      itemsPageOf(rows, rows.length, 1)
    );
    fake.deleteItems.mockImplementation(async () => {
      rows = [rowOf(other)];
      return { deleted: [PUBLISHED.id] };
    });
    fake.getItem.mockResolvedValue({ item: PUBLISHED });
    mount();
    await settle();
    await click(
      document.querySelector<HTMLElement>(
        `[data-cms-item-id="${PUBLISHED.id}"]`
      )
    );
    await click(byLabel("Item menu"));
    await click(menuItem("Delete"));
    await click(dialogButton("Delete"));
    expect(document.activeElement).toBe(
      document.querySelector(`[data-cms-item-id="${NEW_ID}"]`)
    );
    expect(document.activeElement).not.toBe(document.body);
    act(() => root?.unmount());
    container?.remove();

    // the last item deleted: New item takes the focus
    fake = createFakeCmsSource();
    rows = [rowOf(PUBLISHED)];
    fake.listItems.mockImplementation(async () =>
      itemsPageOf(rows, rows.length, 1)
    );
    fake.deleteItems.mockImplementation(async () => {
      rows = [];
      return { deleted: [PUBLISHED.id] };
    });
    fake.getItem.mockResolvedValue({ item: PUBLISHED });
    mount();
    await settle();
    await click(
      document.querySelector<HTMLElement>(
        `[data-cms-item-id="${PUBLISHED.id}"]`
      )
    );
    await click(byLabel("Item menu"));
    await click(menuItem("Delete"));
    await click(dialogButton("Delete"));
    expect(document.activeElement?.textContent).toBe("New item");
  });
});

const dotOn = (id: string) =>
  document.querySelector(
    `[data-cms-field="${id}"] [aria-label="Changed since publish"]`
  ) !== null;

const details = () =>
  document.querySelector<HTMLElement>("[data-cms-item-details]");

const detail = (name: string) =>
  document.querySelector<HTMLElement>(`[data-cms-detail="${name}"]`)
    ?.textContent;

/** A published item with staged changes: its title and address differ from the live copy. */
const STAGED = itemOf({
  status: "published",
  hasStagedChanges: true,
  slug: "hello-again",
  data: { title: "Hello again", summary: "Same", author: null },
  publishedAt: "2026-11-05T09:00:00+00:00",
  createdAt: "2026-11-01T09:00:00+00:00",
  modifiedByName: "Robin Example",
  live: {
    slug: "hello",
    data: { title: "Hello", summary: "Same", author: null },
  },
});

describe("the side details and the changed dots (Task 20)", () => {
  test("the side details sit beside the fields at 1040 px and after Address at 600 px", async () => {
    // the column takes 240 px of the overlay's box
    await openItem(STAGED, 1280);
    const fields = document.querySelector<HTMLElement>(
      "[data-cms-editor-fields]"
    )!;
    expect(fields.contains(details())).toBe(false);
    const fieldsBox = fields.getBoundingClientRect();
    const detailsBox = details()!.getBoundingClientRect();
    expect(detailsBox.left).toBeGreaterThanOrEqual(fieldsBox.right - 1);
    // top-aligned with the first field
    const firstRow = fields
      .querySelector<HTMLElement>("[data-cms-field]")!
      .getBoundingClientRect();
    expect(Math.abs(detailsBox.top - firstRow.top)).toBeLessThanOrEqual(1);
    act(() => root?.unmount());
    container?.remove();

    await openItem(STAGED, 840);
    await settle();
    const narrowFields = document.querySelector<HTMLElement>(
      "[data-cms-editor-fields]"
    )!;
    expect(narrowFields.contains(details())).toBe(true);
    const address = document.querySelector<HTMLElement>(
      '[data-cms-field="cms-field-slug"]'
    )!;
    expect(
      address.compareDocumentPosition(details()!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    const body = document.querySelector<HTMLElement>("[data-cms-editor-body]")!;
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth);
  });

  test("Modified by is absent when null; Published reads Not live for a draft", async () => {
    await openItem(STAGED);
    expect(detail("published")).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: "short" }).format(
        new Date(STAGED.publishedAt!)
      )
    );
    expect(detail("modified-by")).toBe("Robin Example");
    expect(detail("created")).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: "short" }).format(
        new Date(STAGED.createdAt)
      )
    );
    expect(details()?.textContent).toContain("Modified");
    // Modified reads the version's time, with or without Modified by
    expect(detail("modified")).toBeTruthy();
    expect(detail("modified")).not.toContain("Robin Example");
    act(() => root?.unmount());
    container?.remove();

    await openItem(itemOf());
    expect(detail("modified")).toBeTruthy();
    expect(detail("published")).toBe("Not live");
    expect(detail("modified-by")).toBeUndefined();
    expect(details()?.textContent).not.toContain("Modified by");
  });

  test("a read-only editor (no canEdit) shows the details and the dots; a new item shows no details", async () => {
    fake.getAccess.mockResolvedValue(
      access({ canEdit: false, canPublish: false })
    );
    await openItem(STAGED);
    expect(details()).not.toBeNull();
    expect(dotOn("cms-field-title")).toBe(true);
    act(() => root?.unmount());
    container?.remove();

    fake = createFakeCmsSource();
    await openNewItem();
    expect(details()).toBeNull();
  });

  test("a staged item shows a dot on each changed field and on Address, and it follows typing", async () => {
    await openItem(STAGED);
    expect(dotOn("cms-field-title")).toBe(true);
    expect(dotOn("cms-field-slug")).toBe(true);
    expect(dotOn("cms-field-summary")).toBe(false);
    await retype(input("cms-field-summary"), "Other");
    expect(dotOn("cms-field-summary")).toBe(true);
    await retype(titleInput(), "Hello");
    expect(dotOn("cms-field-title")).toBe(false);
    await retype(addressInput(), "hello");
    expect(dotOn("cms-field-slug")).toBe(false);
  });

  test("no dots on a draft, and none after Publish or Discard", async () => {
    await openItem(itemOf({ live: { slug: "x", data: { title: "Other" } } }));
    expect(
      document.querySelector('[aria-label="Changed since publish"]')
    ).toBeNull();
    act(() => root?.unmount());
    container?.remove();

    fake = createFakeCmsSource();
    fake.publishItem.mockResolvedValue({
      item: { ...STAGED, hasStagedChanges: false, live: null, updatedAt: V2 },
    });
    await openItem(STAGED);
    await click(buttonByText("Publish changes"));
    expect(
      document.querySelector('[aria-label="Changed since publish"]')
    ).toBeNull();
    act(() => root?.unmount());
    container?.remove();

    fake = createFakeCmsSource();
    fake.discardItemChanges.mockResolvedValue({
      item: {
        ...STAGED,
        ...STAGED.live!,
        hasStagedChanges: false,
        live: null,
        updatedAt: V2,
      },
    });
    await openItem(STAGED);
    await click(buttonByText("Discard changes"));
    await click(
      [
        ...document.querySelectorAll<HTMLButtonElement>(
          '[role="dialog"] button'
        ),
      ].find((button) => button.textContent === "Discard")
    );
    expect(
      document.querySelector('[aria-label="Changed since publish"]')
    ).toBeNull();
  });

  test("the first staged save sets the dots from the values it replaced", async () => {
    const published = itemOf({
      status: "published",
      data: { title: "Hello", summary: "Same", author: null },
      publishedAt: "2026-11-05T09:00:00+00:00",
    });
    fake.updateItem.mockImplementation(async (_c, id, body) => ({
      item: {
        ...published,
        id,
        data: body.data,
        hasStagedChanges: true,
        updatedAt: V2,
      },
    }));
    await openItem(published);
    expect(
      document.querySelector('[aria-label="Changed since publish"]')
    ).toBeNull();
    await retype(titleInput(), "Hello there");
    await click(buttonByText("Save"));
    expect(dotOn("cms-field-title")).toBe(true);
    expect(dotOn("cms-field-summary")).toBe(false);
    expect(dotOn("cms-field-slug")).toBe(false);
  });

  // Review Focus 3
  const KINDS: Record<
    string,
    { field: CmsCollection["fields"][number]; value: unknown }
  > = {
    richtext: {
      field: { key: "body", label: "Body", kind: "richtext" },
      value: { html: "<p>Hi</p>", text: "Hi" },
    },
    image: {
      field: { key: "cover", label: "Cover", kind: "image" },
      value: {
        url: "https://example.com/a.png",
        alt: "A",
        width: 10,
        height: 10,
      },
    },
    multireference: {
      field: {
        key: "tags",
        label: "Tags",
        kind: "multireference",
        reference: { collectionId: PEOPLE.id, multiple: true },
      },
      value: [ANN],
    },
    datetime: {
      field: { key: "starts", label: "Starts", kind: "datetime" },
      value: "2026-11-13T10:00:00.000Z",
    },
    switch: {
      field: { key: "online", label: "Online", kind: "switch" },
      value: true,
    },
    number: {
      field: { key: "seats", label: "Seats", kind: "number" },
      value: 3,
    },
  };

  test.each(Object.keys(KINDS))(
    "an untouched %s field equal to the live copy has no dot, on load and after a save of another field",
    async (kind) => {
      const { field, value } = KINDS[kind];
      setFields([POSTS_DETAIL.fields[0], field]);
      fake.searchItems.mockResolvedValue({
        items: [{ id: ANN, title: "Ann", status: "published" }],
      });
      const item = itemOf({
        status: "published",
        hasStagedChanges: true,
        data: { title: "Hello again", [field.key]: structuredClone(value) },
        live: {
          slug: "hello",
          data: { title: "Hello", [field.key]: structuredClone(value) },
        },
      });
      fake.updateItem.mockImplementation(async (_c, id, body) => ({
        item: { ...item, id, data: body.data, live: null, updatedAt: V2 },
      }));
      await openItem(item);
      const id = `cms-field-${field.key}`;
      expect(dotOn("cms-field-title")).toBe(true);
      expect(dotOn(id)).toBe(false);
      await retype(titleInput(), "Hello again!");
      await click(buttonByText("Save"));
      expect(fake.updateItem).toHaveBeenCalledTimes(1);
      expect(dotOn("cms-field-title")).toBe(true);
      expect(dotOn(id)).toBe(false);
    }
  );

  test("an edit, then an edit back to the live value, removes the dot", async () => {
    await openItem(STAGED);
    expect(dotOn("cms-field-summary")).toBe(false);
    await retype(input("cms-field-summary"), "Changed");
    expect(dotOn("cms-field-summary")).toBe(true);
    await retype(input("cms-field-summary"), "Same");
    expect(dotOn("cms-field-summary")).toBe(false);
  });
});

describe("multireference reordering in the editor (Task 21)", () => {
  test("a reorder makes the editor dirty and Save sends the new order", async () => {
    const BEA = "66666666-6666-4666-8666-666666666666";
    const CY = "77777777-7777-4777-8777-777777777777";
    setFields([
      POSTS_DETAIL.fields[0],
      {
        key: "tags",
        label: "Tags",
        kind: "multireference",
        reference: { collectionId: PEOPLE.id, multiple: true },
      },
    ]);
    fake.searchItems.mockImplementation(async (_c, query) => ({
      items: (query.ids ?? []).map((id) => ({
        id,
        title: { [ANN]: "Ann", [BEA]: "Bea", [CY]: "Cy" }[id] ?? "",
        status: "published" as const,
      })),
    }));
    const item = itemOf({ data: { title: "Hello", tags: [ANN, BEA, CY] } });
    fake.updateItem.mockImplementation(async (_c, id, body) => ({
      item: { ...item, id, data: body.data, updatedAt: V2 },
    }));
    await openItem(item);
    await vi.waitFor(() => expect(byLabel("Remove Cy")).not.toBeNull());
    expect(isDisabled("Save")).toBe(true);
    act(() => {
      document
        .querySelector<HTMLElement>(
          `[data-cms-reference="${ANN}"] [aria-label="Drag to reorder"]`
        )!
        .focus();
    });
    await act(async () => userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}"));
    await settle();
    expect($cmsNativeDirty.get()).toBe(true);
    expect(isDisabled("Save")).toBe(false);
    await click(buttonByText("Save"));
    expect(fake.updateItem).toHaveBeenCalledTimes(1);
    expect(fake.updateItem.mock.calls[0][2].data.tags).toEqual([BEA, ANN, CY]);
  });
});

describe("the Item menu waits for an upload (review)", () => {
  test("Unpublish, Archive and Restore are disabled while an upload is in flight", async () => {
    setFields([
      ...POSTS_DETAIL.fields,
      { key: "cover", label: "Cover", kind: "image" },
    ]);
    await openItem(
      itemOf({
        status: "published",
        data: { title: "Hello", summary: null, author: null, cover: null },
      })
    );
    const held = deferred<CmsResult<{ url: string; path: string }>>();
    fake.uploadImage.mockReturnValueOnce(held.promise);
    const file = document
      .querySelector<HTMLElement>('[data-cms-field="cms-field-cover"]')
      ?.querySelector<HTMLInputElement>('input[type="file"]');
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" })
    );
    await act(async () => {
      file!.files = transfer.files;
      file!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    await click(byLabel("Item menu"));
    for (const label of ["Unpublish", "Archive"]) {
      expect(menuItem(label)?.hasAttribute("data-disabled")).toBe(true);
    }
    await act(async () => {
      held.resolve({ url: "https://cdn.example.org/a.png", path: "a.png" });
    });
  });

  test("Restore is disabled while an upload is in flight", async () => {
    setFields([
      ...POSTS_DETAIL.fields,
      { key: "cover", label: "Cover", kind: "image" },
    ]);
    await openItem(
      itemOf({
        status: "archived",
        data: { title: "Hello", summary: null, author: null, cover: null },
      })
    );
    const held = deferred<CmsResult<{ url: string; path: string }>>();
    fake.uploadImage.mockReturnValueOnce(held.promise);
    const file = document
      .querySelector<HTMLElement>('[data-cms-field="cms-field-cover"]')
      ?.querySelector<HTMLInputElement>('input[type="file"]');
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" })
    );
    await act(async () => {
      file!.files = transfer.files;
      file!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    await click(byLabel("Item menu"));
    expect(menuItem("Restore")?.hasAttribute("data-disabled")).toBe(true);
    await act(async () => {
      held.resolve({ url: "https://cdn.example.org/a.png", path: "a.png" });
    });
  });
});

describe("the Item menu's actions (verification)", () => {
  const PUBLISHED = itemOf({ status: "published", updatedAt: VERSION });

  test("an edit typed after a failed read is kept by Retry, offered as Use my edit", async () => {
    fake.setItemsStatus.mockResolvedValue({ changed: [PUBLISHED.id] });
    await openItem(PUBLISHED);
    fake.getItem.mockResolvedValueOnce({ error: "unavailable" });
    await click(byLabel("Item menu"));
    await click(menuItem("Unpublish"));
    expect(hasText("Try again in a minute")).toBe(true);
    await retype(titleInput(), "Typed meanwhile");
    fake.getItem.mockResolvedValue({
      item: { ...PUBLISHED, status: "draft", updatedAt: V2 },
    });
    await click(buttonByText("Retry"));
    expect(hasText("Try again in a minute")).toBe(false);
    expect(chipText()).toBe("Draft");
    expect(byLabel("Use my edit: Title")).not.toBeNull();
    await click(byLabel("Use my edit: Title"));
    expect(titleInput()?.value).toBe("Typed meanwhile");
    expect($cmsNativeDirty.get()).toBe(true);
  });

  test("Cancel in the Delete dialog returns the focus to the Item menu", async () => {
    await openItem(PUBLISHED);
    await click(byLabel("Item menu"));
    await click(menuItem("Delete"));
    await click(dialogButton("Cancel"));
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(byLabel("Item menu"));
    });
  });

  test("a failed Delete returns the focus to the Item menu", async () => {
    fake.deleteItems.mockResolvedValue({ error: "forbidden" });
    await openItem(PUBLISHED);
    await click(byLabel("Item menu"));
    await click(menuItem("Delete"));
    await click(dialogButton("Delete"));
    expect(titleInput()).not.toBeNull();
    expect(document.activeElement).toBe(byLabel("Item menu"));
  });

  test("Delete answered 200 without the id closes the editor, clean", async () => {
    fake.deleteItems.mockResolvedValue({ deleted: [] });
    await openItem(PUBLISHED);
    await retype(titleInput(), "Edited");
    expect($cmsNativeDirty.get()).toBe(true);
    await click(byLabel("Item menu"));
    await click(menuItem("Delete"));
    await click(dialogButton("Delete"));
    expect(titleInput()).toBeNull();
    expect(hasText("Discard unsaved changes?")).toBe(false);
    expect($cmsNativeDirty.get()).toBe(false);
  });

  test.each([
    ["Archive", "unauthorized", "Signed out of OrganizeOS"],
    ["Archive", "mfa_required", "Two-step sign-in required"],
    ["Delete", "unauthorized", "Signed out of OrganizeOS"],
    ["Delete", "mfa_required", "Two-step sign-in required"],
  ] as const)(
    "%s answered %s shows the line, with no toast",
    async (label, code, text) => {
      const error = vi.spyOn(toast, "error");
      fake.setItemsStatus.mockResolvedValue({ error: code });
      fake.deleteItems.mockResolvedValue({ error: code });
      await openItem(PUBLISHED);
      await click(byLabel("Item menu"));
      await click(menuItem(label));
      if (label === "Delete") {
        await click(dialogButton("Delete"));
      }
      expect(hasText(text)).toBe(true);
      expect(error).not.toHaveBeenCalled();
    }
  );

  test("Back while Archive's E11 is in flight waits for it and the read after, then closes", async () => {
    const held = deferred<CmsResult<{ changed: string[] }>>();
    fake.setItemsStatus.mockReturnValue(held.promise);
    await openItem(PUBLISHED);
    await click(byLabel("Item menu"));
    await click(menuItem("Archive"));
    const reads = fake.getItem.mock.calls.length;
    fake.getItem.mockResolvedValue({
      item: { ...PUBLISHED, status: "archived", updatedAt: V2 },
    });
    await click(byLabel("Back"));
    // the editor stays while the status runs
    expect(titleInput()).not.toBeNull();
    await act(async () => held.resolve({ changed: [PUBLISHED.id] }));
    await settle();
    expect(fake.getItem.mock.calls.length).toBe(reads + 1);
    expect(titleInput()).toBeNull();
    expect(hasText("Discard unsaved changes?")).toBe(false);
    // opening the item again reads the version E11 left
    await click(
      document.querySelector<HTMLElement>(
        `[data-cms-item-id="${PUBLISHED.id}"]`
      )
    );
    expect(chipText()).toBe("Archived");
  });

  test("another collection chosen while Restore runs opens once it has ended", async () => {
    const held = deferred<CmsResult<{ changed: string[] }>>();
    fake.setItemsStatus.mockReturnValue(held.promise);
    const archived = itemOf({ status: "archived" });
    await openItem(archived);
    await click(byLabel("Item menu"));
    await click(menuItem("Restore"));
    await click(
      document.querySelector<HTMLElement>(
        `[data-cms-collection="${PEOPLE.slug}"]`
      )
    );
    expect(titleInput()).not.toBeNull();
    await act(async () => held.resolve({ changed: [archived.id] }));
    await settle();
    expect(titleInput()).toBeNull();
    expect(document.querySelector("[data-cms-collection][data-current]")).toBe(
      document.querySelector(`[data-cms-collection="${PEOPLE.slug}"]`)
    );
  });

  test("Back during Unpublish's save first asks nothing, and closes once the save, E11 and the read have landed", async () => {
    const saved = deferred<CmsResult<{ item: CmsItem }>>();
    fake.updateItem.mockReturnValue(saved.promise);
    fake.setItemsStatus.mockResolvedValue({ changed: [PUBLISHED.id] });
    await openItem(PUBLISHED);
    await retype(titleInput(), "Edited");
    await click(byLabel("Item menu"));
    await click(menuItem("Unpublish"));
    await click(byLabel("Back"));
    expect(hasText("Discard unsaved changes?")).toBe(false);
    expect(titleInput()).not.toBeNull();
    fake.getItem.mockResolvedValue({
      item: {
        ...PUBLISHED,
        status: "draft",
        data: { ...PUBLISHED.data, title: "Edited" },
        updatedAt: V3,
      },
    });
    await act(async () =>
      saved.resolve({
        item: {
          ...PUBLISHED,
          data: { ...PUBLISHED.data, title: "Edited" },
          updatedAt: V2,
        },
      })
    );
    await settle();
    expect(fake.setItemsStatus).toHaveBeenCalledTimes(1);
    expect(titleInput()).toBeNull();
    expect(hasText("Discard unsaved changes?")).toBe(false);
    expect($cmsNativeDirty.get()).toBe(false);
  });

  test("E11 answered slug_taken after the editor has gone toasts Address in use", async () => {
    const error = vi.spyOn(toast, "error");
    const held = deferred<CmsResult<{ changed: string[] }>>();
    fake.setItemsStatus.mockReturnValue(held.promise);
    await openItem(itemOf({ status: "archived" }));
    await click(byLabel("Item menu"));
    await click(menuItem("Restore"));
    act(() => root?.unmount());
    root = undefined;
    await act(async () => held.resolve({ error: "slug_taken" }));
    await settle();
    expect(error).toHaveBeenCalledWith("Address in use");
  });

  test("after Delete and a failed refetch, the focus stays where the person puts it", async () => {
    const other = itemOf({
      id: NEW_ID,
      slug: "other",
      data: { title: "Other", summary: null, author: null },
    });
    let answers = 0;
    fake.listItems.mockImplementation(async () => {
      answers += 1;
      return answers === 1
        ? itemsPageOf([rowOf(PUBLISHED), rowOf(other)], 2, 1)
        : { error: "rate_limited" };
    });
    fake.deleteItems.mockResolvedValue({ deleted: [PUBLISHED.id] });
    fake.getItem.mockResolvedValue({ item: PUBLISHED });
    mount();
    await settle();
    await click(
      document.querySelector<HTMLElement>(
        `[data-cms-item-id="${PUBLISHED.id}"]`
      )
    );
    await click(byLabel("Item menu"));
    await click(menuItem("Delete"));
    await click(dialogButton("Delete"));
    expect(document.activeElement).toBe(
      document.querySelector(`[data-cms-item-id="${NEW_ID}"]`)
    );
    const search = byLabel("Search Posts")!;
    const field = search.querySelector("input") ?? (search as HTMLElement);
    await act(async () => userEvent.click(field));
    await act(async () => userEvent.type(field, "x"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    await settle();
    expect(document.activeElement).toBe(field);
  });
});
