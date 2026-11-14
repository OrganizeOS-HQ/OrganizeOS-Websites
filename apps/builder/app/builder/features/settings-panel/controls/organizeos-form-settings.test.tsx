import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { Project } from "@webstudio-is/project";
import { $project } from "~/shared/sync/data-stores";
import { serverSyncStore } from "~/shared/sync/sync-stores";

// OrganizeOS fork: Lists, Confirm by email and Notify (builder forms spec 9;
// plan 2026-11-13-builder-forms-fork-p2, Task 11).

const { listDoorForms, saveFormSettings, getFormsAccess, getFormsCatalog } =
  vi.hoisted(() => ({
    listDoorForms: vi.fn(),
    saveFormSettings: vi.fn(),
    getFormsAccess: vi.fn(),
    getFormsCatalog: vi.fn(),
  }));
vi.mock("~/builder/features/organizeos-panel/forms-api", () => ({
  listDoorForms,
  saveFormSettings,
  getFormsAccess,
  getFormsCatalog,
}));

import { resetDoorForms } from "~/builder/features/organizeos-panel/form-settings";
import { FormSettingsRows } from "./organizeos-form-settings";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const orgLists = Array.from({ length: 12 }, (_, index) => ({
  id: `list-${index + 1}`,
  name: `List ${index + 1}`,
}));

const updates = {
  id: "form-updates",
  title: "Home: Email & SMS updates",
  site: true,
  published: true,
  fields: [],
  opt_in: "single" as const,
  lists: ["list-1"],
  notify: [] as string[],
};
const contact = {
  id: "form-contact",
  title: "Contact: Contact us",
  site: true,
  published: true,
  fields: [],
  opt_in: "single" as const,
  lists: [] as string[],
  notify: ["staff@example.org"],
};

let root: Root | undefined;
let container: HTMLElement | undefined;

const settle = () =>
  act(async () => {
    for (let turn = 0; turn < 5; turn += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });

type Rows = Parameters<typeof FormSettingsRows>[0];

const render = async (rows: Rows[], width = 240) => {
  container = document.createElement("div");
  container.style.width = `${width}px`;
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(
          Fragment,
          null,
          ...rows.map((props, index) =>
            createElement(
              "div",
              { key: index, "data-rows": index },
              createElement(FormSettingsRows, props)
            )
          )
        )
      )
    )
  );
  await settle();
  return container;
};

const unmount = () => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
};

const chips = (host: Element) =>
  Array.from(host.querySelectorAll("[data-form-setting-chip]"), (chip) =>
    chip.getAttribute("data-form-setting-chip")
  );

const labels = (host: Element) =>
  Array.from(host.querySelectorAll("label"), (label) => label.textContent);

const setAccess = (canEditPrivate: boolean) =>
  getFormsAccess.mockResolvedValue({
    ok: true,
    value: { orgName: "Org", canEditPrivate, smsAvailable: false },
  });

beforeEach(() => {
  resetDoorForms();
  $project.set({ id: "project-1" } as Project);
  serverSyncStore.transactionManager.currentStack = [];
  serverSyncStore.transactionManager.undoneStack = [];
  listDoorForms.mockReset();
  saveFormSettings.mockReset();
  getFormsAccess.mockReset();
  getFormsCatalog.mockReset();
  listDoorForms.mockImplementation(async (_project, kind) => ({
    ok: true,
    value: kind === "contact-signup" ? [updates] : [contact],
  }));
  getFormsCatalog.mockResolvedValue({
    ok: true,
    value: { fields: [], lists: orgLists },
  });
  setAccess(true);
  saveFormSettings.mockResolvedValue({ ok: true, value: null });
});

afterEach(unmount);

describe("FormSettingsRows", () => {
  test("the rows follow spec 9: Lists and Confirm on updates, Lists and Notify on Contact us, none on Member signup or with no form", async () => {
    let host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
      { part: "after-submit", kind: "contact-signup", record: updates.id },
    ]);
    expect(labels(host)).toEqual(["Lists", "Confirm by email"]);
    unmount();

    host = await render([
      { part: "fields", kind: "contact-form", record: contact.id },
      { part: "after-submit", kind: "contact-form", record: contact.id },
    ]);
    expect(labels(host)).toEqual(["Lists", "Notify"]);
    unmount();

    host = await render([
      { part: "fields", kind: "membership", record: "member-form" },
      { part: "after-submit", kind: "membership", record: "member-form" },
      { part: "fields", kind: "contact-signup", record: "" },
    ]);
    expect(labels(host)).toEqual([]);
  });

  test("Lists: chips with remove, and + adds one of the org's lists, each change sending the full set", async () => {
    const host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
    ]);
    expect(chips(host)).toEqual(["List 1"]);
    await userEvent.click(
      host.querySelector('button[aria-label="Add list"]') as HTMLElement
    );
    const item = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ).find((candidate) => candidate.textContent === "List 3");
    expect(item).toBeDefined();
    await act(async () => item?.click());
    await settle();
    expect(saveFormSettings).toHaveBeenLastCalledWith("project-1", updates.id, {
      lists: ["list-1", "list-3"],
    });
    expect(chips(host)).toEqual(["List 1", "List 3"]);

    await act(async () =>
      host
        .querySelector<HTMLButtonElement>('button[aria-label="Remove List 1"]')
        ?.click()
    );
    await settle();
    expect(saveFormSettings).toHaveBeenLastCalledWith("project-1", updates.id, {
      lists: ["list-3"],
    });
    expect(chips(host)).toEqual(["List 3"]);
  });

  test("+ is disabled at 10 lists", async () => {
    listDoorForms.mockResolvedValue({
      ok: true,
      value: [{ ...updates, lists: orgLists.slice(0, 10).map(({ id }) => id) }],
    });
    const host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
    ]);
    expect(chips(host)).toHaveLength(10);
    expect(
      host.querySelector<HTMLButtonElement>('button[aria-label="Add list"]')
        ?.disabled
    ).toBe(true);
  });

  test("Confirm by email is a switch writing optIn", async () => {
    const host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
    ]);
    const toggle = host.querySelector<HTMLButtonElement>('[role="switch"]');
    expect(toggle?.getAttribute("aria-checked")).toBe("false");
    await act(async () => toggle?.click());
    await settle();
    expect(saveFormSettings).toHaveBeenLastCalledWith("project-1", updates.id, {
      optIn: "double",
    });
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
  });

  test("Notify: Add email takes a valid address on Enter, and is disabled at 20", async () => {
    const host = await render([
      { part: "after-submit", kind: "contact-form", record: contact.id },
    ]);
    expect(chips(host)).toEqual(["staff@example.org"]);
    const input = host.querySelector<HTMLInputElement>(
      'input[aria-label="Add email"]'
    ) as HTMLInputElement;
    await userEvent.type(input, "not an address{Enter}");
    await settle();
    expect(saveFormSettings).not.toHaveBeenCalled();
    expect(
      input.closest("[data-color=error], input[data-color=error]")
    ).not.toBeNull();

    await userEvent.clear(input);
    await userEvent.type(input, "  desk@example.org {Enter}");
    await settle();
    expect(saveFormSettings).toHaveBeenLastCalledWith("project-1", contact.id, {
      notify: ["staff@example.org", "desk@example.org"],
    });
    expect(input.value).toBe("");
    expect(chips(host)).toEqual(["staff@example.org", "desk@example.org"]);

    // an address over 254 characters is not taken
    await userEvent.type(
      input,
      `${"a".repeat(64)}@${"b".repeat(186)}.org{Enter}`
    );
    await settle();
    expect(saveFormSettings).toHaveBeenCalledTimes(1);
    unmount();

    listDoorForms.mockResolvedValue({
      ok: true,
      value: [
        {
          ...contact,
          notify: Array.from(
            { length: 20 },
            (_, index) => `s${index}@example.org`
          ),
        },
      ],
    });
    resetDoorForms();
    const full = await render([
      { part: "after-submit", kind: "contact-form", record: contact.id },
    ]);
    expect(
      full.querySelector<HTMLInputElement>('input[aria-label="Add email"]')
        ?.disabled
    ).toBe(true);
  });

  test("without canEditPrivate, Lists and Notify have no remove and no add; Confirm by email stays editable", async () => {
    setAccess(false);
    const host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
      { part: "after-submit", kind: "contact-form", record: contact.id },
    ]);
    expect(chips(host)).toEqual(["List 1", "staff@example.org"]);
    expect(host.querySelector('button[aria-label^="Remove"]')).toBeNull();
    expect(host.querySelector('button[aria-label="Add list"]')).toBeNull();
    expect(host.querySelector('input[aria-label="Add email"]')).toBeNull();
    expect(
      host.querySelector<HTMLButtonElement>('[role="switch"]')?.disabled
    ).toBe(false);
  });

  test("a saved change stays in the store, so a remount shows it", async () => {
    let host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
    ]);
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[role="switch"]')?.click()
    );
    await settle();
    unmount();
    host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
    ]);
    expect(listDoorForms).toHaveBeenCalledTimes(1);
    expect(
      host.querySelector('[role="switch"]')?.getAttribute("aria-checked")
    ).toBe("true");
  });

  test("two quick changes are saved one after the other and end with both", async () => {
    const bodies: unknown[] = [];
    saveFormSettings.mockImplementation(async (_project, _form, body) => {
      bodies.push(body);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true, value: null };
    });
    const host = await render([
      { part: "after-submit", kind: "contact-form", record: contact.id },
    ]);
    const input = host.querySelector<HTMLInputElement>(
      'input[aria-label="Add email"]'
    ) as HTMLInputElement;
    await userEvent.type(input, "a@example.org{Enter}");
    await userEvent.type(input, "b@example.org{Enter}");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    expect(bodies).toEqual([
      { notify: ["staff@example.org", "a@example.org"] },
      { notify: ["staff@example.org", "a@example.org", "b@example.org"] },
    ]);
    expect(chips(host)).toEqual([
      "staff@example.org",
      "a@example.org",
      "b@example.org",
    ]);
  });

  test("two roots on one form show the same set", async () => {
    const host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
      { part: "fields", kind: "contact-signup", record: updates.id },
    ]);
    const [first, second] = Array.from(host.querySelectorAll("[data-rows]"));
    await act(async () =>
      first
        .querySelector<HTMLButtonElement>('button[aria-label="Remove List 1"]')
        ?.click()
    );
    await settle();
    expect(chips(first)).toEqual([]);
    expect(chips(second)).toEqual([]);
  });

  test("a failed save reverts the row", async () => {
    saveFormSettings.mockResolvedValueOnce({ ok: false, error: "unavailable" });
    const host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
    ]);
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>('button[aria-label="Remove List 1"]')
        ?.click()
    );
    await settle();
    expect(chips(host)).toEqual(["List 1"]);
  });

  test("a write is not in the builder's undo", async () => {
    const host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
    ]);
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[role="switch"]')?.click()
    );
    await settle();
    expect(saveFormSettings).toHaveBeenCalledTimes(1);
    expect(serverSyncStore.transactionManager.currentStack).toHaveLength(0);
  });

  test("the built-in form (locked) shows Confirm by email disabled", async () => {
    saveFormSettings.mockResolvedValueOnce({ ok: false, error: "locked" });
    const host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
    ]);
    const toggle = host.querySelector<HTMLButtonElement>('[role="switch"]');
    await act(async () => toggle?.click());
    await settle();
    expect(toggle?.getAttribute("aria-checked")).toBe("false");
    expect(toggle?.disabled).toBe(true);
  });

  test("a form made since F2 was read is read again once", async () => {
    listDoorForms.mockResolvedValueOnce({ ok: true, value: [] });
    const host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
    ]);
    expect(listDoorForms).toHaveBeenCalledTimes(2);
    expect(chips(host)).toEqual(["List 1"]);
  });

  test("no row is wider than a 240px panel: chips wrap and a long address truncates", async () => {
    const long = `${"long-staff-address".repeat(4)}@example.org`;
    listDoorForms.mockImplementation(async (_project, kind) => ({
      ok: true,
      value:
        kind === "contact-signup"
          ? [{ ...updates, lists: orgLists.slice(0, 8).map(({ id }) => id) }]
          : [{ ...contact, notify: [long, "staff@example.org"] }],
    }));
    const host = await render([
      { part: "fields", kind: "contact-signup", record: updates.id },
      { part: "after-submit", kind: "contact-form", record: contact.id },
    ]);
    const { right } = host.getBoundingClientRect();
    const overflowing = Array.from(host.querySelectorAll("*")).filter(
      (element) => element.getBoundingClientRect().right > right + 0.5
    );
    expect(
      overflowing.map((element) => element.outerHTML.slice(0, 80))
    ).toEqual([]);
  });
});
