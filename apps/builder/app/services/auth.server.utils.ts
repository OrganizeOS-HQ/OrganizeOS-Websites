export type SessionData = {
  userId: string;
  createdAt: number;
  // OrganizeOS: the OrganizeOS session (GoTrue session id) and user that
  // opened this builder session through SSO. Absent for every other login.
  // Checked on each read by auth-strategy/organizeos-session.server.ts.
  organizeosSid?: string;
  organizeosUserId?: string;
};

export const getSessionCookieNameVersion = () => {
  // IMPORTANT: If you see an error here, you need to increase the version number.
  // Explanation:
  // Changing the SessionData type will cause all existing user sessions to not work as expected.
  // There is no logic to validate or clean up sessions, so we avoid session migration issues by changing the session cookie name.
  // This ensures that old sessions are invalidated and new sessions are created with the updated structure.
  const obj: SessionData = { userId: "", createdAt: 0 };
  obj.userId = "";

  // IMPORTANT: Change version in the SaaS platform as well!
  // IMPORTANT: Changing the version will cause all users to be logged out.
  // OrganizeOS: a fork-distinct version (the session gained organizeosSid and
  // organizeosUserId), so upstream's own next bump never reads our cookies
  // under its shape. Renames both cookies: every builder user signs in again
  // once, through OrganizeOS.
  return "4-organizeos";
};
