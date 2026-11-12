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
  fake.listItems.mockResolvedValue({
    items: [rowOf(item)],
    total: 1,
    page: 1,
  });
  fake.getItem.mockResolvedValue({ item });
  mount(width);
  await settle();
  await click(
    document.querySelector<HTMLElement>(`[data-cms-item-id="${item.id}"]`)
  );
  expect(titleInput()).not.toBeNull();
};

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
    ],
    [{ error: "slug_taken" }, "Address", "cms-field-slug", "Address in use"],
    [
      { error: "reference_invalid", field: "author" },
      "Author",
      "cms-field-author",
      "Item not found",
    ],
  ] as const)("%o shows under %s: %s", async (failure, _label, id, text) => {
    const error = vi.spyOn(toast, "error");
    await openItem();
    await retype(titleInput(), "Mine");
    fake.updateItem.mockResolvedValueOnce(failure);
    await click(buttonByText("Save"));
    expect(fieldError(id)).toBe(text);
    expect(error).not.toHaveBeenCalled();
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

  test("below 600 px of header, Discard changes is in the Item menu", async () => {
    const staged = itemOf({ status: "published", hasStagedChanges: true });
    // a 560 px main
    await openItem(staged, 800);
    expect(header()!.getBoundingClientRect().width).toBeLessThan(600);
    expect(buttonByText("Discard changes")).toBeUndefined();
    const trigger = byLabel("Item menu");
    expect(trigger).not.toBeNull();
    await click(trigger);
    const item = [
      ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].find((element) => element.textContent === "Discard changes");
    expect(item).toBeDefined();
    await click(item);
    expect(hasText("Discard staged changes?")).toBe(true);
    act(() => root?.unmount());
    container?.remove();

    // an 800 px main
    await openItem(staged, 1040);
    expect(buttonByText("Discard changes")).toBeDefined();
    expect(byLabel("Item menu")).toBeNull();
    act(() => root?.unmount());
    container?.remove();

    // a draft has neither, at either width
    for (const width of [800, 1040]) {
      await openItem(itemOf(), width);
      expect(buttonByText("Discard changes")).toBeUndefined();
      expect(byLabel("Item menu")).toBeNull();
      act(() => root?.unmount());
      container?.remove();
    }
  });
});
