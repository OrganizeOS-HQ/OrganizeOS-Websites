/**
 * The collection the manager last showed, per project, in this browser
 * (spec 5.3). Storage that is blocked or full reads as nothing remembered and
 * writes nothing.
 */

const keyOf = (projectId: string) =>
  `organizeos:variables:collection:${projectId}`;

export const readSelectedCollection = (
  projectId: string
): string | undefined => {
  try {
    return localStorage.getItem(keyOf(projectId)) ?? undefined;
  } catch {
    return;
  }
};

export const writeSelectedCollection = (projectId: string, id: string) => {
  try {
    localStorage.setItem(keyOf(projectId), id);
  } catch {
    // nothing remembered
  }
};
