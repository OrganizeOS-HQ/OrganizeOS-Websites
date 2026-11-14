import { beforeEach, describe, expect, test, vi } from "vitest";

// OrganizeOS fork: Lists, Confirm by email and Notify (builder forms spec 9;
// plan 2026-11-13-builder-forms-fork-p2, Task 11). The forms come from F2;
// a change shows at once, is saved with F4 one after another per form, and
// reverts to the last saved value when its save fails.

const { listDoorForms, saveFormSettings, getFormsCatalog } = vi.hoisted(() => ({
  listDoorForms: vi.fn(),
  saveFormSettings: vi.fn(),
  getFormsCatalog: vi.fn(),
}));
vi.mock("./forms-api", () => ({
  listDoorForms,
  saveFormSettings,
  getFormsAccess: vi.fn(),
  getFormsCatalog,
}));

import {
  $doorForms,
  $formsCatalogs,
  $optInLocked,
  $unsavedForms,
  doorFormOf,
  formSettingsRowsOf,
  loadDoorForms,
  loadFormsCatalog,
  parseNotifyAddress,
  resetDoorForms,
  saveFormSetting,
} from "./form-settings";

const project = "project-1";
const form = {
  id: "form-1",
  title: "Home: Email & SMS updates",
  site: true,
  published: true,
  fields: [],
  opt_in: "single" as const,
  lists: [] as string[],
  notify: [] as string[],
};

const current = () =>
  doorFormOf($doorForms.get(), project, "contact-signup", "form-1");

beforeEach(() => {
  resetDoorForms();
  listDoorForms.mockReset();
  saveFormSettings.mockReset();
  getFormsCatalog.mockReset();
  listDoorForms.mockResolvedValue({ ok: true, value: [form] });
});

const deferred = <Value>() => {
  let resolve = (_value: Value) => {};
  const promise = new Promise<Value>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("loadDoorForms", () => {
  test("reads F2 once per project and kind", async () => {
    await loadDoorForms(project, "contact-signup");
    await loadDoorForms(project, "contact-signup");
    expect(listDoorForms).toHaveBeenCalledTimes(1);
    expect(listDoorForms).toHaveBeenCalledWith(project, "contact-signup");
    expect(current()).toEqual(form);
  });

  // final review M7
  test("a reload asked during a read reads again after it", async () => {
    const first = deferred<unknown>();
    listDoorForms.mockReturnValueOnce(first.promise);
    const reading = loadDoorForms(project, "contact-signup");
    const reloading = loadDoorForms(project, "contact-signup", {
      reload: true,
    });
    first.resolve({ ok: true, value: [] });
    await Promise.all([reading, reloading]);
    expect(listDoorForms).toHaveBeenCalledTimes(2);
    expect(current()).toEqual(form);
  });

  test("a failed read is read again next time", async () => {
    listDoorForms.mockResolvedValueOnce({ ok: false, error: "unavailable" });
    await loadDoorForms(project, "contact-signup");
    expect(current()).toBeUndefined();
    await loadDoorForms(project, "contact-signup");
    expect(current()).toEqual(form);
  });
});

describe("saveFormSetting", () => {
  test("a change shows at once, and stays once saved, so a remount shows it", async () => {
    await loadDoorForms(project, "contact-signup");
    saveFormSettings.mockResolvedValue({ ok: true, value: null });
    const saving = saveFormSetting(project, "contact-signup", "form-1", {
      optIn: "double",
    });
    expect(current()?.opt_in).toBe("double");
    expect(await saving).toBe("saved");
    expect(current()?.opt_in).toBe("double");
    expect(saveFormSettings).toHaveBeenCalledWith(project, "form-1", {
      optIn: "double",
    });
  });

  test("two quick changes are saved one after the other and end with both", async () => {
    await loadDoorForms(project, "contact-signup");
    const order: string[] = [];
    saveFormSettings.mockImplementation(async (_p, _f, body) => {
      order.push(JSON.stringify(body));
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true, value: null };
    });
    const first = saveFormSetting(project, "contact-signup", "form-1", {
      lists: ["a"],
    });
    const second = saveFormSetting(project, "contact-signup", "form-1", {
      lists: ["a", "b"],
    });
    expect(await Promise.all([first, second])).toEqual(["saved", "saved"]);
    expect(order).toEqual(['{"lists":["a"]}', '{"lists":["a","b"]}']);
    expect(current()?.lists).toEqual(["a", "b"]);
  });

  test("a failed save marks the form Not saved; the next success clears it", async () => {
    await loadDoorForms(project, "contact-signup");
    saveFormSettings.mockResolvedValueOnce({ ok: false, error: "unavailable" });
    await saveFormSetting(project, "contact-signup", "form-1", {
      lists: ["a"],
    });
    expect($unsavedForms.get().has("form-1")).toBe(true);
    saveFormSettings.mockResolvedValueOnce({ ok: true, value: null });
    await saveFormSetting(project, "contact-signup", "form-1", {
      lists: ["b"],
    });
    expect($unsavedForms.get().has("form-1")).toBe(false);
    expect(current()?.lists).toEqual(["b"]);
  });

  test("a read again keeps what a form with saves still queued shows", async () => {
    await loadDoorForms(project, "contact-signup");
    let finish = (_value: unknown) => {};
    saveFormSettings.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const saving = saveFormSetting(project, "contact-signup", "form-1", {
      lists: ["a"],
    });
    await loadDoorForms(project, "contact-signup", { reload: true });
    expect(current()?.lists).toEqual(["a"]);
    finish({ ok: true, value: null });
    expect(await saving).toBe("saved");
    expect(current()?.lists).toEqual(["a"]);
  });

  // final review I2
  test("a read sent before a save finished does not undo that save", async () => {
    await loadDoorForms(project, "contact-signup");
    const write = deferred<unknown>();
    saveFormSettings.mockReturnValueOnce(write.promise);
    const saving = saveFormSetting(project, "contact-signup", "form-1", {
      lists: ["a"],
    });
    const read = deferred<unknown>();
    listDoorForms.mockReturnValueOnce(read.promise);
    const reading = loadDoorForms(project, "contact-signup", { reload: true });
    write.resolve({ ok: true, value: null });
    expect(await saving).toBe("saved");
    // the read left before the write landed: it still holds no list
    read.resolve({ ok: true, value: [form] });
    await reading;
    expect(current()?.lists).toEqual(["a"]);
    // and the saved value it keeps is the one a failed write goes back to
    saveFormSettings.mockResolvedValueOnce({ ok: false, error: "unavailable" });
    await saveFormSetting(project, "contact-signup", "form-1", {
      lists: ["a", "b"],
    });
    expect(current()?.lists).toEqual(["a"]);
  });

  test("a failed save reverts to the last saved value", async () => {
    await loadDoorForms(project, "contact-signup");
    saveFormSettings.mockResolvedValueOnce({ ok: true, value: null });
    await saveFormSetting(project, "contact-signup", "form-1", {
      notify: ["a@example.org"],
    });
    saveFormSettings.mockResolvedValueOnce({ ok: false, error: "unavailable" });
    expect(
      await saveFormSetting(project, "contact-signup", "form-1", {
        notify: ["a@example.org", "b@example.org"],
      })
    ).toBe("failed");
    expect(current()?.notify).toEqual(["a@example.org"]);
  });

  test("the built-in form's opt-in is locked", async () => {
    await loadDoorForms(project, "contact-signup");
    saveFormSettings.mockResolvedValueOnce({ ok: false, error: "locked" });
    expect(
      await saveFormSetting(project, "contact-signup", "form-1", {
        optIn: "double",
      })
    ).toBe("locked");
    expect(current()?.opt_in).toBe("single");
    expect($optInLocked.get().has("form-1")).toBe(true);
    expect($unsavedForms.get().has("form-1")).toBe(false);
  });
});

describe("loadFormsCatalog", () => {
  // final review I1: the Fields list's locks need F1 at hand
  test("reads F1 once per project and kind, and again after a failure", async () => {
    const catalog = { fields: [], lists: [{ id: "l1", name: "List" }] };
    getFormsCatalog.mockResolvedValueOnce({ ok: false, error: "unavailable" });
    getFormsCatalog.mockResolvedValue({ ok: true, value: catalog });
    await loadFormsCatalog(project, "contact-form");
    expect($formsCatalogs.get().get(`${project}:contact-form`)).toBeUndefined();
    await loadFormsCatalog(project, "contact-form");
    await loadFormsCatalog(project, "contact-form");
    expect(getFormsCatalog).toHaveBeenCalledTimes(2);
    expect($formsCatalogs.get().get(`${project}:contact-form`)).toEqual(
      catalog
    );
  });
});

describe("formSettingsRowsOf", () => {
  test("the rows follow spec 9's table", () => {
    expect(formSettingsRowsOf("contact-signup")).toEqual({
      lists: true,
      confirm: true,
      notify: false,
    });
    expect(formSettingsRowsOf("contact-form")).toEqual({
      lists: true,
      confirm: false,
      notify: true,
    });
    expect(formSettingsRowsOf("membership")).toEqual({
      lists: false,
      confirm: false,
      notify: false,
    });
  });
});

describe("parseNotifyAddress", () => {
  test("takes a trimmed address of at most 254 characters", () => {
    expect(parseNotifyAddress("  staff@example.org ")).toBe(
      "staff@example.org"
    );
    expect(parseNotifyAddress("staff@example")).toBeUndefined();
    expect(parseNotifyAddress("staff example.org")).toBeUndefined();
    expect(parseNotifyAddress("a@b@example.org")).toBeUndefined();
    const local = "a".repeat(64);
    const domain = `${"b".repeat(185)}.org`;
    expect(parseNotifyAddress(`${local}@${domain}`)).toHaveLength(254);
    expect(parseNotifyAddress(`${local}@b${domain}`)).toBeUndefined();
  });
});
