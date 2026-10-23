import {
  forwardRef,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ElementRef,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { FormRootContext, useRegisterPart } from "../form/context";
import { useMergedRef } from "../form/merge-ref";
import { useFormReset } from "../form/use-form-reset";
import { useRsvpContext, type CollectedShifts } from "./context";
import type { RsvpRole, RsvpShift } from "./events-data";

/**
 * The most shifts the endpoint's body takes in one RSVP, and so the most that
 * can be ticked: a 51st would look ticked and not be sent.
 */
const maxShiftIds = 50;

// Newer ICU puts a narrow no-break space before AM and PM and older ICU a plain
// one, so a page rendered on the server and hydrated in an older browser would
// differ by a character: the text is kept to plain spaces.
const unusualSpaces = /[\u00a0\u2009\u202f]/g;

const dayAndTime = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
} as const;

const timeOnly = { hour: "numeric", minute: "2-digit" } as const;

type Formatters = {
  /** The calendar day alone, to tell whether two times fall on the same one. */
  day: Intl.DateTimeFormat;
  /** Day and time, no zone. */
  start: Intl.DateTimeFormat;
  /** Day, time and zone. */
  startWithZone: Intl.DateTimeFormat;
  /** Time and zone. */
  endWithZone: Intl.DateTimeFormat;
};

const formattersByZone = new Map<string, Formatters | null>();

/**
 * The formatters for a zone, null when `Intl` does not know it. Made once per
 * zone: an event can have a great many shifts.
 */
const getFormatters = (timeZone: string): Formatters | null => {
  const known = formattersByZone.get(timeZone);
  if (known !== undefined) {
    return known;
  }
  let formatters: Formatters | null;
  try {
    const make = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat("en-US", { ...options, timeZone });
    formatters = {
      day: make({ year: "numeric", month: "numeric", day: "numeric" }),
      start: make(dayAndTime),
      startWithZone: make({ ...dayAndTime, timeZoneName: "short" }),
      endWithZone: make({ ...timeOnly, timeZoneName: "short" }),
    };
  } catch {
    formatters = null;
  }
  formattersByZone.set(timeZone, formatters);
  return formatters;
};

const readTime = (time: string | null) => {
  if (time === null) {
    return;
  }
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * A shift's time range as the visitor reads it, in the event's own zone with
 * the zone's name at the end: "Sat, Nov 21, 12:00 PM – 3:00 PM MST". A range
 * inside one day (the event's, not UTC's) names the day once, and a shift with
 * no end shows its start alone. A missing or unknown zone reads as UTC, as the
 * Time element does. Undefined when the shift has no start that can be read.
 */
export const formatShiftTime = (
  startTime: string | null,
  endTime: string | null,
  timeZone: string | null
): string | undefined => {
  const start = readTime(startTime);
  if (start === undefined) {
    return;
  }
  const formatters =
    (timeZone ? getFormatters(timeZone) : null) ?? getFormatters("UTC");
  if (formatters === null) {
    return;
  }
  const end = readTime(endTime);
  let text: string;
  if (end === undefined) {
    text = formatters.startWithZone.format(start);
  } else if (formatters.day.format(start) === formatters.day.format(end)) {
    text = `${formatters.start.format(start)} – ${formatters.endWithZone.format(end)}`;
  } else {
    text = `${formatters.start.format(start)} – ${formatters.startWithZone.format(end)}`;
  }
  return text.replace(unusualSpaces, " ");
};

type ShiftOptionsProps = ComponentProps<"div">;

/**
 * Shift Options: a checkbox for each shift of the event, with its title and its
 * time range in the event's zone. A full shift is disabled and carries
 * `data-full`. When exactly one shift is ticked and it has roles, a radio group
 * shows them; a role is disabled when the latest `role_full` answer found it
 * full, or when the event data marks it full and the answer did not list it
 * open. Once 50 are ticked, the most the endpoint takes, the others are disabled
 * until one is unticked. Shifts already ticked in the page when it hydrates (a
 * browser restoring the form, or a visitor who got there first) stay ticked. A
 * form reset unticks them all. Renders nothing for an event with no shifts,
 * except on the canvas, where the part is always there to select. `collect`
 * returns the shifts ticked and the role chosen.
 */
export const ShiftOptions = forwardRef<ElementRef<"div">, ShiftOptionsProps>(
  (
    // The part's children are `ws:descendant` instances, which style the
    // controls through their selectors and draw nothing themselves.
    { children: _children, ...props },
    ref
  ) => {
    const { renderer } = useContext(ReactSdkContext);
    const root = useContext(FormRootContext);
    const rsvp = useRsvpContext();
    const event = rsvp?.event;
    const baseId = useId();
    const shiftMessageId = `${baseId}shifts`;
    const roleMessageId = `${baseId}role`;

    const shifts = event?.shifts ?? [];
    const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set());
    const [chosenRoleId, setChosenRoleId] = useState<string>();
    const ownRef = useRef<HTMLDivElement | null>(null);
    const mergedRef = useMergedRef(ref, ownRef);
    // a browser's reset unticks the boxes without an onChange
    const listRef = useFormReset<HTMLDivElement>(() => {
      setTicked(new Set());
      setChosenRoleId(undefined);
    }, mergedRef);
    // React keeps what a hydrated control holds and fires no onChange, so a box
    // that was ticked before the script ran (a click that came first, or the
    // browser restoring the form) is ticked in the page and not in the state,
    // and would be shown and not sent. This runs after the hydration commit,
    // while those boxes still hold their ticks, and finds nothing on a client
    // render. The boxes past the cap are put back by the render it causes.
    useLayoutEffect(() => {
      const restored = Array.from(
        ownRef.current?.querySelectorAll<HTMLInputElement>(
          'input[name="shift_ids"]:checked'
        ) ?? [],
        (box) => box.value
      );
      if (restored.length > 0) {
        setTicked(new Set(restored.slice(0, maxShiftIds)));
      }
    }, []);

    // What is ticked and still on offer, in the event's order: a shift that the
    // data now says is full, or that is gone from it, is neither shown ticked
    // nor sent.
    const selected = shifts.filter(
      (shift) => ticked.has(shift.id) && !shift.full
    );
    const selectedIds = new Set(selected.map((shift) => shift.id));
    const roleShift =
      selected.length === 1 && selected[0].roles.length > 0
        ? selected[0]
        : undefined;
    const fullRoleIds = rsvp?.fullRoleIds;
    const openRoleIds = rsvp?.openRoleIds;
    const isRoleFull = (role: RsvpRole) =>
      fullRoleIds?.has(role.id) === true ||
      (role.full && openRoleIds?.has(role.id) !== true);
    const roleId = roleShift?.roles.some(
      (role) => role.id === chosenRoleId && !isRoleFull(role)
    )
      ? chosenRoleId
      : undefined;

    // `collect` is stable, so the part registers once; it reads the latest
    // selection.
    const latest = useRef<{ ids: string[]; roleId: string | undefined }>({
      ids: [],
      roleId: undefined,
    });
    useLayoutEffect(() => {
      latest.current = { ids: selected.map((shift) => shift.id), roleId };
    });
    const collect = useCallback((): CollectedShifts => {
      const { ids, roleId } = latest.current;
      return {
        shift_ids: ids.slice(0, maxShiftIds),
        ...(roleId === undefined ? {} : { shift_role_id: roleId }),
      };
    }, []);
    useRegisterPart({ kind: "shifts", collect });

    const isCanvas = renderer === "canvas";
    if (!isCanvas && shifts.length === 0) {
      return null;
    }

    const shiftMessage = root?.fieldErrors.get("shift_ids");
    const roleMessage = root?.fieldErrors.get("shift_role_id");
    const toggle = (shiftId: string) => {
      setTicked((previous) => {
        const next = new Set(previous);
        if (next.has(shiftId)) {
          next.delete(shiftId);
        } else {
          next.add(shiftId);
        }
        return next;
      });
      // a role belongs to the one shift it was picked under
      setChosenRoleId(undefined);
    };
    const allFull = shifts.length > 0 && shifts.every((shift) => shift.full);

    return (
      <div
        {...props}
        ref={listRef}
        data-full={allFull ? "" : undefined}
        data-invalid={
          shiftMessage === undefined && roleMessage === undefined
            ? undefined
            : ""
        }
      >
        {shifts.map((shift: RsvpShift) => {
          const time = formatShiftTime(
            shift.startTime,
            shift.endTime,
            event?.timezone ?? null
          );
          return (
            <div key={shift.id} data-full={shift.full ? "" : undefined}>
              <label>
                <input
                  type="checkbox"
                  name="shift_ids"
                  value={shift.id}
                  checked={selectedIds.has(shift.id)}
                  disabled={
                    shift.full ||
                    (!selectedIds.has(shift.id) &&
                      selected.length >= maxShiftIds)
                  }
                  onChange={() => toggle(shift.id)}
                  aria-describedby={
                    shiftMessage === undefined ? undefined : shiftMessageId
                  }
                  aria-invalid={shiftMessage === undefined ? undefined : true}
                  data-invalid={shiftMessage === undefined ? undefined : ""}
                />
                <span>{shift.title}</span>
                {time !== undefined && (
                  <>
                    {" "}
                    {/* the zone's name can differ between the server's ICU and the browser's */}
                    <span suppressHydrationWarning>{time}</span>
                  </>
                )}
              </label>
              {roleShift?.id === shift.id && (
                <div
                  role="radiogroup"
                  aria-label={`Role for ${shift.title}`}
                  aria-describedby={
                    roleMessage === undefined ? undefined : roleMessageId
                  }
                  aria-invalid={roleMessage === undefined ? undefined : true}
                  data-invalid={roleMessage === undefined ? undefined : ""}
                >
                  {shift.roles.map((role) => {
                    const full = isRoleFull(role);
                    return (
                      <label key={role.id} data-full={full ? "" : undefined}>
                        <input
                          type="radio"
                          name="shift_role_id"
                          value={role.id}
                          checked={roleId === role.id}
                          disabled={full}
                          onChange={() => setChosenRoleId(role.id)}
                        />
                        <span>{role.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {shiftMessage !== undefined && (
          <div id={shiftMessageId} data-message="" data-invalid="">
            {shiftMessage}
          </div>
        )}
        {roleMessage !== undefined && (
          <div id={roleMessageId} data-message="" data-invalid="">
            {roleMessage}
          </div>
        )}
      </div>
    );
  }
);

ShiftOptions.displayName = "ShiftOptions";
