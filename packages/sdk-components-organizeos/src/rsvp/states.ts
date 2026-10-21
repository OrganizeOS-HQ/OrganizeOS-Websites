/**
 * The RSVP Form's states. Its `state` prop and `onStateChange` action use
 * these names, and the template's state boxes show on them.
 */
export const rsvpFormStates = [
  "initial",
  "submitting",
  "registered",
  "waitlisted",
  "full",
  "ended",
  "error",
  "unavailable",
] as const;

export type RsvpFormState = (typeof rsvpFormStates)[number];

/** The endpoint the RSVP Form posts to, on the page's own origin. */
export const rsvpsPath = "/api/public/site/v1/rsvps";
