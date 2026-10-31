// OrganizeOS fork: the preview tool's stub of the OrganizeOS public API
// (scripts/preview-site-template.mjs, which serves it on a fixed port). The
// published site's loader reads the catalog Resources from it, so a
// template's preview shows its event cards with three sample events, the
// first with the previewed template's preview event cover, or the empty
// state under --no-events. Every other read, the forms among them, is an org
// with no data. Plain JavaScript, so the script runs it with node alone;
// stub-api.test.ts holds it to that.

import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The cover when the template names no preview event cover: the spike
 * fixture's picture, an original abstract image (OrganizeOS's own work). A path, not `new URL(path, import.meta.url)`, which Vite turns into
 * a dev server URL under the test.
 */
const fallbackCoverImage = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../../../packages/sdk-components-organizeos/src/site-templates/__fixtures__/spike/images/hero.jpg"
);

/** A cover file's content type, by its extension. */
const imageTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const coverPath = "/sample-events/cover.jpg";

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   slug: string,
 *   description: string | null,
 *   start_time: string,
 *   end_time: string,
 *   timezone: string,
 *   event_type: string | null,
 *   location_type: string | null,
 *   location_name: string | null,
 *   city: string | null,
 *   state: string | null,
 *   capacity: number | null,
 *   rsvp_count: number,
 *   cover_image_url: string | null,
 *   featured_image_url: string | null,
 *   latitude: number | null,
 *   longitude: number | null,
 *   url: string,
 *   waitlist: boolean,
 *   full: boolean,
 *   max_guests: number,
 *   registration_deadline: string | null,
 *   shifts: unknown[],
 *   questions: unknown[],
 * }} SampleEvent
 */

/**
 * Three upcoming events as `GET /v1/events` returns them: in ascending order
 * of start, so the Event Card's one (the first) is the earliest; fixed dates
 * in two zones, one an evening in Los Angeles that is the next day in UTC, so
 * a card that read the wrong zone would show the wrong day number; bracketed
 * sample titles and places; one with a cover image the stub serves, and one
 * with no place. Each carries the fields the events blocks and the RSVP Form
 * read.
 *
 * @param {string} apiBaseUrl the stub's API base, whose origin serves the cover
 * @returns {SampleEvent[]}
 */
export const sampleEvents = (apiBaseUrl) => {
  const { origin } = new URL(apiBaseUrl);
  /**
   * @param {Pick<SampleEvent, "id" | "title" | "slug" | "start_time" | "end_time" | "timezone" | "location_type" | "location_name" | "cover_image_url">} event
   * @returns {SampleEvent}
   */
  const sample = (event) => ({
    description: "[Say in a sentence or two what happens at the event.]",
    event_type: null,
    city: null,
    state: null,
    capacity: null,
    rsvp_count: 0,
    featured_image_url: null,
    latitude: null,
    longitude: null,
    url: `${origin}/events/${event.slug}`,
    waitlist: false,
    full: false,
    max_guests: 0,
    registration_deadline: null,
    shifts: [],
    questions: [],
    ...event,
  });
  return [
    // Saturday 6 March 2027, 10:00 in New York (EST)
    sample({
      id: "00000000-0000-4000-8000-00000000a701",
      title: "[Spring neighborhood cleanup]",
      slug: "spring-neighborhood-cleanup",
      start_time: "2027-03-06T15:00:00+00:00",
      end_time: "2027-03-06T18:00:00+00:00",
      timezone: "America/New_York",
      location_type: "in_person",
      location_name: "[Riverside Park, north gate]",
      cover_image_url: `${origin}${coverPath}`,
    }),
    // Thursday 11 March 2027, 18:30 in Los Angeles (PST): 12 March in UTC
    sample({
      id: "00000000-0000-4000-8000-00000000a702",
      title: "[Tenants' meeting]",
      slug: "tenants-meeting",
      start_time: "2027-03-12T02:30:00+00:00",
      end_time: "2027-03-12T04:00:00+00:00",
      timezone: "America/Los_Angeles",
      location_type: "in_person",
      location_name: "[Community center, room 2]",
      cover_image_url: null,
    }),
    // Saturday 20 March 2027, 13:00 in New York (EDT), online
    sample({
      id: "00000000-0000-4000-8000-00000000a703",
      title: "[Phone bank for the spring drive]",
      slug: "phone-bank-spring-drive",
      start_time: "2027-03-20T17:00:00+00:00",
      end_time: "2027-03-20T19:00:00+00:00",
      timezone: "America/New_York",
      location_type: "online",
      location_name: null,
      cover_image_url: null,
    }),
  ];
};

/**
 * The stub's answer to a request, by its path and query (`request.url`):
 * the events read (`/events`, with or without `?upcoming=true`) gets the
 * sample events, or none when `events` is "none"; the sample cover is the
 * template's preview event cover (`previewEventCover`, its file), else the
 * spike fixture's picture; anything else, the forms read among them, is
 * `{"data": []}`.
 *
 * @param {string} requestUrl
 * @param {{ apiBaseUrl: string, events: "sample" | "none", previewEventCover?: string }} options
 * @returns {Promise<{ status: number, contentType: string, body: string | Uint8Array }>}
 */
export const answerStubRequest = async (
  requestUrl,
  { apiBaseUrl, events, previewEventCover }
) => {
  const base = new URL(apiBaseUrl);
  const { pathname } = new URL(requestUrl, base.origin);
  if (pathname === coverPath) {
    const coverImage = previewEventCover ?? fallbackCoverImage;
    return {
      status: 200,
      contentType:
        imageTypes.get(extname(coverImage).toLowerCase()) ??
        "application/octet-stream",
      body: await readFile(coverImage),
    };
  }
  const data =
    pathname === `${base.pathname}/events` && events === "sample"
      ? sampleEvents(apiBaseUrl)
      : [];
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data }),
  };
};
