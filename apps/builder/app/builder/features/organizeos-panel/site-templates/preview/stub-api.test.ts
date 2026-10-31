import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { answerStubRequest, sampleEvents } from "./stub-api.mjs";

// The preview tool's stub of the OrganizeOS public API
// (scripts/preview-site-template.mjs): three sample events for the events
// read, so a template's preview shows its event cards, and an empty list for
// every other read, or for the events read too under --no-events.

const apiBaseUrl = "http://127.0.0.1:4599/api/public/v1";

const siteTemplates = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../../../packages/sdk-components-organizeos/src/site-templates"
);
/** The stub's own fallback cover. */
const spikeHero = join(siteTemplates, "__fixtures__/spike/images/hero.jpg");

/**
 * Bytes as their digest: a failed comparison of two images prints two short
 * strings, not a diff of hundreds of thousands of numbers.
 */
const digest = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

const answer = (path: string, events: "sample" | "none" = "sample") =>
  answerStubRequest(path, { apiBaseUrl, events });

const json = async (path: string, events?: "sample" | "none") => {
  const { status, contentType, body } = await answer(path, events);
  expect(status).toBe(200);
  expect(contentType).toBe("application/json");
  return JSON.parse(String(body));
};

/** An instant's day of the month in a zone, as the Time element reads it. */
const dayIn = (instant: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, day: "numeric" }).format(
    new Date(instant)
  );

describe("the stub API", () => {
  const events = sampleEvents(apiBaseUrl);

  test("answers the events read, upcoming or not, with the sample events", async () => {
    expect(await json("/api/public/v1/events?upcoming=true")).toEqual({
      data: events,
    });
    expect(await json("/api/public/v1/events")).toEqual({ data: events });
    expect(events).toHaveLength(3);
  });

  test("answers the forms read and every other read with no data", async () => {
    expect(await json("/api/public/v1/forms")).toEqual({ data: [] });
    expect(await json("/api/public/v1/forms?type=signup")).toEqual({
      data: [],
    });
    expect(await json("/api/public/v1/collections/news/items")).toEqual({
      data: [],
    });
    expect(await json("/api/public/v1/events/a-slug")).toEqual({ data: [] });
  });

  test("under --no-events answers the events read with no data too", async () => {
    expect(await json("/api/public/v1/events?upcoming=true", "none")).toEqual({
      data: [],
    });
    expect(await json("/api/public/v1/forms", "none")).toEqual({ data: [] });
  });

  // As the platform returns them: the Event Card shows the first.
  test("the events are in ascending order of start", () => {
    const starts = events.map((event) => Date.parse(event.start_time));
    expect(starts.every((start) => Number.isNaN(start) === false)).toBe(true);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  test("the dates are fixed, in two zones", () => {
    expect(sampleEvents(apiBaseUrl)).toEqual(events);
    expect(new Set(events.map((event) => event.timezone))).toEqual(
      new Set(["America/New_York", "America/Los_Angeles"])
    );
    for (const event of events) {
      expect(event.start_time).toMatch(
        /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00$/
      );
    }
  });

  // A card that reads the instant in UTC, not the event's zone, shows the
  // wrong day number for this one.
  test("an evening event in Los Angeles falls on the next day in UTC", () => {
    const crossing = events.filter(
      (event) =>
        event.timezone === "America/Los_Angeles" &&
        dayIn(event.start_time, event.timezone) !==
          dayIn(event.start_time, "UTC")
    );
    expect(crossing).toHaveLength(1);
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: crossing[0].timezone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(crossing[0].start_time));
    expect(Number(hour)).toBeGreaterThanOrEqual(17);
  });

  test("titles and places are bracketed sample text, and one event has no place", () => {
    for (const event of events) {
      expect(event.title).toMatch(/^\[.+\]$/);
      if (event.location_name !== null) {
        expect(event.location_name).toMatch(/^\[.+\]$/);
      }
    }
    expect(events.filter((event) => event.location_name === null)).toHaveLength(
      1
    );
  });

  test("one event has a cover image the stub serves itself, two have none", async () => {
    const covers = events.flatMap((event) =>
      event.cover_image_url === null ? [] : [event.cover_image_url]
    );
    expect(covers).toHaveLength(1);
    const cover = new URL(covers[0]);
    expect(cover.origin).toBe(new URL(apiBaseUrl).origin);
    const image = await answer(`${cover.pathname}${cover.search}`);
    expect(image.status).toBe(200);
    expect(image.contentType).toBe("image/jpeg");
    // a JPEG's start-of-image marker
    expect(Array.from(image.body.slice(0, 2) as Uint8Array)).toEqual([
      0xff, 0xd8,
    ]);
  });

  // The script gives the stub the previewed template's preview event cover
  // (a file, or none), so the first card shows one of the template's own
  // photos; with none, the spike fixture's picture. The files here are temp
  // files, so no template's photos are read.
  describe("the first event's cover", () => {
    const coverPath = () => {
      const [cover] = events.flatMap((event) =>
        event.cover_image_url === null ? [] : [new URL(event.cover_image_url)]
      );
      return cover.pathname;
    };
    const read = (previewEventCover?: string) =>
      answerStubRequest(coverPath(), {
        apiBaseUrl,
        events: "sample",
        previewEventCover,
      });
    /** Runs `check` with a temp file of `bytes` named `name`. */
    const withFile = async (
      name: string,
      bytes: Uint8Array,
      check: (path: string) => Promise<void>
    ) => {
      const folder = await mkdtemp(join(tmpdir(), "stub-api-"));
      try {
        const path = join(folder, name);
        await writeFile(path, bytes);
        await check(path);
      } finally {
        await rm(folder, { recursive: true, force: true });
      }
    };
    // a JPEG's start-of-image marker, then bytes of its own
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

    test("is the template's preview event cover", async () => {
      await withFile("cover.jpg", jpeg, async (path) => {
        const cover = await read(path);
        expect(cover.contentType).toBe("image/jpeg");
        expect(digest(cover.body)).toBe(digest(jpeg));
      });
    });

    test("is the spike fixture's picture when the template names none", async () => {
      const cover = await read(undefined);
      expect(cover.contentType).toBe("image/jpeg");
      expect(digest(cover.body)).toBe(digest(await readFile(spikeHero)));
    });

    test("is served as its file's type", async () => {
      const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
      await withFile("cover.png", png, async (path) => {
        expect((await read(path)).contentType).toBe("image/png");
      });
    });
  });

  // The fields of a `GET /v1/events` item the Event List, the Event Card and
  // the RSVP Form read (rsvp/events-data.ts in the blocks package).
  test("each event carries the fields the events blocks and the RSVP Form read", () => {
    for (const event of events) {
      expect(event).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          slug: expect.stringMatching(/^[a-z0-9-]+$/),
          start_time: expect.any(String),
          end_time: expect.any(String),
          timezone: expect.any(String),
          waitlist: false,
          full: false,
          max_guests: expect.any(Number),
          shifts: [],
          questions: [],
        })
      );
      expect(Object.hasOwn(event, "location_name")).toBe(true);
      expect(Object.hasOwn(event, "cover_image_url")).toBe(true);
    }
    expect(new Set(events.map((event) => event.id)).size).toBe(3);
  });
});
