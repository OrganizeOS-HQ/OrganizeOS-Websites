/**
 * `ReactSdkContext.renderer`: "canvas" and "preview" are the builder, which
 * runs on the builder's origin; undefined is a published site.
 */
export type Renderer = "canvas" | "preview" | undefined;

/** The builder never submits: a block there shows its states and never posts. */
export const isBuilderRender = (renderer: Renderer) =>
  renderer === "canvas" || renderer === "preview";

/** A role an event still has room in, as a `role_full` answer lists it. */
export type OpenRole = { id: string; name: string };

/**
 * What a platform endpoint answered: `{ outcome }` on success, `{ error,
 * field?, openRoles? }` on failure. A network failure or an answer this build
 * cannot read is an error too.
 *
 * `openRoles` is a `role_full` answer's `open_roles`. It is undefined when the
 * answer carries none, and an empty list when the answer says that no role has
 * room: the two are not the same.
 */
export type PlatformAnswer =
  | { outcome: string }
  | { error: string; field?: string; openRoles?: OpenRole[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

/**
 * Reads `open_roles` leniently, since a published site keeps this code while
 * the platform moves on. Anything that is not a list is no answer at all
 * (undefined). In a list, an entry without a non-empty string `id` and a
 * string `name` is skipped, and only those two keys are kept: the list is
 * `[{ id, name }]` by contract and anything else in an entry is not ours. So a
 * list with no readable entry is an empty list, which says no role has room.
 */
const readOpenRoles = (value: unknown): OpenRole[] | undefined => {
  if (Array.isArray(value) === false) {
    return;
  }
  const roles: OpenRole[] = [];
  for (const entry of value as unknown[]) {
    if (
      isRecord(entry) &&
      typeof entry.id === "string" &&
      entry.id !== "" &&
      typeof entry.name === "string"
    ) {
      roles.push({ id: entry.id, name: entry.name });
    }
  }
  return roles;
};

const readAnswer = async (response: Response): Promise<PlatformAnswer> => {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  if (isRecord(payload)) {
    if (response.ok && typeof payload.outcome === "string") {
      return { outcome: payload.outcome };
    }
    if (typeof payload.error === "string") {
      const answer: PlatformAnswer = { error: payload.error };
      if (typeof payload.field === "string") {
        answer.field = payload.field;
      }
      const openRoles = readOpenRoles(payload.open_roles);
      if (openRoles !== undefined) {
        answer.openRoles = openRoles;
      }
      return answer;
    }
  }
  return { error: "unreadable_answer" };
};

/**
 * Posts a JSON body to a platform endpoint on the page's own origin. Every
 * org host reserves `/api` for OrganizeOS, so the request reaches the
 * platform, never the published site.
 *
 * Returns undefined, without posting, on the builder's canvas and preview.
 * Never throws: a failure comes back as an error answer.
 */
export const postToPlatform = async ({
  renderer,
  path,
  body,
}: {
  renderer: Renderer;
  path: string;
  body: unknown;
}): Promise<PlatformAnswer | undefined> => {
  if (isBuilderRender(renderer)) {
    return;
  }
  // Same origin only: an absolute path, never a URL or a protocol-relative one.
  if (path.startsWith("/") === false || path.startsWith("//")) {
    return { error: "invalid_path" };
  }
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    return await readAnswer(response);
  } catch {
    return { error: "network" };
  }
};

/** How a family turns answers into its states. */
export type AnswerStates<State extends string> = {
  /** The outcomes this build knows, and the state each one shows. */
  outcomes: Readonly<Record<string, State>>;
  /** The family's success state, for an outcome this build does not know. */
  success: State;
  /**
   * The state of an error code this build knows, such as a family that shows
   * its own state for a full or an ended event. Optional: without it, or for
   * a code it does not list, an error maps to `error`.
   */
  errors?: Readonly<Record<string, State>>;
  /** The family's error state, for every error this build has no state for. */
  error: State;
};

/**
 * Maps an answer to a state. A published site freezes this code, so an
 * outcome the platform adds later lands in the family's success state and an
 * error it adds later in its error state. `field` names the field an
 * `invalid_field` error is about. `openRoles` passes on a `role_full`
 * answer's list of roles with room, when it has one.
 */
export const stateForAnswer = <State extends string>(
  answer: PlatformAnswer,
  states: AnswerStates<State>
): { state: State; field?: string; openRoles?: OpenRole[] } => {
  if ("outcome" in answer) {
    const known = Object.hasOwn(states.outcomes, answer.outcome)
      ? states.outcomes[answer.outcome]
      : undefined;
    return { state: known ?? states.success };
  }
  const known =
    states.errors !== undefined && Object.hasOwn(states.errors, answer.error)
      ? states.errors[answer.error]
      : undefined;
  const result: { state: State; field?: string; openRoles?: OpenRole[] } = {
    state: known ?? states.error,
  };
  if (answer.error === "invalid_field" && answer.field !== undefined) {
    result.field = answer.field;
  }
  if (answer.openRoles !== undefined) {
    result.openRoles = answer.openRoles;
  }
  return result;
};
