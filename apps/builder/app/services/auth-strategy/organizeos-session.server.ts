import { authenticator } from "~/services/auth.server";
import { builderAuthenticator } from "~/services/builder-auth.server";
import type { SessionData } from "~/services/auth.server.utils";
import { checkOrganizeosBindingClaims } from "./organizeos-binding.server";

// The check itself lives in a leaf module, so a reader that is not a session
// read (the collab writer) can call it without the Authenticators.
export {
  checkOrganizeosBinding,
  checkOrganizeosBindingClaims,
  resetOrganizeosBindingCache,
  type OrganizeosBindingDecision,
  type OrganizeosBindingDeps,
  type OrganizeosBindingMode,
  type OrganizeosBindingOutcome,
} from "./organizeos-binding.server";

/**
 * OrganizeOS session binding.
 *
 * A builder session opened through OrganizeOS SSO carries the OrganizeOS
 * session (`organizeosSid`, a GoTrue session id) and user (`organizeosUserId`)
 * that opened it. Every session read goes through `readDashboardSession` or
 * `readBuilderSession`, which ask OrganizeOS whether that session is still
 * live (`websites2_sso_session_live`, service-role only, with a 12-hour idle
 * bound). A builder session therefore lives no longer than the OrganizeOS
 * session that minted it: sign-out, a revoked session or an idle browser ends
 * it within a minute (the cache in `organizeos-binding.server.ts`).
 *
 * `ORGANIZEOS_SESSION_BINDING=observe` (default) logs every outcome but `live`
 * and allows; `enforce` reads `missing`, `dead` and `error` as no session.
 * Error fails closed under `enforce`: the builder reads the same database for
 * everything, so an outage that breaks the check breaks the builder anyway.
 *
 * RECURSION TRAP: this module and the binding module must never call
 * `createContext` or import `~/shared/context.server`. `createContext` reads
 * the session through `extractAuthFromRequest`, which calls the readers here.
 * The RPC therefore goes through the binding module's own PostgREST client.
 */

const applyBinding = async (
  sessionData: SessionData | null
): Promise<SessionData | null> => {
  if (sessionData == null) {
    return null;
  }
  const { allow } = await checkOrganizeosBindingClaims(
    sessionData.userId,
    sessionData.organizeosSid,
    sessionData.organizeosUserId
  );
  // A refused binding is no session. The cookie is not rewritten here: the
  // login page leads back to OrganizeOS, and a new SSO entry replaces it.
  return allow ? sessionData : null;
};

/** The dashboard session (the builder's own origin), binding checked. */
export const readDashboardSession = async (
  request: Request
): Promise<SessionData | null> =>
  applyBinding(await authenticator.isAuthenticated(request));

/** The project-host (`p-<projectId>`) session, binding checked. */
export const readBuilderSession = async (
  request: Request
): Promise<SessionData | null> =>
  applyBinding(await builderAuthenticator.isAuthenticated(request));
