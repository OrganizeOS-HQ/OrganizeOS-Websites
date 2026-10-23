import { expect, test } from "vitest";
import events from "../__fixtures__/events.json";
import { parseEventsData, resolveRsvpEvent } from "./events-data";

const [voterDrive, phoneBank, cookout, canvassLaunch, rally] = events.data;

// the fixtures' dates are real ones, so the tests pin the clock they read
const now = new Date("2026-10-21T12:00:00Z");

test("reads every event of the events.json fixture", () => {
  const parsed = parseEventsData(events);
  expect(parsed?.map((event) => event.id)).toEqual(
    events.data.map((event) => event.id)
  );
  expect(parsed?.map((event) => event.timezone)).toEqual(
    events.data.map((event) => event.timezone)
  );
  expect(parsed?.map((event) => event.title)).toEqual(
    events.data.map((event) => event.title)
  );
});

test("reads an event's registration details: the waitlist, fullness, guests, shifts with roles and questions", () => {
  const parsed = parseEventsData(events) ?? [];
  const find = (id: string) => parsed.find((event) => event.id === id);

  expect(find(rally.id)).toMatchObject({
    waitlist: false,
    full: true,
    maxGuests: 0,
    shifts: [],
    questions: [],
  });
  expect(find(phoneBank.id)).toMatchObject({ waitlist: true, full: false });
  // a null end_time is kept as null
  expect(find(cookout.id)).toMatchObject({
    startTime: cookout.start_time,
    endTime: null,
  });

  const launch = find(canvassLaunch.id);
  expect(launch).toMatchObject({
    startTime: "2026-11-21T15:00:00+00:00",
    endTime: "2026-11-21T22:00:00+00:00",
    timezone: "America/Denver",
    waitlist: true,
    full: false,
    maxGuests: 3,
  });
  expect(launch?.shifts).toEqual([
    {
      id: "0e4b9a27-c561-4d83-b7f0-3a9d2c8e5b14",
      title: "Morning canvass",
      description: null,
      startTime: "2026-11-21T15:00:00+00:00",
      endTime: "2026-11-21T18:00:00+00:00",
      full: true,
      roles: [],
    },
    {
      id: "5d73c1e9-0a2f-4b68-8e45-b7c0f9a1d326",
      title: "Afternoon canvass",
      description: "Doors in the afternoon, with a driver for each turf.",
      startTime: "2026-11-21T19:00:00+00:00",
      endTime: "2026-11-21T22:00:00+00:00",
      full: false,
      roles: [
        {
          id: "17d9f3a6-b204-4c5e-91a8-e6f0c3b75d20",
          name: "Canvasser",
          description: "Knock doors in pairs.",
          full: false,
        },
        {
          id: "6c0a8e41-3f97-4d1b-b5e2-9a7d4c1f8036",
          name: "Driver",
          description: null,
          full: true,
        },
      ],
    },
  ]);
  expect(launch?.questions.map((question) => question.type)).toEqual([
    "text",
    "textarea",
    "number",
    "date",
    "select",
    "multiselect",
    "checkbox",
  ]);
  expect(launch?.questions[1]).toEqual({
    id: "73e1a9c5-8b02-4f6d-9d37-c4b0e5a1f892",
    label: "Anything we should know?",
    helpText: "Access needs, dietary needs, or anything else.",
    type: "textarea",
    required: false,
    options: [],
  });
  expect(launch?.questions[4]).toMatchObject({
    type: "select",
    required: true,
    options: ["S", "M", "L", "XL"],
  });
});

test("an event with its registration details resolves by record", () => {
  expect(resolveRsvpEvent(canvassLaunch.id, events, now)).toMatchObject({
    event: { id: canvassLaunch.id, title: "Saturday Canvass Launch" },
    unavailable: undefined,
    ended: false,
    full: false,
  });
  // the record is trimmed, as the Signup Form's is
  expect(resolveRsvpEvent(`  ${phoneBank.id}\n`, events, now).event?.id).toBe(
    phoneBank.id
  );
});

test("an event is ended once its end time, or its start time with no end, is past", () => {
  expect(resolveRsvpEvent(voterDrive.id, events, now).ended).toBe(true);
  expect(resolveRsvpEvent(phoneBank.id, events, now).ended).toBe(false);
  // a running event is not ended
  const running = new Date("2026-11-21T20:00:00Z");
  expect(resolveRsvpEvent(canvassLaunch.id, events, running).ended).toBe(false);
  // the end is not yet past at the end time itself
  const endsAt = Date.parse("2026-11-21T22:00:00Z");
  expect(canvassLaunch.end_time).toBe("2026-11-21T22:00:00+00:00");
  expect(
    resolveRsvpEvent(canvassLaunch.id, events, new Date(endsAt)).ended
  ).toBe(false);
  expect(
    resolveRsvpEvent(canvassLaunch.id, events, new Date(endsAt + 1)).ended
  ).toBe(true);
  // no end time: the start time decides
  expect(resolveRsvpEvent(cookout.id, events, now).ended).toBe(false);
  expect(
    resolveRsvpEvent(cookout.id, events, new Date("2026-11-14T02:00:01Z")).ended
  ).toBe(true);
  // a time that cannot be read is not past
  const unreadable = {
    data: [{ id: "e1", start_time: "someday", end_time: null }],
  };
  expect(resolveRsvpEvent("e1", unreadable, now).ended).toBe(false);
  const noTimes = { data: [{ id: "e1" }] };
  expect(resolveRsvpEvent("e1", noTimes, now).ended).toBe(false);
});

test("an event is full for the form only when it has no waitlist", () => {
  expect(resolveRsvpEvent(rally.id, events, now).full).toBe(true);
  expect(resolveRsvpEvent(canvassLaunch.id, events, now).full).toBe(false);
  const withWaitlist = { data: [{ ...rally, waitlist: true }] };
  expect(resolveRsvpEvent(rally.id, withWaitlist, now).full).toBe(false);
  const fullEvent = { data: [{ id: "e1", full: true }] };
  expect(resolveRsvpEvent("e1", fullEvent, now).full).toBe(true);
  // strict, as the DTO is: only `true` counts
  const looselyFull = { data: [{ id: "e1", full: "true", waitlist: 0 }] };
  expect(resolveRsvpEvent("e1", looselyFull, now).full).toBe(false);
});

test("no record is unavailable as no-record, and data is not read", () => {
  for (const data of [
    undefined,
    null,
    "events",
    [],
    {},
    { data: {} },
    events,
  ]) {
    for (const record of [undefined, null, "", "  ", 7]) {
      expect(resolveRsvpEvent(record, data, now)).toEqual({
        event: undefined,
        unavailable: "no-record",
        ended: false,
        full: false,
      });
    }
  }
});

test("a record with missing or malformed data is unavailable as data", () => {
  for (const data of [undefined, null, "events", [], {}, { data: {} }]) {
    expect(resolveRsvpEvent(canvassLaunch.id, data, now)).toEqual({
      event: undefined,
      unavailable: "data",
      ended: false,
      full: false,
    });
  }
});

test("a record missing from data is unavailable as record", () => {
  expect(
    resolveRsvpEvent("00000000-0000-4000-8000-000000000000", events, now)
  ).toEqual({
    event: undefined,
    unavailable: "record",
    ended: false,
    full: false,
  });
  expect(
    resolveRsvpEvent(canvassLaunch.id, { data: [] }, now).unavailable
  ).toBe("record");
});

test("the first event with the record's id is the block's", () => {
  const data = {
    data: [
      { id: "e1", title: "First" },
      { id: "e1", title: "Second" },
    ],
  };
  expect(resolveRsvpEvent("e1", data, now).event?.title).toBe("First");
});

test("reads leniently: unknown keys are ignored and entries without a string id skipped", () => {
  const data = {
    data: [
      "not an event",
      null,
      { id: 7, title: "Numeric id" },
      { title: "No id" },
      {
        id: "e1",
        title: "Later DTO",
        added_later: { nested: true },
        timezone: "America/Chicago",
        start_time: "2026-11-05T23:00:00+00:00",
      },
    ],
  };
  expect(parseEventsData(data)?.map((event) => event.id)).toEqual(["e1"]);
  expect(parseEventsData(data)?.[0]).toMatchObject({
    id: "e1",
    title: "Later DTO",
    timezone: "America/Chicago",
  });
});

test("an event with nothing but an id reads as an event with nothing", () => {
  expect(parseEventsData({ data: [{ id: "e1" }] })).toEqual([
    {
      id: "e1",
      title: "",
      startTime: null,
      endTime: null,
      timezone: null,
      waitlist: false,
      full: false,
      maxGuests: 0,
      shifts: [],
      questions: [],
    },
  ]);
});

test("a malformed body is no data", () => {
  for (const data of [undefined, null, "events", 3, [], {}, { data: {} }]) {
    expect(parseEventsData(data)).toBeUndefined();
  }
  expect(parseEventsData({ data: [] })).toEqual([]);
});

test("reads shifts, roles and questions leniently", () => {
  const data = {
    data: [
      {
        id: "e1",
        shifts: [
          "not a shift",
          { title: "No id" },
          {
            id: "s1",
            title: "Setup",
            start_time: 5,
            added_later: true,
            roles: [
              7,
              { name: "No id" },
              { id: "r1", name: "Lead", description: "Runs it", full: true },
              { id: "r2", name: 7, full: "yes" },
            ],
          },
          { id: "s2", roles: "none" },
        ],
        questions: [
          "not a question",
          { label: "No id", type: "text" },
          {
            id: "q1",
            label: "Pick",
            type: "select",
            required: true,
            options: ["A", 2, null, "B"],
          },
          // a type this build does not know renders as text
          { id: "q2", label: "Later", type: "rating", options: "x" },
          { id: "q3", type: "checkbox", help_text: 4 },
        ],
      },
    ],
  };
  const [event] = parseEventsData(data) ?? [];
  expect(event.shifts).toEqual([
    {
      id: "s1",
      title: "Setup",
      description: null,
      startTime: null,
      endTime: null,
      full: false,
      roles: [
        { id: "r1", name: "Lead", description: "Runs it", full: true },
        { id: "r2", name: "", description: null, full: false },
      ],
    },
    {
      id: "s2",
      title: "",
      description: null,
      startTime: null,
      endTime: null,
      full: false,
      roles: [],
    },
  ]);
  expect(event.questions).toEqual([
    {
      id: "q1",
      label: "Pick",
      helpText: null,
      type: "select",
      required: true,
      options: ["A", "B"],
    },
    {
      id: "q2",
      label: "Later",
      helpText: null,
      type: "text",
      required: false,
      options: [],
    },
    {
      id: "q3",
      label: "",
      helpText: null,
      type: "checkbox",
      required: false,
      options: [],
    },
  ]);
});

test("the guest allowance is a whole number from 0 to the endpoint's 10", () => {
  const maxGuestsOf = (value: unknown) =>
    parseEventsData({ data: [{ id: "e1", max_guests: value }] })?.[0].maxGuests;
  expect(maxGuestsOf(3)).toBe(3);
  expect(maxGuestsOf(10)).toBe(10);
  expect(maxGuestsOf(25)).toBe(10);
  for (const value of [0, -1, 2.5, "3", null, undefined, Number.NaN]) {
    expect(maxGuestsOf(value)).toBe(0);
  }
});
