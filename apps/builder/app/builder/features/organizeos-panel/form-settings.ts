import { atom } from "nanostores";
import {
  getFormsAccess,
  getFormsCatalog,
  listDoorForms,
  saveFormSettings,
  type DoorForm,
  type FormSettingsBody,
  type FormsAccess,
  type FormsCatalog,
  type FormsKind,
} from "./forms-api";

/**
 * OrganizeOS fork: the forms of a kind as OrganizeOS's forms door lists them
 * (F2), and the Settings panel's writes to a form's Lists, Confirm by email
 * and Notify (F4) (docs/ORGANIZEOS-FORK.md section 9, "Site forms"; builder
 * forms spec 9). These are platform writes, not build edits: not in the
 * builder's undo, written at once. A change shows at once; a form's saves run
 * one after another, each sending the set as it then stands; a failed save
 * puts back the last saved value and marks the form "Not saved" until its
 * next save succeeds.
 */

/** Lists and Notify hold at most this many (the door's limits). */
export const FORM_LISTS_LIMIT = 10;
export const FORM_NOTIFY_LIMIT = 20;
const EMAIL_MAX = 254;

/** An address Notify takes: trimmed, one @, a dot in the domain, at most 254. */
export const parseNotifyAddress = (input: string): string | undefined => {
  const address = input.trim();
  return address.length <= EMAIL_MAX &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
    ? address
    : undefined;
};

/** The settings rows a kind has (builder forms spec 9). */
export const formSettingsRowsOf = (kind: FormsKind) => ({
  lists: kind === "contact-signup" || kind === "contact-form",
  confirm: kind === "contact-signup",
  notify: kind === "contact-form",
});

export type DoorFormsEntry =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; forms: DoorForm[] };

/** F2's answers, by project and kind. */
export const $doorForms = atom<ReadonlyMap<string, DoorFormsEntry>>(new Map());

const keyOf = (projectId: string, kind: FormsKind) => `${projectId}:${kind}`;

/** Form ids whose last save failed: the Fields row's warning reads "Not saved". */
export const $unsavedForms = atom<ReadonlySet<string>>(new Set());
/** Form ids whose opt-in the platform keeps (the built-in form, F4 `locked`). */
export const $optInLocked = atom<ReadonlySet<string>>(new Set());
/** F0 by project, and F1 by project and kind, read once. */
export const $formsAccess = atom<ReadonlyMap<string, FormsAccess>>(new Map());
export const $formsCatalogs = atom<ReadonlyMap<string, FormsCatalog>>(
  new Map()
);

/** The last saved value of each form, by project, kind and form id. */
const saved = new Map<string, DoorForm>();
/** Each form's save in flight, so the next waits for it. */
const queues = new Map<string, Promise<unknown>>();
/** How many saves each form has queued. */
const pending = new Map<string, number>();
/** How many saves each form has finished, so a read can tell it is stale. */
const finished = new Map<string, number>();
/** Reads in flight, so a second caller waits for the first. */
const reads = new Map<string, Promise<void>>();
/** A read asked for again while one was in flight: it follows that one. */
const rereads = new Map<string, Promise<void>>();
/** F0 and F1 reads in flight. */
const lookups = new Map<string, Promise<void>>();

const withId = (set: ReadonlySet<string>, id: string, present: boolean) => {
  if (set.has(id) === present) {
    return set;
  }
  const next = new Set(set);
  if (present) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
};

const setEntry = (key: string, entry: DoorFormsEntry) => {
  $doorForms.set(new Map($doorForms.get()).set(key, entry));
};

const setForm = (key: string, form: DoorForm) => {
  const entry = $doorForms.get().get(key);
  if (entry?.status !== "ready") {
    return;
  }
  setEntry(key, {
    status: "ready",
    forms: entry.forms.map((item) => (item.id === form.id ? form : item)),
  });
};

export const doorFormOf = (
  entries: ReadonlyMap<string, DoorFormsEntry>,
  projectId: string,
  kind: FormsKind,
  formId: string
): DoorForm | undefined => {
  const entry = entries.get(keyOf(projectId, kind));
  return entry?.status === "ready"
    ? entry.forms.find((form) => form.id === formId)
    : undefined;
};

/**
 * Read F2 once per project and kind; a failed read is read again next time,
 * and `reload` reads again (a form made since, such as New form's).
 */
export const loadDoorForms = (
  projectId: string,
  kind: FormsKind,
  { reload = false }: { reload?: boolean } = {}
): Promise<void> => {
  const key = keyOf(projectId, kind);
  const inFlight = reads.get(key);
  if (inFlight !== undefined) {
    if (reload === false) {
      return inFlight;
    }
    // that read may have left before the form asked for existed
    const queued =
      rereads.get(key) ??
      inFlight.then(() => {
        rereads.delete(key);
        return loadDoorForms(projectId, kind, { reload: true });
      });
    rereads.set(key, queued);
    return queued;
  }
  const current = $doorForms.get().get(key);
  if (
    reload === false &&
    current !== undefined &&
    current.status !== "failed"
  ) {
    return Promise.resolve();
  }
  if (current?.status !== "ready") {
    setEntry(key, { status: "loading" });
  }
  const finishedBefore = new Map(finished);
  const read = (async () => {
    // done before the store changes, so a reader it wakes can read again
    const result = await listDoorForms(projectId, kind).finally(() =>
      reads.delete(key)
    );
    if (result.ok === false) {
      if (current?.status !== "ready") {
        setEntry(key, { status: "failed" });
      }
      return;
    }
    const shown = $doorForms.get().get(key);
    const forms = result.value.map((form) => {
      const formKey = `${key}:${form.id}`;
      // a form with a save queued, or one that finished while the read was
      // out, keeps what it shows and its saved value: the read may predate it
      const busy =
        (pending.get(formKey) ?? 0) > 0 ||
        (finished.get(formKey) ?? 0) !== (finishedBefore.get(formKey) ?? 0);
      if (busy === false) {
        saved.set(formKey, form);
        return form;
      }
      const kept =
        shown?.status === "ready"
          ? shown.forms.find((item) => item.id === form.id)
          : undefined;
      return kept ?? saved.get(formKey) ?? form;
    });
    setEntry(key, { status: "ready", forms });
  })();
  reads.set(key, read);
  return read;
};

/** One F0 or F1 read at a time per key; a failure is read again next time. */
const lookUp = (key: string, read: () => Promise<void>): Promise<void> => {
  const inFlight = lookups.get(key);
  if (inFlight !== undefined) {
    return inFlight;
  }
  const lookup = read().finally(() => lookups.delete(key));
  lookups.set(key, lookup);
  return lookup;
};

/** F0, read once per project. */
export const loadFormsAccess = (projectId: string) => {
  if ($formsAccess.get().has(projectId)) {
    return Promise.resolve();
  }
  return lookUp(`access:${projectId}`, async () => {
    const result = await getFormsAccess(projectId);
    if (result.ok) {
      $formsAccess.set(
        new Map($formsAccess.get()).set(projectId, result.value)
      );
    }
  });
};

/** F1 (the catalog's fields and the org's lists), read once per kind. */
export const loadFormsCatalog = (projectId: string, kind: FormsKind) => {
  const key = keyOf(projectId, kind);
  if ($formsCatalogs.get().has(key)) {
    return Promise.resolve();
  }
  return lookUp(`catalog:${key}`, async () => {
    const result = await getFormsCatalog(projectId, kind);
    if (result.ok) {
      $formsCatalogs.set(new Map($formsCatalogs.get()).set(key, result.value));
    }
  });
};

const applied = (form: DoorForm, change: FormSettingsBody): DoorForm => ({
  ...form,
  ...(change.optIn === undefined ? {} : { opt_in: change.optIn }),
  ...(change.lists === undefined ? {} : { lists: change.lists }),
  ...(change.notify === undefined ? {} : { notify: change.notify }),
});

export type SaveOutcome = "saved" | "failed" | "locked";

/**
 * A change to a form's settings: shown at once, then saved after the form's
 * earlier saves. A failed or locked save puts back the last saved value.
 */
export const saveFormSetting = (
  projectId: string,
  kind: FormsKind,
  formId: string,
  change: FormSettingsBody
): Promise<SaveOutcome> => {
  const key = keyOf(projectId, kind);
  const formKey = `${key}:${formId}`;
  const shown = doorFormOf($doorForms.get(), projectId, kind, formId);
  if (shown !== undefined) {
    setForm(key, applied(shown, change));
  }
  pending.set(formKey, (pending.get(formKey) ?? 0) + 1);
  const run = async (): Promise<SaveOutcome> => {
    const result = await saveFormSettings(projectId, formId, change);
    const left = (pending.get(formKey) ?? 1) - 1;
    pending.set(formKey, left);
    finished.set(formKey, (finished.get(formKey) ?? 0) + 1);
    const last = saved.get(formKey);
    if (result.ok) {
      const now = last === undefined ? undefined : applied(last, change);
      if (now !== undefined) {
        saved.set(formKey, now);
        // with nothing queued after it, the form shows what was saved
        if (left === 0) {
          setForm(key, now);
        }
      }
      $unsavedForms.set(withId($unsavedForms.get(), formId, false));
      return "saved";
    }
    if (last !== undefined) {
      setForm(key, last);
    }
    if (result.error === "locked") {
      $optInLocked.set(withId($optInLocked.get(), formId, true));
      return "locked";
    }
    $unsavedForms.set(withId($unsavedForms.get(), formId, true));
    return "failed";
  };
  const next = (queues.get(formKey) ?? Promise.resolve()).then(run, run);
  queues.set(formKey, next);
  return next;
};

/** For tests: forget every read and save. */
export const resetDoorForms = () => {
  $doorForms.set(new Map());
  $unsavedForms.set(new Set());
  $optInLocked.set(new Set());
  $formsAccess.set(new Map());
  $formsCatalogs.set(new Map());
  saved.clear();
  queues.clear();
  pending.clear();
  finished.clear();
  reads.clear();
  rereads.clear();
  lookups.clear();
};
