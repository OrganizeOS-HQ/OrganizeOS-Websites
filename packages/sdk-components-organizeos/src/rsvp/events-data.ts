/** A role of a shift, as `GET /v1/events` lists it. */
export type RsvpRole = {
  id: string;
  name: string;
  description: string | null;
  /** No room left, at the moment the list was read. */
  full: boolean;
};

/** A shift of an event: active or full, never a draft or a cancelled one. */
export type RsvpShift = {
  id: string;
  title: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  /** No room left, at the moment the list was read. */
  full: boolean;
  roles: RsvpRole[];
};

export const rsvpQuestionTypes = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "multiselect",
  "checkbox",
] as const;

export type RsvpQuestionType = (typeof rsvpQuestionTypes)[number];

/** A registration question of an event. */
export type RsvpQuestion = {
  id: string;
  label: string;
  helpText: string | null;
  type: RsvpQuestionType;
  required: boolean;
  /** The choices of a select or a multiselect. */
  options: string[];
};

/**
 * An event as the RSVP Form reads it from the Events data: what the block
 * needs of an item of `GET /v1/events`, which is the registration details and
 * the event's time.
 */
export type RsvpEvent = {
  id: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  /** The event's own time zone, null when the list sends none. */
  timezone: string | null;
  /** Whether a full event takes more RSVPs onto a waitlist. */
  waitlist: boolean;
  /** At capacity. With a waitlist an RSVP is still taken. */
  full: boolean;
  /** How many guests one RSVP may bring, from 0 to the endpoint's limit. */
  maxGuests: number;
  shifts: RsvpShift[];
  questions: RsvpQuestion[];
};

/** The most guests one RSVP may name: the endpoint's body takes at most this many. */
export const maxGuestsLimit = 10;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

const readString = (value: unknown, fallback: string) =>
  typeof value === "string" ? value : fallback;

const readNullableString = (value: unknown) =>
  typeof value === "string" ? value : null;

// Lenient by design: a published site freezes this code while the platform's
// DTO can gain fields, so unknown keys are ignored and only what the block
// needs is read. An entry without a string id cannot be told apart or posted,
// so it is skipped; anything else missing reads as nothing.
const parseRole = (value: unknown): RsvpRole | undefined => {
  if (isRecord(value) === false || typeof value.id !== "string") {
    return;
  }
  return {
    id: value.id,
    name: readString(value.name, ""),
    description: readNullableString(value.description),
    full: value.full === true,
  };
};

const parseShift = (value: unknown): RsvpShift | undefined => {
  if (isRecord(value) === false || typeof value.id !== "string") {
    return;
  }
  const roles: RsvpRole[] = [];
  for (const item of Array.isArray(value.roles) ? value.roles : []) {
    const role = parseRole(item);
    if (role) {
      roles.push(role);
    }
  }
  return {
    id: value.id,
    title: readString(value.title, ""),
    description: readNullableString(value.description),
    startTime: readNullableString(value.start_time),
    endTime: readNullableString(value.end_time),
    full: value.full === true,
    roles,
  };
};

const isQuestionType = (value: unknown): value is RsvpQuestionType =>
  rsvpQuestionTypes.some((type) => type === value);

const parseQuestion = (value: unknown): RsvpQuestion | undefined => {
  if (isRecord(value) === false || typeof value.id !== "string") {
    return;
  }
  return {
    id: value.id,
    label: readString(value.label, ""),
    helpText: readNullableString(value.help_text),
    // a type this build does not know is asked as a line of text
    type: isQuestionType(value.type) ? value.type : "text",
    required: value.required === true,
    options: Array.isArray(value.options)
      ? value.options.filter((option) => typeof option === "string")
      : [],
  };
};

const parseMaxGuests = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, maxGuestsLimit)
    : 0;

const parseEvent = (value: unknown): RsvpEvent | undefined => {
  if (isRecord(value) === false || typeof value.id !== "string") {
    return;
  }
  const shifts: RsvpShift[] = [];
  for (const item of Array.isArray(value.shifts) ? value.shifts : []) {
    const shift = parseShift(item);
    if (shift) {
      shifts.push(shift);
    }
  }
  const questions: RsvpQuestion[] = [];
  for (const item of Array.isArray(value.questions) ? value.questions : []) {
    const question = parseQuestion(item);
    if (question) {
      questions.push(question);
    }
  }
  return {
    id: value.id,
    title: readString(value.title, ""),
    startTime: readNullableString(value.start_time),
    endTime: readNullableString(value.end_time),
    timezone: readNullableString(value.timezone),
    waitlist: value.waitlist === true,
    full: value.full === true,
    maxGuests: parseMaxGuests(value.max_guests),
    shifts,
    questions,
  };
};

/**
 * Reads the `GET /v1/events` body, `{ data: Event[] }`. Undefined when the
 * value is missing or is not that shape (the Resource failed to load, or is
 * unbound).
 */
export const parseEventsData = (data: unknown): RsvpEvent[] | undefined => {
  if (isRecord(data) === false || Array.isArray(data.data) === false) {
    return;
  }
  const events: RsvpEvent[] = [];
  for (const item of data.data) {
    const event = parseEvent(item);
    if (event) {
      events.push(event);
    }
  }
  return events;
};

export type RsvpEventResolution = {
  /** The block's event, undefined when it cannot be found. */
  event: RsvpEvent | undefined;
  /**
   * Why the block cannot take an RSVP, undefined when it can:
   * - "no-record": no event is picked;
   * - "data": an event is picked and the Events data is missing or malformed;
   * - "record": the picked event is not in it (unpublished, deleted, or not
   *   public).
   */
  unavailable: undefined | "no-record" | "data" | "record";
  /** The event is over: its end time, or its start time with no end, is past. */
  ended: boolean;
  /** The event is full and has no waitlist, so it takes no more RSVPs. */
  full: boolean;
};

const isPast = (time: string | null, now: Date) => {
  if (time === null) {
    return false;
  }
  // a time that cannot be read is not past
  return Date.parse(time) < now.getTime();
};

/** Finds the block's event in the Events data by `record`. */
export const resolveRsvpEvent = (
  record: unknown,
  data: unknown,
  now: Date
): RsvpEventResolution => {
  const eventId =
    typeof record === "string" && record.trim() !== ""
      ? record.trim()
      : undefined;
  // With no event picked the Events data is not read at all.
  if (eventId === undefined) {
    return {
      event: undefined,
      unavailable: "no-record",
      ended: false,
      full: false,
    };
  }
  const events = parseEventsData(data);
  if (events === undefined) {
    return { event: undefined, unavailable: "data", ended: false, full: false };
  }
  // the first event with the id is the block's
  const event = events.find((item) => item.id === eventId);
  if (event === undefined) {
    return {
      event: undefined,
      unavailable: "record",
      ended: false,
      full: false,
    };
  }
  return {
    event,
    unavailable: undefined,
    ended: isPast(event.endTime ?? event.startTime, now),
    full: event.full && event.waitlist === false,
  };
};
