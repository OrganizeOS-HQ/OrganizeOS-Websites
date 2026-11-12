import { toast } from "@webstudio-is/design-system";

/**
 * Whether a manager write landed; a refused one says why in a toast, for a
 * control with no field of its own to show the reason in.
 */
export const landed = (
  result: { ok: true } | { ok: false; error: string }
): boolean => {
  if (result.ok === false) {
    toast.error(result.error);
  }
  return result.ok;
};
