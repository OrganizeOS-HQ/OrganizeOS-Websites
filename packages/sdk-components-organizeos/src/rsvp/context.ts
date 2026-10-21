import { createContext, useContext } from "react";
import type { RsvpEvent } from "./events-data";

/**
 * What the RSVP Form's composite parts (Guests, Shift Options, Questions and
 * Email Consent) read from their root, besides the `FormRootContext` every
 * part shares (the field messages, the state, the registry).
 */
export type RsvpContextValue = {
  /** The block's event, undefined while it cannot be found. */
  event: RsvpEvent | undefined;
  /**
   * The roles a `role_full` answer found without room, by id: the chosen role
   * and every other role of its shift that the answer does not list as open.
   * Shift Options disables them on top of the roles the event data marks full.
   * Only an answer to a request without guests puts anything here: with guests
   * the platform measured the roles' room for the whole party, which says
   * nothing of the visitor alone.
   */
  fullRoleIds: ReadonlySet<string>;
  /**
   * The roles a `role_full` answer listed as having room, by id. The event data
   * is a snapshot that can be a minute old and the answer reflects the moment
   * of the post, so a role the data marks full has room again when it is in
   * here. Shift Options disables a role when `fullRoleIds` has it, or when the
   * data marks it full and `openRoleIds` lacks it. Only a readable list of the
   * shift's open roles puts anything here.
   */
  openRoleIds: ReadonlySet<string>;
};

export const RsvpContext = createContext<RsvpContextValue | undefined>(
  undefined
);

/** The closest RSVP Form's event and role state, undefined outside one. */
export const useRsvpContext = () => useContext(RsvpContext);

// What each composite part's `collect` returns, which the root reads by shape
// and puts in the body. The root reads them as `unknown` and keeps only what
// the endpoint takes, so a part that returns more costs nothing.

/** A guest the visitor named: two names, as the endpoint takes. */
export type CollectedGuest = { first_name: string; last_name: string };

/** What Guests collects: the rows that are not entirely blank. */
export type CollectedGuests = CollectedGuest[];

/** What Shift Options collects: the shifts ticked and the role chosen in a single one. */
export type CollectedShifts = {
  shift_ids: string[];
  shift_role_id?: string;
};

/**
 * What Questions collects: the answers by question id, serialized as Website
 * Lite sends them (a multiselect as a JSON array of strings, a checkbox as
 * "true" or "false", anything else as typed) with one difference, a number
 * typed with an exponent, which is written out as a plain decimal because the
 * strict endpoint refuses an exponent. The blank optional ones are left out.
 */
export type CollectedAnswers = Record<string, string>;

/**
 * The most characters of an answer the endpoint's body takes. Questions bounds
 * the answers it collects to it (a number is the one it cannot cut), and the
 * root checks the answers it is handed against it before posting.
 */
export const maxAnswerLength = 5000;

/** What Email Consent collects: whether the box is checked. */
export type CollectedConsent = boolean;
