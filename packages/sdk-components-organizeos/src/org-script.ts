/**
 * Whether an org's own script may run on its Website: HTML Embeds, Content
 * Embeds, Markdown Embeds, the SVG `animate` and `set` elements, and the
 * site-wide custom code. It is off (owner decision, 2026-10-21); what orgs
 * saved is kept, and each org's next publish ships it again once this is on.
 *
 * Turn it on only when both hold (docs/ORGANIZEOS-FORK.md section 10):
 * - org sites are served from {sub}.organizeos.io and the old
 *   {sub}.organizeos.org hosts only redirect (org sites domain step C2);
 * - the platform session is host-only on app.organizeos.org (step D), so the
 *   builder canvas, which stays under organizeos.org, never receives it.
 *
 * It is a constant, not an environment variable: the builder and the CLI read
 * it at the same commit, and a missing or mistyped value cannot fail open.
 * Turning it on is a reviewed change that also edits its test.
 */
export const orgScriptMayRun = (): boolean => false;

/**
 * The SVGs that upstream's own templates put in an HTML Embed (Accordion,
 * Checkbox, Dialog, Navigation Menu, Popover, Radio Group, Select, Sheet,
 * YouTube and Vimeo). They are literal copies, not imports: a project keeps the
 * string it was inserted with, so an upstream change to an icon adds the new
 * string here and never removes the old one. Each is one fixed `<svg>` of
 * paths (the spinner adds a `<style>` of keyframes) with no script, handler,
 * link, `use` or `foreignObject`, and org-script.test.ts keeps it that way.
 */
export const templateIconCodes: ReadonlySet<string> = new Set([
  // CheckMarkIcon
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="100%" height="100%" style="display: block;"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.091" d="m13.636 3.667-8 8L2 8.03"/></svg>',
  // ChevronDownIcon
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="100%" height="100%" style="display: block;"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m4 6 4 4 4-4"/></svg>',
  // DotIcon
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="100%" height="100%" style="display: block;"><path fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></svg>',
  // LargeXIcon
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="100%" height="100%" style="display: block;"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M12.5 3 3 12.5M3 3l9.5 9.5"/></svg>',
  // MenuIcon
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="100%" height="100%" style="display: block;"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M2.667 8h10.666M2.667 4h10.666M2.667 12h10.666"/></svg>',
  // PlayIcon
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="100%" height="100%" style="display: block;"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m4 2 9.333 6L4 14V2Z"/></svg>',
  // SpinnerIcon
  '<svg xmlns="http://www.w3.org/2000/svg" id="c765c5cf3__e2CRglijn891" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" viewBox="0 0 128 128" fill="currentColor" width="100%" height="100%" style="display: block;"><style>@keyframes e2CRglijn892_tr__tr{0%{transform:translate(64px,64px) rotate(90deg);animation-timing-function:cubic-bezier(.42,0,.58,1)}50%{transform:translate(64px,64px) rotate(810deg);animation-timing-function:cubic-bezier(.42,0,.58,1)}to{transform:translate(64px,64px) rotate(1530deg)}}@keyframes e2CRglijn892_s_p{0%,to{stroke:#39fbbb}25%{stroke:#4a4efa}50%{stroke:#e63cfe}75%{stroke:#ffae3c}}@keyframes e2CRglijn892_s_do{0%{stroke-dashoffset:251.89}2.5%,52.5%{stroke-dashoffset:263.88;animation-timing-function:cubic-bezier(.42,0,.58,1)}25%,75%{stroke-dashoffset:131.945}to{stroke-dashoffset:251.885909}}#c765c5cf3__e2CRglijn892_tr{animation:e2CRglijn892_tr__tr 3000ms linear infinite normal forwards}#c765c5cf3__e2CRglijn892{animation-name:e2CRglijn892_s_p,e2CRglijn892_s_do;animation-duration:3000ms;animation-fill-mode:forwards;animation-timing-function:linear;animation-direction:normal;animation-iteration-count:infinite}</style><g id="c765c5cf3__e2CRglijn892_tr" transform="translate(64,64) rotate(90)"><circle id="c765c5cf3__e2CRglijn892" r="42" fill="none" stroke="#39fbbb" stroke-dasharray="263.89" stroke-dashoffset="251.89" stroke-linecap="round" stroke-width="16" transform="scale(-1,1) translate(0,0)"/></g></svg>',
]);

/**
 * Whether an HTML Embed with this `code` may run. Only a static string that
 * is byte-identical to a template icon may, unless the switch is on. A value
 * that is not a string is never an icon, even one that becomes an icon string
 * (`String(["<svg…>"])`): upstream's HTML Embed coerces whatever it is given
 * with `String(code)` and writes it into the page.
 */
export const htmlEmbedCodeMayRun = (
  code: unknown,
  mayRun: boolean = orgScriptMayRun()
): boolean =>
  mayRun || (typeof code === "string" && templateIconCodes.has(code));
