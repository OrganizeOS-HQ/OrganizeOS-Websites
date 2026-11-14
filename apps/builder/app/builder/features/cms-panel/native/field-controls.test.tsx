// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { toast, TooltipProvider } from "@webstudio-is/design-system";
import { FieldControl, FieldRow } from "./field-controls";
import type { CmsField, CmsResult, CmsSearchResult } from "./cms-source";
import {
  createFakeCmsSource,
  itemOf,
  itemsPageOf,
  PEOPLE,
  rowOf,
  type FakeCmsSource,
} from "./fake-cms-source";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;
let fake: FakeCmsSource;

const ID = "cms-field-f";

type Spies = {
  onChange: ReturnType<typeof vi.fn<(value: unknown) => void>>;
  onBusyChange: ReturnType<typeof vi.fn<(busy: boolean) => void>>;
};

/**
 * One FieldRow and FieldControl, holding the value the control writes, as
 * the editor does, so typing builds on what was typed before.
 */
const Harness = ({
  field,
  initial,
  spies,
}: {
  field: CmsField;
  initial: unknown;
  spies: Spies;
}) => {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | undefined>(undefined);
  return createElement(FieldRow, {
    id: ID,
    label: field.label,
    help: field.help,
    required: field.required,
    inline: field.kind === "switch",
    error,
    children: createElement(FieldControl, {
      id: ID,
      field,
      value,
      source: fake,
      disabled: false,
      invalid: error !== undefined,
      remountKey: "1",
      onChange: (next: unknown) => {
        spies.onChange(next);
        setValue(next);
      },
      onError: setError,
      onBusyChange: spies.onBusyChange,
    }),
  });
};

const mountField = (field: CmsField, initial: unknown = null): Spies => {
  const spies: Spies = {
    onChange: vi.fn<(value: unknown) => void>(),
    onBusyChange: vi.fn<(busy: boolean) => void>(),
  };
  container = document.createElement("div");
  container.style.width = "448px";
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(Harness, { field, initial, spies })
      )
    );
  });
  return spies;
};

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

const control = () => document.querySelector<HTMLInputElement>(`#${ID}`);

const row = () =>
  document.querySelector<HTMLElement>(`[data-cms-field="${ID}"]`);

const byLabel = (label: string) =>
  document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

const buttonByText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === text
  );

const fieldError = () =>
  row()?.querySelector<HTMLElement>('[role="alert"]')?.textContent;

const options = () =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].map(
    (option) => option.textContent
  );

const optionByText = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (option) => option.textContent === text
  );

const lastValue = (spies: Spies) => spies.onChange.mock.lastCall?.[0];

const typeInto = async (element: HTMLElement | null, text: string) => {
  expect(element).not.toBeNull();
  await act(async () => userEvent.type(element!, text));
  await settle();
};

const clear = async (element: HTMLElement | null) => {
  expect(element).not.toBeNull();
  await act(async () => userEvent.clear(element!));
  await settle();
};

const fill = async (element: HTMLElement | null, text: string) => {
  expect(element).not.toBeNull();
  await act(async () => userEvent.fill(element!, text));
  await settle();
};

const click = async (element: HTMLElement | null | undefined) => {
  expect(element).toBeTruthy();
  await act(async () => userEvent.click(element!));
  await settle();
};

/** The file input's change, as choosing a file in the browser makes it. */
const chooseFile = async (file: File) => {
  const input = row()?.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).toBeTruthy();
  const transfer = new DataTransfer();
  transfer.items.add(file);
  await act(async () => {
    input!.files = transfer.files;
    input!.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
};

/** A PNG `width` by `height` pixels. */
const pngOf = async (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((result) => resolve(result!), "image/png")
  );
  return new File([blob], "a.png", { type: "image/png" });
};

const peopleRow = (id: string, title: string) =>
  rowOf(
    itemOf({
      id,
      slug: title.toLowerCase(),
      status: "published",
      data: { title },
      updatedAt: "2026-11-12T10:00:00+00:00",
    })
  );

const ANN = "55555555-5555-4555-8555-555555555555";
const BOB = "66666666-6666-4666-8666-666666666666";
const ANNABEL = "77777777-7777-4777-8777-777777777777";

const referenceField: CmsField = {
  key: "author",
  label: "Author",
  kind: "reference",
  reference: { collectionId: PEOPLE.id, multiple: false },
};

const multiReferenceField: CmsField = {
  key: "authors",
  label: "Authors",
  kind: "multireference",
  reference: { collectionId: PEOPLE.id, multiple: true },
};

const imageField: CmsField = { key: "cover", label: "Cover", kind: "image" };

beforeEach(() => {
  fake = createFakeCmsSource();
  fake.listItems.mockResolvedValue(
    itemsPageOf([peopleRow(ANN, "Ann"), peopleRow(BOB, "Bob")], 2, 1)
  );
  fake.searchItems.mockImplementation(async (_collectionId, query) => {
    const everyone: CmsSearchResult[] = [
      { id: ANN, title: "Ann", status: "published" },
      { id: BOB, title: "Bob", status: "published" },
      { id: ANNABEL, title: "Annabel", status: "published" },
    ];
    if (query.ids !== undefined) {
      return {
        items: everyone.filter((item) => query.ids?.includes(item.id)),
      };
    }
    // Annabel is past the first page: only E5 finds her
    return query.q === "ann"
      ? { items: [everyone[0], everyone[2]] }
      : { items: [] };
  });
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

describe("the text kinds", () => {
  test.each([
    ["text", 'input[type="text"]', { maxLength: 80 }, "80"],
    ["textarea", "textarea", { maxLength: 500 }, "500"],
    ["phone", 'input[type="tel"]', { maxLength: 20 }, "20"],
    ["link", 'input[type="url"]', {}, "2048"],
    ["email", 'input[type="email"]', {}, "320"],
  ] as const)(
    "%s is %s with maxLength %s",
    async (kind, selector, extra, maxLength) => {
      const spies = mountField({ key: "f", label: "F", kind, ...extra });
      const element = row()?.querySelector<HTMLElement>(selector);
      expect(element).toBeTruthy();
      expect(element?.id).toBe(ID);
      expect(element?.getAttribute("maxlength")).toBe(maxLength);
      await typeInto(element!, "abc");
      expect(lastValue(spies)).toBe("abc");
      await clear(element!);
      expect(lastValue(spies)).toBeNull();
    }
  );

  test("number writes a number, and null when empty", async () => {
    const spies = mountField({ key: "f", label: "F", kind: "number" });
    expect(control()?.type).toBe("number");
    await typeInto(control(), "12.5");
    expect(lastValue(spies)).toBe(12.5);
    await clear(control());
    expect(lastValue(spies)).toBeNull();
  });

  test("date writes YYYY-MM-DD, and null when empty", async () => {
    const spies = mountField({ key: "f", label: "F", kind: "date" });
    expect(control()?.type).toBe("date");
    await fill(control(), "2026-11-12");
    expect(lastValue(spies)).toBe("2026-11-12");
    await clear(control());
    expect(lastValue(spies)).toBeNull();
  });

  test("datetime writes an ISO timestamp from the local time, and reads one back", async () => {
    const spies = mountField({ key: "f", label: "F", kind: "datetime" });
    expect(control()?.type).toBe("datetime-local");
    await fill(control(), "2026-11-12T10:30");
    const iso = new Date("2026-11-12T10:30").toISOString();
    expect(lastValue(spies)).toBe(iso);
    act(() => {
      root?.unmount();
    });
    container?.remove();
    mountField({ key: "f", label: "F", kind: "datetime" }, iso);
    expect(control()?.value).toBe("2026-11-12T10:30");
  });

  test("switch writes true and false, and reads null as false", async () => {
    const spies = mountField({ key: "f", label: "F", kind: "switch" }, null);
    const element = control()!;
    expect(element.getAttribute("role")).toBe("switch");
    expect(element.getAttribute("aria-checked")).toBe("false");
    await click(element);
    expect(lastValue(spies)).toBe(true);
    await click(element);
    expect(lastValue(spies)).toBe(false);
    expect(spies.onChange).not.toHaveBeenCalledWith(null);
  });

  test("color is an InputField with the #RRGGBB pattern and placeholder, with no swatch", async () => {
    const spies = mountField({ key: "f", label: "F", kind: "color" });
    const element = control()!;
    expect(element.tagName).toBe("INPUT");
    expect(element.getAttribute("placeholder")).toBe("#RRGGBB");
    expect(element.getAttribute("pattern")).toBe("^#[0-9a-fA-F]{6}$");
    await typeInto(element, "#112233");
    expect(lastValue(spies)).toBe("#112233");
    const swatch = [...row()!.querySelectorAll<HTMLElement>("*")].some(
      (child) => getComputedStyle(child).backgroundColor === "rgb(17, 34, 51)"
    );
    expect(swatch).toBe(false);
    await clear(element);
    expect(lastValue(spies)).toBeNull();
  });

  test("option is a Select of the labels that writes the value, placeholder Choose", async () => {
    const spies = mountField({
      key: "f",
      label: "F",
      kind: "option",
      options: [
        { value: "red", label: "Red team" },
        { value: "blue", label: "Blue team" },
      ],
    });
    const trigger = control()!;
    expect(trigger.textContent).toBe("Choose");
    await click(trigger);
    expect(options()).toEqual(
      expect.arrayContaining(["Red team", "Blue team"])
    );
    await click(optionByText("Blue team"));
    expect(lastValue(spies)).toBe("blue");
    expect(control()?.textContent).toBe("Blue team");
  });
});

describe("references", () => {
  test("reference lists the target's first page before a term, searches E5 with one, and writes the id; Clear writes null", async () => {
    const spies = mountField(referenceField);
    const input = control()!;
    expect(input.getAttribute("placeholder")).toBe("Choose an item");
    await click(input);
    await vi.waitFor(() => expect(options()).toEqual(["Ann", "Bob"]));
    expect(fake.listItems).toHaveBeenCalledWith(PEOPLE.id, { page: 1 });
    expect(fake.searchItems).not.toHaveBeenCalledWith(
      PEOPLE.id,
      expect.objectContaining({ q: expect.anything() })
    );
    await typeInto(input, "ann");
    await vi.waitFor(() =>
      expect(fake.searchItems).toHaveBeenCalledWith(PEOPLE.id, { q: "ann" })
    );
    // E5's matches, Annabel among them though she is past the first page
    await vi.waitFor(() => expect(options()).toEqual(["Ann", "Annabel"]));
    await click(optionByText("Annabel"));
    await vi.waitFor(() => expect(lastValue(spies)).toBe(ANNABEL));
    expect(control()?.value).toBe("Annabel");
    await click(byLabel("Clear"));
    expect(lastValue(spies)).toBeNull();
  });

  test("multireference keeps the order, adds and removes, and is [] when empty, never null", async () => {
    const spies = mountField(multiReferenceField, [BOB]);
    await vi.waitFor(() => expect(byLabel("Remove Bob")).not.toBeNull());
    const input = control()!;
    expect(input.getAttribute("placeholder")).toBe("Add an item");
    await click(input);
    // a chosen item is not offered again
    await vi.waitFor(() => expect(options()).toEqual(["Ann"]));
    await click(optionByText("Ann"));
    await vi.waitFor(() => expect(lastValue(spies)).toEqual([BOB, ANN]));
    await click(byLabel("Remove Bob"));
    expect(lastValue(spies)).toEqual([ANN]);
    await vi.waitFor(() => expect(byLabel("Remove Ann")).not.toBeNull());
    await click(byLabel("Remove Ann"));
    expect(lastValue(spies)).toEqual([]);
    expect(spies.onChange).not.toHaveBeenCalledWith(null);
  });

  test("multireference reads 150 chosen titles in two E5 calls of 100 and 50", async () => {
    const ids = Array.from(
      { length: 150 },
      (_, index) => `88888888-8888-4888-8888-${String(index).padStart(12, "0")}`
    );
    fake.searchItems.mockImplementation(async (_collectionId, query) => ({
      items: (query.ids ?? []).map((id) => ({
        id,
        title: `T${id.slice(-3)}`,
        status: "published" as const,
      })),
    }));
    mountField(multiReferenceField, ids);
    await settle();
    const byIds = fake.searchItems.mock.calls.filter(
      ([, query]) => query.ids !== undefined
    );
    expect(byIds.map(([collectionId]) => collectionId)).toEqual([
      PEOPLE.id,
      PEOPLE.id,
    ]);
    expect(byIds.map(([, query]) => query.ids?.length)).toEqual([100, 50]);
    expect(byIds.flatMap(([, query]) => query.ids)).toEqual(ids);
    await vi.waitFor(() => expect(byLabel("Remove T149")).not.toBeNull());
  });
});

describe("the image", () => {
  test("image: Choose uploads through E9 and writes { url, alt, width, height, path }", async () => {
    fake.uploadImage.mockResolvedValue({
      url: "https://cdn.example.org/a.png",
      path: "org/a.png",
    });
    const spies = mountField(imageField);
    expect(buttonByText("Choose")).toBeTruthy();
    const file = await pngOf(2, 3);
    await chooseFile(file);
    expect(fake.uploadImage).toHaveBeenCalledWith(file);
    await vi.waitFor(() =>
      expect(lastValue(spies)).toEqual({
        url: "https://cdn.example.org/a.png",
        alt: "",
        width: 2,
        height: 3,
        path: "org/a.png",
      })
    );
    const alt = document.querySelector<HTMLInputElement>(`#${ID}-alt`);
    await typeInto(alt, "A");
    expect(lastValue(spies)).toEqual(expect.objectContaining({ alt: "A" }));
    await click(byLabel("Remove"));
    expect(lastValue(spies)).toBeNull();
  });

  test.each([
    [
      "a GIF over 4 MB",
      () =>
        new File([new Uint8Array(4 * 1024 * 1024 + 1)], "a.gif", {
          type: "image/gif",
        }),
      "Over 4 MB",
    ],
    [
      "a text file",
      () => new File(["hello"], "a.txt", { type: "text/plain" }),
      "Not an image",
    ],
  ])("image refuses %s before uploading: %s", async (_name, make, text) => {
    const spies = mountField(imageField);
    await chooseFile(make());
    expect(fieldError()).toBe(text);
    expect(fake.uploadImage).not.toHaveBeenCalled();
    expect(spies.onChange).not.toHaveBeenCalled();
  });

  test.each(["unavailable", "rate_limited"] as const)(
    "image whose upload is answered %s shows Not uploaded and writes nothing",
    async (error) => {
      fake.uploadImage.mockResolvedValue({ error });
      const spies = mountField(imageField);
      await chooseFile(await pngOf(2, 3));
      await vi.waitFor(() => expect(fieldError()).toBe("Not uploaded"));
      expect(spies.onChange).not.toHaveBeenCalled();
    }
  );

  test.each([
    ["forbidden", "No access"],
    ["plan", "Not in plan"],
  ] as const)(
    "image whose upload is answered %s is the write toast %s, with no field error",
    async (code, text) => {
      const error = vi.spyOn(toast, "error");
      fake.uploadImage.mockResolvedValue({ error: code });
      const spies = mountField(imageField);
      await chooseFile(await pngOf(2, 3));
      await vi.waitFor(() => expect(error).toHaveBeenCalledWith(text));
      expect(fieldError()).toBeUndefined();
      expect(spies.onChange).not.toHaveBeenCalled();
    }
  );

  test("image reports busy while E9 is in flight", async () => {
    const held = deferred<CmsResult<{ url: string; path: string }>>();
    fake.uploadImage.mockReturnValue(held.promise);
    const spies = mountField(imageField);
    await chooseFile(await pngOf(2, 3));
    expect(spies.onBusyChange.mock.calls).toEqual([[true]]);
    await act(async () => {
      held.resolve({ url: "https://cdn.example.org/a.png", path: "a.png" });
    });
    await vi.waitFor(() =>
      expect(spies.onBusyChange.mock.calls).toEqual([[true], [false]])
    );
    await vi.waitFor(() =>
      expect(lastValue(spies)).toEqual(
        expect.objectContaining({ url: "https://cdn.example.org/a.png" })
      )
    );
  });

  test("image disables Alt and Remove while E9 is in flight", async () => {
    const held = deferred<CmsResult<{ url: string; path: string }>>();
    fake.uploadImage.mockReturnValue(held.promise);
    mountField(imageField, {
      url: "https://cdn.example.org/old.png",
      alt: "Old",
      width: 1,
      height: 1,
    });
    const alt = () => document.querySelector<HTMLInputElement>(`#${ID}-alt`);
    expect(alt()?.disabled).toBe(false);
    expect((byLabel("Remove") as HTMLButtonElement).disabled).toBe(false);
    await chooseFile(await pngOf(2, 3));
    expect(alt()?.disabled).toBe(true);
    expect((byLabel("Remove") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      held.resolve({ url: "https://cdn.example.org/a.png", path: "a.png" });
    });
    await vi.waitFor(() => expect(alt()?.disabled).toBe(false));
    expect((byLabel("Remove") as HTMLButtonElement).disabled).toBe(false);
  });

  test("image keeps a Lite-era bare URL until replaced", async () => {
    const spies = mountField(imageField, "https://x/a.png");
    await settle();
    expect(row()?.querySelector("img")?.getAttribute("src")).toBe(
      "https://x/a.png"
    );
    expect(spies.onChange).not.toHaveBeenCalled();
  });
});

describe("labels", () => {
  test("a label is a Label, the org's help in its tooltip and never under the field, and a required one ends with *", async () => {
    mountField({
      key: "f",
      label: "Title",
      kind: "text",
      required: true,
      help: "Shown on the card",
    });
    const label = row()?.querySelector<HTMLLabelElement>("label");
    expect(label?.textContent).toBe("Title *");
    expect(label?.htmlFor).toBe(ID);
    expect(row()?.textContent?.includes("Shown on the card")).toBe(false);
    await act(async () => userEvent.hover(label!));
    await vi.waitFor(
      () => {
        const tooltip = document.querySelector('[role="tooltip"]');
        expect(tooltip?.textContent).toContain("Shown on the card");
      },
      { timeout: 3000 }
    );
    expect(row()?.textContent?.includes("Shown on the card")).toBe(false);
  });

  test("a label without help or required is the label alone", () => {
    mountField({ key: "f", label: "Summary", kind: "text" });
    const label = row()?.querySelector<HTMLLabelElement>("label");
    expect(label?.textContent).toBe("Summary");
  });
});

describe("the changed-since-publish dot (Task 20)", () => {
  const mountRow = (changed: boolean | undefined, help?: string) => {
    container = document.createElement("div");
    container.style.width = "448px";
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        createElement(
          TooltipProvider,
          null,
          createElement(FieldRow, {
            id: ID,
            label: "Title",
            help,
            changed,
            children: createElement("input", { id: ID }),
          })
        )
      );
    });
  };

  test("FieldRow with changed draws the dot with its name and tooltip", async () => {
    mountRow(true);
    const dot = row()?.querySelector<HTMLElement>(
      '[role="img"][aria-label="Changed since publish"]'
    );
    expect(dot).not.toBeNull();
    const box = dot!.getBoundingClientRect();
    expect([box.width, box.height]).toEqual([6, 6]);
    expect(getComputedStyle(dot!).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    await act(async () => userEvent.hover(dot!));
    await vi.waitFor(
      () => {
        const tooltip = document.querySelector('[role="tooltip"]');
        expect(tooltip?.textContent).toContain("Changed since publish");
      },
      { timeout: 3000 }
    );
  });

  test.each([false, undefined])(
    "FieldRow with changed %s draws none",
    (changed) => {
      mountRow(changed);
      expect(
        row()?.querySelector('[aria-label="Changed since publish"]')
      ).toBeNull();
    }
  );
});

describe("multireference reordering (Task 21)", () => {
  const referenceRow = (id: string) =>
    document.querySelector<HTMLElement>(`[data-cms-reference="${id}"]`)!;
  const handleOf = (id: string) =>
    referenceRow(id).querySelector<HTMLElement>(
      '[aria-label="Drag to reorder"]'
    );
  const pointer = (target: EventTarget, type: string, x: number, y: number) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
        pointerId: 1,
        isPrimary: true,
        clientX: x,
        clientY: y,
      })
    );

  test("a multireference item moves by drop and by Alt+Arrow", async () => {
    let spies = mountField(multiReferenceField, [ANN, BOB, ANNABEL]);
    await vi.waitFor(() => expect(byLabel("Remove Annabel")).not.toBeNull());
    // Alt+Arrow from the handle; the focus stays on the moved row's handle
    act(() => {
      handleOf(ANN)!.focus();
    });
    await act(async () => userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}"));
    await settle();
    expect(lastValue(spies)).toEqual([BOB, ANN, ANNABEL]);
    expect(document.activeElement).toBe(handleOf(ANN));
    // and from the remove button
    act(() => {
      byLabel("Remove Annabel")!.focus();
    });
    await act(async () => userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}"));
    await settle();
    expect(lastValue(spies)).toEqual([BOB, ANNABEL, ANN]);
    expect(document.activeElement).toBe(byLabel("Remove Annabel"));
    act(() => {
      root?.unmount();
    });
    container?.remove();

    // a pointer drop of Ann below Bob
    spies = mountField(multiReferenceField, [ANN, BOB, ANNABEL]);
    await vi.waitFor(() => expect(byLabel("Remove Annabel")).not.toBeNull());
    const handle = handleOf(ANN)!;
    const start = handle.getBoundingClientRect();
    const x = start.left + start.width / 2;
    const target = referenceRow(BOB).getBoundingClientRect();
    act(() => {
      pointer(handle, "pointerdown", x, start.top + start.height / 2);
    });
    for (const y of [
      start.top + start.height / 2 + 6,
      target.top + target.height * 0.5,
      target.top + target.height * 0.9,
    ]) {
      act(() => {
        pointer(window, "pointermove", x, y);
      });
      await settle();
    }
    act(() => {
      pointer(window, "pointerup", x, target.top + target.height * 0.9);
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle();
    expect(lastValue(spies)).toEqual([BOB, ANN, ANNABEL]);
  });

  test("no handles when read-only", async () => {
    container = document.createElement("div");
    container.style.width = "448px";
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        createElement(
          TooltipProvider,
          null,
          createElement(FieldControl, {
            id: ID,
            field: multiReferenceField,
            value: [ANN, BOB],
            source: fake,
            disabled: true,
            invalid: false,
            remountKey: "1",
            onChange: vi.fn(),
            onError: vi.fn(),
            onBusyChange: vi.fn(),
          })
        )
      );
    });
    await settle();
    expect(
      document.querySelector(`[data-cms-reference="${ANN}"]`)
    ).not.toBeNull();
    expect(document.querySelector('[aria-label="Drag to reorder"]')).toBeNull();
  });
});
