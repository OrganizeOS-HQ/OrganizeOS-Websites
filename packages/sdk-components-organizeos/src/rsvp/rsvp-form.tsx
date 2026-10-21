import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ElementRef,
  type FormEvent,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { CanvasCheck } from "../form/canvas-check";
import {
  FormRootContext,
  usePartRegistry,
  type FormFieldConfig,
  type FormPart,
  type FormRoot,
} from "../form/context";
import { useMergedRef } from "../form/merge-ref";
import { navigateTo } from "../form/navigate";
import {
  isBuilderRender,
  postToPlatform,
  stateForAnswer,
  type AnswerStates,
  type OpenRole,
} from "../form/submit";
import { RsvpContext, type RsvpContextValue } from "./context";
import {
  resolveRsvpEvent,
  type RsvpEvent,
  type RsvpEventResolution,
} from "./events-data";
import { rsvpsPath, type RsvpFormState } from "./states";

/**
 * The fields an RSVP always collects, as the endpoint takes them: the name and
 * email required, the phone optional. The event decides the rest (guests,
 * shifts, questions), through the composite parts.
 */
const rsvpFields: readonly FormFieldConfig[] = [
  {
    name: "first_name",
    label: "First name",
    type: "text",
    required: true,
    options: null,
  },
  {
    name: "last_name",
    label: "Last name",
    type: "text",
    required: true,
    options: null,
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    required: true,
    options: null,
  },
  {
    name: "phone",
    label: "Phone",
    type: "phone",
    required: false,
    options: null,
  },
];

const requiredFieldNames = rsvpFields
  .filter((field) => field.required)
  .map((field) => field.name);

const knownFieldNames: ReadonlySet<string> = new Set(
  rsvpFields.map((field) => field.name)
);

/**
 * The text `onStateChange` passes with each state, for a text element the
 * designer binds. Generic on purpose: the platform's own words never reach
 * the visitor.
 */
const stateMessages: Record<RsvpFormState, string> = {
  initial: "",
  submitting: "",
  registered: "You're registered.",
  waitlisted: "You're on the waitlist.",
  full: "This event is full.",
  ended: "This event has ended.",
  error: "Something went wrong. Please try again.",
  unavailable: "This form is not available right now.",
};

const invalidFieldMessage = "Please check the form and try again.";

const roleFullMessage = "That role just filled. Pick another.";

/** The message for the part that shows a field the platform refused. */
const fieldErrorMessage = (field: string) => {
  if (field.startsWith("answers.")) {
    return "Check this answer.";
  }
  switch (field) {
    case "first_name":
      return "Enter your first name.";
    case "last_name":
      return "Enter your last name.";
    case "email":
      return "Enter a valid email address.";
    case "phone":
      return "Enter a valid phone number.";
    case "guests":
      return "Check your guests' names.";
    case "shift_ids":
      return "Check the shifts you picked.";
    case "shift_role_id":
      return "Check the role you picked.";
    default:
      return "Check this field.";
  }
};

const answerStates: AnswerStates<RsvpFormState> = {
  outcomes: {
    registered: "registered",
    waitlisted: "waitlisted",
  },
  success: "registered",
  errors: {
    full: "full",
    ended: "ended",
    not_found: "unavailable",
  },
  error: "error",
};

/** The states in which the template shows the form's content, and its parts. */
const formContentStates: ReadonlySet<string> = new Set([
  "initial",
  "submitting",
  "error",
]);

const honeypotStyle: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

// The composite parts return their values as `unknown` (FormPart.collect), and
// the root keeps only what the endpoint's strict body takes: a part that
// returns more, or something else, cannot make the post a 400.
const readGuests = (value: unknown) => {
  const guests: Array<{ first_name: string; last_name: string }> = [];
  for (const row of Array.isArray(value) ? (value as unknown[]) : []) {
    if (
      isRecord(row) &&
      typeof row.first_name === "string" &&
      typeof row.last_name === "string"
    ) {
      guests.push({ first_name: row.first_name, last_name: row.last_name });
    }
  }
  return guests;
};

type Selection = { shiftIds: string[]; roleId: string | undefined };

const readSelection = (value: unknown): Selection => {
  if (isRecord(value) === false) {
    return { shiftIds: [], roleId: undefined };
  }
  const shiftIds = Array.isArray(value.shift_ids)
    ? (value.shift_ids as unknown[]).filter(
        (id): id is string => typeof id === "string" && id !== ""
      )
    : [];
  const roleId =
    typeof value.shift_role_id === "string" && value.shift_role_id !== ""
      ? value.shift_role_id
      : undefined;
  return { shiftIds, roleId };
};

const readAnswers = (value: unknown) => {
  const answers: Array<[string, string]> = [];
  if (isRecord(value)) {
    for (const [questionId, answer] of Object.entries(value)) {
      if (typeof answer === "string") {
        answers.push([questionId, answer]);
      }
    }
  }
  return answers;
};

/**
 * What the composite parts collect. The first Guests part with rows and the
 * first Shift Options part with a shift win, the answers of every Questions
 * part are merged, and a checked Email Consent box counts wherever it is.
 */
const collectFromParts = (parts: readonly FormPart[]) => {
  let guests: ReturnType<typeof readGuests> = [];
  let selection: Selection = { shiftIds: [], roleId: undefined };
  const answers = new Map<string, string>();
  let emailConsent = false;
  for (const part of parts) {
    if (part.collect === undefined) {
      continue;
    }
    const value = part.collect();
    if (part.kind === "guests" && guests.length === 0) {
      guests = readGuests(value);
    } else if (part.kind === "shifts" && selection.shiftIds.length === 0) {
      selection = readSelection(value);
    } else if (part.kind === "questions") {
      for (const [questionId, answer] of readAnswers(value)) {
        answers.set(questionId, answer);
      }
    } else if (part.kind === "consent" && value === true) {
      emailConsent = true;
    }
  }
  return { guests, selection, answers, emailConsent };
};

/** What the Field Inputs hold, by field name, for the fields an RSVP has. */
const readInputs = (parts: readonly FormPart[]) => {
  const values = new Map<string, string>();
  for (const part of parts) {
    if (
      part.kind !== "input" ||
      part.name === undefined ||
      part.read === undefined ||
      knownFieldNames.has(part.name) === false
    ) {
      continue;
    }
    // two inputs for one field: keep the one the visitor filled in
    if (values.get(part.name)) {
      continue;
    }
    values.set(part.name, part.read());
  }
  return values;
};

/** The `POST /api/public/site/v1/rsvps` body. */
const buildRsvpBody = ({
  eventId,
  inputs,
  collected,
  pagePath,
  honeypot,
}: {
  eventId: string;
  inputs: ReadonlyMap<string, string>;
  collected: ReturnType<typeof collectFromParts>;
  pagePath: string;
  honeypot: string;
}) => {
  const phone = inputs.get("phone") ?? "";
  const { guests, selection, answers, emailConsent } = collected;
  return {
    event_id: eventId,
    first_name: inputs.get("first_name") ?? "",
    last_name: inputs.get("last_name") ?? "",
    email: inputs.get("email") ?? "",
    // what the event or the visitor left out is left out of the body
    ...(phone.trim() === "" ? {} : { phone }),
    ...(guests.length === 0 ? {} : { guests }),
    ...(selection.shiftIds.length === 0
      ? {}
      : { shift_ids: selection.shiftIds }),
    ...(selection.roleId === undefined
      ? {}
      : { shift_role_id: selection.roleId }),
    ...(answers.size === 0 ? {} : { answers: Object.fromEntries(answers) }),
    email_consent: emailConsent,
    page_path: pagePath,
    website: honeypot,
  };
};

const hasPart = (parts: readonly FormPart[], kind: FormPart["kind"]) =>
  parts.some((part) => part.kind === kind);

/**
 * Whether a field the endpoint requires has no Field Input to collect it. The
 * post would go without it, and the platform's invalid_field answer would
 * name a field with no Field Message to show it on, so the visitor could
 * never get past the generic error: the form is unavailable as laid out.
 */
const lacksRequiredInput = (parts: readonly FormPart[]) => {
  const collected = new Set<string>();
  for (const part of parts) {
    if (
      part.kind === "input" &&
      part.name !== undefined &&
      part.read !== undefined
    ) {
      collected.add(part.name);
    }
  }
  return requiredFieldNames.some((name) => collected.has(name) === false);
};

/**
 * Whether the event asks a question it requires and the form has no Questions
 * part to ask it. Every post would be refused for the missing answer, on a
 * field no part shows.
 */
const lacksQuestions = (event: RsvpEvent, parts: readonly FormPart[]) =>
  event.questions.some((question) => question.required) &&
  hasPart(parts, "questions") === false;

/**
 * The roles a `role_full` answer found without room. The answer lists the
 * roles of the chosen shift that still have room and never the chosen role, so
 * the chosen role and every other role of its shift that it does not list are
 * full; a later answer for the shift replaces what an earlier one said of it.
 * Without a single known shift the chosen role is all there is to mark.
 */
const markFullRoles = ({
  previous,
  event,
  selection,
  openRoles,
}: {
  previous: ReadonlySet<string>;
  event: RsvpEvent;
  selection: Selection;
  openRoles: OpenRole[] | undefined;
}) => {
  const next = new Set(previous);
  const shift =
    selection.shiftIds.length === 1
      ? event.shifts.find((item) => item.id === selection.shiftIds[0])
      : undefined;
  if (shift !== undefined) {
    const open = new Set(openRoles?.map((role) => role.id));
    for (const role of shift.roles) {
      next.delete(role.id);
      // no readable list says nothing about the siblings
      if (openRoles !== undefined && open.has(role.id) === false) {
        next.add(role.id);
      }
    }
  }
  if (selection.roleId !== undefined) {
    next.add(selection.roleId);
  }
  return next;
};

const pluralize = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

/** What the canvas check reports for an RSVP Form. */
const getProblems = ({
  resolution,
  parts,
  nesting,
  state,
}: {
  resolution: RsvpEventResolution;
  parts: readonly FormPart[];
  nesting: undefined | "root" | "form";
  state: string;
}) => {
  const problems: string[] = [];
  if (nesting === "root") {
    problems.push(
      "It sits inside another OrganizeOS form. Forms cannot nest: move it out."
    );
  }
  if (nesting === "form") {
    problems.push("It sits inside a Form. Forms cannot nest: move it out.");
  }
  if (resolution.unavailable === "no-record") {
    problems.push(
      "Pick an event. With none, the live site shows the Unavailable state."
    );
  }
  if (resolution.unavailable === "data") {
    problems.push(
      "Its Events data is missing or did not load, so its event cannot be found and the live site shows the Unavailable state."
    );
  }
  if (resolution.unavailable === "record") {
    problems.push(
      "Its event is not available: unpublished, deleted, or not public. Pick another event."
    );
  }
  // The template hides the form's content in the other states, which
  // unmounts its parts: a check then would report parts that are only hidden.
  if (formContentStates.has(state) === false) {
    return problems;
  }
  const fieldNames = new Set<string>();
  let hasSubmit = false;
  for (const part of parts) {
    if (part.kind === "field" && part.name !== undefined) {
      fieldNames.add(part.name);
    }
    if (part.kind === "submit") {
      hasSubmit = true;
    }
  }
  for (const name of requiredFieldNames) {
    if (fieldNames.has(name) === false) {
      problems.push(
        `Add a Field for ${name.replace("_", " ")} (${name}): the form requires it.`
      );
    }
  }
  if (hasSubmit === false) {
    problems.push("Add a Submit Button.");
  }
  if (
    resolution.event !== undefined &&
    lacksQuestions(resolution.event, parts)
  ) {
    problems.push("Add Questions: the event has required questions.");
  }
  for (const name of fieldNames) {
    if (name === "") {
      problems.push("A Field has no form field. Set one in its settings.");
    } else if (knownFieldNames.has(name) === false) {
      problems.push(
        `A Field is set to "${name}", which an RSVP Form does not have. Use ${Array.from(knownFieldNames).join(", ")}.`
      );
    }
  }
  return problems;
};

/**
 * What the canvas check notes for an RSVP Form: not faults, but what the live
 * site shows or what the event offers that the form does not use yet.
 */
const getNotes = ({
  resolution,
  parts,
  state,
}: {
  resolution: RsvpEventResolution;
  parts: readonly FormPart[];
  state: string;
}) => {
  const { event } = resolution;
  const notes: string[] = [];
  if (event === undefined) {
    return notes;
  }
  if (resolution.ended) {
    notes.push("This event has ended, so the live site shows the Ended state.");
  } else if (resolution.full) {
    notes.push(
      "This event is full and has no waitlist, so the live site shows the Full state."
    );
  }
  if (formContentStates.has(state)) {
    if (event.shifts.length > 0 && hasPart(parts, "shifts") === false) {
      notes.push(
        `This event has ${pluralize(event.shifts.length, "shift")}. Add Shift Options to let visitors pick one.`
      );
    }
    if (event.maxGuests > 0 && hasPart(parts, "guests") === false) {
      notes.push(
        `This event takes up to ${pluralize(event.maxGuests, "guest")}. Add Guests to let visitors bring some.`
      );
    }
  }
  return notes;
};

type RsvpFormProps = Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  /** The event's id, from the Events data. */
  record?: string;
  /** The `GET /v1/events` body, `{ data: Event[] }`: the project's Events Resource. */
  data?: unknown;
  /** Reveals a state on the canvas; bound to the template's `rsvpState` variable. */
  state?: RsvpFormState;
  /** Called with each new state and a generic message for it. */
  onStateChange?: (state: RsvpFormState, message: string) => void;
  /** After a successful RSVP: show the Registered state, or go to `actionPage`. */
  action?: "state" | "page";
  actionPage?: string;
};

/**
 * RSVP Form: the root of the RSVP block. Renders the `<form>`, finds its event
 * in `data` by `record`, and on a published site posts what its parts collect
 * to the platform's rsvps endpoint on the page's own origin. The event's guest
 * allowance, shifts and questions reach the composite parts through the RSVP
 * context. On the canvas it checks its parts and draws a warning on itself;
 * the canvas and the preview never post.
 */
export const RsvpForm = forwardRef<ElementRef<"form">, RsvpFormProps>(
  (
    {
      record,
      data,
      state = "initial",
      onStateChange,
      action = "state",
      actionPage,
      children,
      ...props
    },
    forwardedRef
  ) => {
    const { renderer } = useContext(ReactSdkContext);
    const parentRoot = useContext(FormRootContext);
    const resolution = useMemo(
      () => resolveRsvpEvent(record, data, new Date()),
      [record, data]
    );
    const { parts, register } = usePartRegistry();
    const formRef = useRef<HTMLFormElement | null>(null);
    const ref = useMergedRef(forwardedRef, formRef);
    const honeypotRef = useRef<HTMLInputElement>(null);

    // The current state follows the state prop (the bound variable, or the
    // design-time selector on the canvas) and moves on with a submission, so
    // the parts are right even when no variable is bound.
    const [current, setCurrent] = useState<string>(state);
    const [stateProp, setStateProp] = useState(state);
    if (state !== stateProp) {
      setStateProp(state);
      setCurrent(state);
    }
    const [fieldErrors, setFieldErrors] = useState<ReadonlyMap<string, string>>(
      () => new Map()
    );
    const [fullRoleIds, setFullRoleIds] = useState<ReadonlySet<string>>(
      () => new Set()
    );

    const onStateChangeRef = useRef(onStateChange);
    useLayoutEffect(() => {
      onStateChangeRef.current = onStateChange;
    });
    const report = useCallback((next: RsvpFormState, message: string) => {
      setCurrent(next);
      onStateChangeRef.current?.(next, message);
    }, []);

    // A published site shows the state the event is in; the canvas notes it
    // instead. An event that cannot be found comes first, then one that is
    // over, then one that has no room and no waitlist.
    let blocked: RsvpFormState | undefined;
    if (resolution.unavailable !== undefined) {
      blocked = "unavailable";
    } else if (resolution.ended) {
      blocked = "ended";
    } else if (resolution.full) {
      blocked = "full";
    }
    useEffect(() => {
      if (renderer === undefined && blocked !== undefined) {
        report(blocked, stateMessages[blocked]);
      }
    }, [renderer, blocked, report]);

    const submitting = useRef(false);
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      // the builder's canvas and preview never post
      if (isBuilderRender(renderer) || submitting.current) {
        return;
      }
      const rsvpEvent = resolution.event;
      if (
        resolution.unavailable !== undefined ||
        rsvpEvent === undefined ||
        lacksRequiredInput(parts) ||
        lacksQuestions(rsvpEvent, parts)
      ) {
        report("unavailable", stateMessages.unavailable);
        return;
      }
      const collected = collectFromParts(parts);
      const body = buildRsvpBody({
        eventId: rsvpEvent.id,
        inputs: readInputs(parts),
        collected,
        pagePath: window.location.pathname,
        honeypot: honeypotRef.current?.value ?? "",
      });
      submitting.current = true;
      setFieldErrors(new Map());
      report("submitting", stateMessages.submitting);
      void postToPlatform({ renderer, path: rsvpsPath, body }).then(
        (answer) => {
          submitting.current = false;
          if (answer === undefined) {
            return;
          }
          const {
            state: next,
            field,
            openRoles,
          } = stateForAnswer(answer, answerStates);
          let message = stateMessages[next];
          if ("error" in answer && answer.error === "role_full") {
            // The visitor can pick another role, another shift or none, so
            // the form stays as it is and the Shift Options part says which
            // roles are gone.
            message = roleFullMessage;
            setFieldErrors(new Map([["shift_role_id", roleFullMessage]]));
            setFullRoleIds((previous) =>
              markFullRoles({
                previous,
                event: rsvpEvent,
                selection: collected.selection,
                openRoles,
              })
            );
          } else if (field !== undefined) {
            message = invalidFieldMessage;
            setFieldErrors(new Map([[field, fieldErrorMessage(field)]]));
          }
          report(next, message);
          if (
            next === "registered" &&
            action === "page" &&
            typeof actionPage === "string" &&
            actionPage !== ""
          ) {
            navigateTo(actionPage);
          }
        }
      );
    };

    // Canvas check: a form inside another form is invalid HTML and cannot
    // submit, and the upstream Form's content model is not ours to change.
    // Moving an instance on the canvas remounts it, so checking on mount is
    // enough.
    const [insideForm, setInsideForm] = useState(false);
    useLayoutEffect(() => {
      if (renderer === "canvas") {
        setInsideForm(Boolean(formRef.current?.parentElement?.closest("form")));
      }
    }, [renderer]);
    let nesting: undefined | "root" | "form";
    if (parentRoot !== undefined) {
      nesting = "root";
    } else if (insideForm) {
      nesting = "form";
    }
    const isCanvas = renderer === "canvas";
    const problems = isCanvas
      ? getProblems({ resolution, parts, nesting, state: current })
      : [];
    const notes = isCanvas
      ? getNotes({ resolution, parts, state: current })
      : [];

    const root = useMemo<FormRoot>(
      () => ({
        register,
        fields: rsvpFields,
        fieldErrors,
        state: current,
      }),
      [register, fieldErrors, current]
    );
    const rsvp = useMemo<RsvpContextValue>(
      () => ({ event: resolution.event, fullRoleIds }),
      [resolution.event, fullRoleIds]
    );

    return (
      <form
        {...props}
        ref={ref}
        // A submit before the page's script runs posts to the page itself and
        // never puts what the visitor typed into the address bar.
        method="post"
        noValidate={false}
        onSubmit={handleSubmit}
      >
        <CanvasCheck title="RSVP Form" problems={problems} notes={notes} />
        <FormRootContext.Provider value={root}>
          <RsvpContext.Provider value={rsvp}>{children}</RsvpContext.Provider>
        </FormRootContext.Provider>
        <input
          ref={honeypotRef}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          defaultValue=""
          style={honeypotStyle}
        />
      </form>
    );
  }
);

RsvpForm.displayName = "RsvpForm";
