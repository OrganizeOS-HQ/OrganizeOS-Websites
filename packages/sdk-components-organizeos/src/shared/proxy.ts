import { createProxy } from "@webstudio-is/template";

/** Namespaced components for templates, e.g. `<organizeos.SignupForm>`. */
export const organizeos = createProxy("@organizeos/site-components:");

/**
 * Upstream's Radix components by their registered names, for a template that
 * builds on them (as upstream's own templates proxy theirs). Only the names:
 * a template importing this pulls no Radix code into the package.
 */
export const radix = createProxy("@webstudio-is/sdk-components-react-radix:");
