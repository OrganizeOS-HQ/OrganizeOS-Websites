/**
 * The fundraisers of a `GET /v1/fundraisers` body (`{ data: [...] }`), the
 * org's public campaigns, plus its drafts under a builder preview (OrganizeOS
 * builder donations spec 2026-11-13, 6.1 and 6.2): as Goal Progress reads them
 * and as the builder's Give to rows list them. Lenient: an entry with no
 * string id, a blank or padded id, or an id already listed is skipped, and
 * odd figures read as none. Anything that is not such a body (an error body,
 * `{}`, the text of an HTML page) is undefined, so a caller can tell "no
 * body" from "no fundraisers".
 *
 * Its own export (`@organizeos/site-components/fundraisers-data`), so the
 * builder reads it without the package's components or templates.
 */
export type Fundraiser = {
  id: string;
  title: string;
  /** Integer cents above 0, or null for a fundraiser with no goal. */
  goalCents: number | null;
  raisedCents: number;
  donorCount: number;
  currency: string;
  /** Listed only under a verified builder preview. */
  draft: boolean;
};

export const untitledFundraiser = "Untitled fundraiser";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export const parseFundraisersData = (
  body: unknown
): Fundraiser[] | undefined => {
  if (isRecord(body) === false || Array.isArray(body.data) === false) {
    return;
  }
  const seen = new Set<string>();
  const fundraisers: Fundraiser[] = [];
  for (const entry of body.data as unknown[]) {
    if (isRecord(entry) === false) {
      continue;
    }
    const { id, title } = entry;
    if (
      typeof id !== "string" ||
      id === "" ||
      id.trim() !== id ||
      seen.has(id)
    ) {
      continue;
    }
    seen.add(id);
    const goal = entry.goal_amount_cents;
    fundraisers.push({
      id,
      title:
        typeof title === "string" && title.trim() !== ""
          ? title
          : untitledFundraiser,
      goalCents: isCount(goal) && goal > 0 ? goal : null,
      raisedCents: isCount(entry.raised_amount_cents)
        ? entry.raised_amount_cents
        : 0,
      donorCount: isCount(entry.donor_count) ? entry.donor_count : 0,
      currency:
        typeof entry.currency === "string" && entry.currency !== ""
          ? entry.currency
          : "USD",
      draft: entry.draft === true,
    });
  }
  return fundraisers;
};

/** The fundraiser a block's record names, by its trimmed id. */
export const findFundraiser = (
  list: readonly Fundraiser[],
  record: unknown
): Fundraiser | undefined => {
  const id = typeof record === "string" ? record.trim() : "";
  if (id === "") {
    return;
  }
  return list.find((item) => item.id === id);
};
