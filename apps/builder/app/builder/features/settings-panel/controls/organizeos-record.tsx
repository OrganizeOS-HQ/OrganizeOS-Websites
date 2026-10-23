import { useId } from "react";
import { computed } from "nanostores";
import { useStore } from "@nanostores/react";
import { Flex, Select, Text, theme } from "@webstudio-is/design-system";
import {
  BindingControl,
  BindingPopover,
  validatePrimitiveValue,
} from "~/builder/shared/binding-popover";
import { platformName } from "~/shared/branding";
import {
  $propValuesByInstanceSelector,
  $selectedInstanceKey,
} from "~/shared/nano-states";
import { $instances } from "~/shared/sync/data-stores";
import {
  isOrganizeosBlock,
  organizeosNamespace,
} from "~/builder/features/organizeos-panel/insert-organizeos-block";
import {
  type ControlProps,
  VerticalLayout,
  $selectedInstanceScope,
  updateExpressionValue,
  useBindingState,
  humanizeAttribute,
} from "../shared";
import { PropertyLabel } from "../property-label";

/**
 * The record picker (spec section 3.3): an OrganizeOS block's `record` prop,
 * the id of the platform record the block works on, is picked from the org's
 * records instead of typed. The Signup Form picks one of the org's forms and
 * the RSVP Form one of its events.
 *
 * The records come from the block's own computed `data`, which insert binds to
 * a binding scoped to the block's root and referencing the project's catalog
 * Resource (Forms for the Signup Form, Events for the RSVP Form). The builder
 * loads every resource bound to an instance on the page through its resources
 * loader (`subscribeResources`) and computes the block's props from that
 * cache, so the picker reads the selected block's computed `data` and makes no
 * request of its own.
 */

export type OrganizeosRecordOption = {
  /** What choosing it writes to `record`: a record id, or "" for the org defaults. */
  value: string;
  label: string;
};

type RecordOptions = {
  options: OrganizeosRecordOption[];
  /** The option the record names; none when it names nothing. */
  selected: undefined | OrganizeosRecordOption;
  /** Whether `data` is the records' body; the control shows a hint when not. */
  hasData: boolean;
};

/** What a block's record is picked from, and how the control words it. */
export type RecordPicker = {
  getOptions: (data: unknown, value: unknown, now: Date) => RecordOptions;
  /** Under the control while there is no data. */
  noDataHint: string;
  /** In the control while nothing is selected. */
  placeholder: string;
};

const orgDefaultsOption: OrganizeosRecordOption = {
  value: "",
  label: "None (org defaults)",
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

// The block reads `record` only as a string, and anything else as no record.
const toRecordValue = (value: unknown) =>
  typeof value === "string" ? value : "";

// Shown while the records load and when they fail to. Reloading retries a load
// that failed or stalled; it cannot restore a preset whose link to the org's
// data was removed (OrganizeOS spec section 12, item 17), which support can.
const getNoDataHint = (records: string) =>
  `Your ${records} load from ${platformName}. If they do not appear, reload the builder; if they still do not, contact ${platformName} support.`;

/**
 * The Signup Form's picker, over the kinds of form its record can name, with
 * the label each kind has in the picker. Options come from the block's
 * computed `data`, the `GET /v1/forms` body
 * `{ data: [{ id, kind, name, fields, opt_in }] }`. Read leniently, as the
 * block reads it (`forms-data.ts` in the package), so nothing here throws:
 * `data` of any other shape is no data (unbound, not loaded yet, or the
 * loader's error body), and an entry the block skips, with no string id or no
 * fields, is skipped.
 */
const formsPicker = (kinds: ReadonlyMap<string, string>): RecordPicker => ({
  noDataHint: getNoDataHint("forms"),
  placeholder: "Select a form",
  getOptions: (data, value) => {
    const forms =
      isObject(data) && Array.isArray(data.data) ? data.data : undefined;
    const options = [orgDefaultsOption];
    const ids = new Set<string>();
    for (const form of forms ?? []) {
      if (
        isObject(form) === false ||
        typeof form.id !== "string" ||
        Array.isArray(form.fields) === false ||
        // the block takes the first form with the record's id
        ids.has(form.id)
      ) {
        continue;
      }
      ids.add(form.id);
      const kindLabel =
        typeof form.kind === "string" ? kinds.get(form.kind) : undefined;
      // The block looks its form up by the trimmed record, so it never finds a
      // blank or padded id.
      if (
        kindLabel === undefined ||
        form.id === "" ||
        form.id !== form.id.trim()
      ) {
        continue;
      }
      const name =
        typeof form.name === "string" && form.name.trim() !== ""
          ? form.name
          : "Untitled form";
      options.push({ value: form.id, label: `${name} (${kindLabel})` });
    }

    const current = toRecordValue(value);
    const currentId = current.trim();
    let selected =
      currentId === ""
        ? orgDefaultsOption
        : options.find((option) => option.value === currentId);
    // The current value is never dropped: a form that was unpublished or
    // deleted, that has not loaded, or that this block does not take stays
    // listed, so the designer sees it and can pick another.
    if (selected === undefined) {
      selected = { value: current, label: "Unavailable form" };
      options.splice(1, 0, selected);
    }
    return { options, selected, hasData: forms !== undefined };
  },
});

// A time that is not a string reads as none, and one that cannot be read is
// not past, as the RSVP Form reads them.
const readTime = (value: unknown) => (typeof value === "string" ? value : null);

const isPast = (time: null | string, now: Date) => {
  if (time === null) {
    return false;
  }
  return Date.parse(time) < now.getTime();
};

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

// The date in the event's own zone, as the blocks show an event: UTC for a
// zone this browser does not know, and none for a start that cannot be read.
const formatEventDate = (start: unknown, timeZone: unknown) => {
  if (typeof start !== "string" || Number.isNaN(Date.parse(start))) {
    return;
  }
  const zone = typeof timeZone === "string" ? timeZone : "UTC";
  let formatter = dateFormatters.get(zone);
  if (formatter === undefined) {
    try {
      formatter = new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeZone: zone,
      });
    } catch {
      formatter = new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      });
    }
    dateFormatters.set(zone, formatter);
  }
  return formatter.format(new Date(start));
};

const getStartTime = (event: Record<string, unknown>) =>
  typeof event.start_time === "string" ? Date.parse(event.start_time) : NaN;

/**
 * The RSVP Form's picker, over the org's events: the block's computed `data`,
 * the `GET /v1/events` body `{ data: [{ id, title, start_time, end_time,
 * timezone, ... }] }`. Read as the block reads it (`events-data.ts` in the
 * package): an entry with no string id is skipped, the first event with an id
 * is the block's, and an event it cannot find by the trimmed record is not
 * offered under a blank or padded id.
 *
 * The events not yet over come first, soonest first, then the ended ones,
 * marked "(ended)", the latest first: the Events Resource lists the org's whole
 * history, so the ones a designer is likely to want are at the top. An event is
 * ended when its end time, or its start time when it has no end time, is past.
 * Each is labelled with its title and its date in its own zone. There is no
 * "None": a form without an event is Unavailable on the live site.
 */
const eventsPicker: RecordPicker = {
  noDataHint: getNoDataHint("events"),
  placeholder: "Pick an event",
  getOptions: (data, value, now) => {
    const events =
      isObject(data) && Array.isArray(data.data) ? data.data : undefined;
    type Entry = { option: OrganizeosRecordOption; start: number };
    const upcoming: Entry[] = [];
    const ended: Entry[] = [];
    const ids = new Set<string>();
    for (const event of events ?? []) {
      if (
        isObject(event) === false ||
        typeof event.id !== "string" ||
        // the block takes the first event with the record's id
        ids.has(event.id)
      ) {
        continue;
      }
      ids.add(event.id);
      // The block looks its event up by the trimmed record, so it never finds
      // a blank or padded id.
      if (event.id === "" || event.id !== event.id.trim()) {
        continue;
      }
      const title =
        typeof event.title === "string" && event.title.trim() !== ""
          ? event.title
          : "Untitled event";
      const date = formatEventDate(event.start_time, event.timezone);
      const isEnded = isPast(
        readTime(event.end_time) ?? readTime(event.start_time),
        now
      );
      const label = `${date === undefined ? title : `${title}, ${date}`}${
        isEnded ? " (ended)" : ""
      }`;
      (isEnded ? ended : upcoming).push({
        option: { value: event.id, label },
        start: getStartTime(event),
      });
    }
    // Array.prototype.sort is stable, so events that start together keep the
    // order the data has them in. An unreadable start comes last among the
    // upcoming.
    upcoming.sort(
      (a, b) =>
        (Number.isNaN(a.start) ? Infinity : a.start) -
          (Number.isNaN(b.start) ? Infinity : b.start) || 0
    );
    ended.sort(
      (a, b) =>
        (Number.isNaN(b.start) ? -Infinity : b.start) -
          (Number.isNaN(a.start) ? -Infinity : a.start) || 0
    );
    const options = [...upcoming, ...ended].map(({ option }) => option);

    const current = toRecordValue(value);
    const currentId = current.trim();
    let selected =
      currentId === ""
        ? undefined
        : options.find((option) => option.value === currentId);
    // The current value is never dropped: an event that was unpublished,
    // deleted or made private, or that has not loaded, stays listed, so the
    // designer sees it and can pick another.
    if (selected === undefined && currentId !== "") {
      selected = { value: current, label: "Unavailable event" };
      options.unshift(selected);
    }
    return { options, selected, hasData: events !== undefined };
  },
};

/**
 * The block each record picker belongs to, keyed by the block's full component
 * name. A record prop on a component not listed here keeps the text control.
 */
const recordPickers: ReadonlyMap<string, RecordPicker> = new Map([
  [
    `${organizeosNamespace}:SignupForm`,
    formsPicker(
      new Map([
        ["contact-signup", "Newsletter"],
        ["contact-form", "Contact"],
      ])
    ),
  ],
  [`${organizeosNamespace}:RsvpForm`, eventsPicker],
]);

/** Whether a prop gets the record picker instead of its own control. */
export const isOrganizeosRecordProp = (
  component: undefined | string,
  propName: string
) =>
  propName === "record" &&
  component !== undefined &&
  isOrganizeosBlock(component) &&
  recordPickers.has(component);

// A component with no picker lists no record, as one with no kinds did.
const noPicker = formsPicker(new Map());

/**
 * The picker a block's `record` is chosen with: what it lists, the hint under
 * the control while there is no data and the placeholder while nothing is
 * selected. The control reads its wording from here, so a test of the picker
 * is a test of what the control shows.
 */
export const getOrganizeosRecordPicker = (
  component: undefined | string
): RecordPicker => recordPickers.get(component ?? "") ?? noPicker;

/**
 * The options for a block's `record`, from its computed `data`. `now` splits
 * the RSVP Form's events into the upcoming and the ended.
 */
export const getOrganizeosRecordOptions = (
  component: undefined | string,
  data: unknown,
  value: unknown,
  now: Date = new Date()
): RecordOptions =>
  getOrganizeosRecordPicker(component).getOptions(data, value, now);

/**
 * The selected instance's computed `data`, where its record is picked from.
 * For an inserted block it is the body of its catalog Resource (Forms or
 * Events) once the builder's loader has fetched it, and undefined until then.
 */
export const $selectedInstanceDataProp = computed(
  [$propValuesByInstanceSelector, $selectedInstanceKey],
  (propValuesByInstanceSelector, instanceKey) =>
    propValuesByInstanceSelector.get(instanceKey ?? "")?.get("data")
);

// Radix Select refuses an item whose value is the empty string, which is the
// org defaults' value, so every option is keyed with a prefix.
const getOptionKey = (option: OrganizeosRecordOption) =>
  `record:${option.value}`;

const getOptionLabel = (option: OrganizeosRecordOption) => option.label;

/**
 * A select with `select.tsx`'s binding support, over the options above, and a
 * hint under it when there is no data.
 */
export const OrganizeosRecordControl = ({
  instanceId,
  meta,
  prop,
  propName,
  computedValue,
  onChange,
}: ControlProps<"text">) => {
  const id = useId();
  const component = useStore($instances).get(instanceId)?.component;
  const data = useStore($selectedInstanceDataProp);
  const { options, selected, hasData } = getOrganizeosRecordOptions(
    component,
    data,
    computedValue
  );
  const picker = getOrganizeosRecordPicker(component);

  const label = humanizeAttribute(meta.label || propName);
  const { scope, aliases } = useStore($selectedInstanceScope);
  const expression =
    prop?.type === "expression" ? prop.value : JSON.stringify(computedValue);
  const { overwritable, variant } = useBindingState(
    prop?.type === "expression" ? prop.value : undefined
  );

  return (
    <VerticalLayout
      label={
        <PropertyLabel name={propName} readOnly={overwritable === false} />
      }
    >
      <Flex css={{ gap: theme.spacing[3] }} direction="column">
        <BindingControl>
          <Select
            fullWidth
            id={id}
            disabled={overwritable === false}
            value={selected}
            placeholder={picker.placeholder}
            options={options}
            getLabel={getOptionLabel}
            getValue={getOptionKey}
            // type to find an option by its label, not its key
            getItemProps={(option) => ({ textValue: option.label })}
            onChange={(option) => {
              if (prop?.type === "expression") {
                updateExpressionValue(prop.value, option.value);
              } else {
                onChange({ type: "string", value: option.value });
              }
            }}
          />
          <BindingPopover
            scope={scope}
            aliases={aliases}
            // Checked as the text control checks it, not against the options:
            // a bound id may name a record that has not loaded yet.
            validate={(value) => validatePrimitiveValue(value, label)}
            variant={variant}
            value={expression}
            onChange={(newExpression) =>
              onChange({ type: "expression", value: newExpression })
            }
            onRemove={(evaluatedValue) =>
              onChange({ type: "string", value: toRecordValue(evaluatedValue) })
            }
          />
        </BindingControl>
        {hasData === false && <Text color="subtle">{picker.noDataHint}</Text>}
      </Flex>
    </VerticalLayout>
  );
};
