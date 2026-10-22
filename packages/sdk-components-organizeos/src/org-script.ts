import { elementComponent, tags } from "@webstudio-is/sdk";

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

/**
 * The SVG elements that can set an attribute of their parent from markup, so
 * `<a><animate attributeName="href" values="javascript:…"/></a>` makes a
 * `javascript:` link that no attribute check sees (SMIL). `animateTransform`
 * and `animateMotion` cannot set an arbitrary attribute and stay.
 */
export const pausedSvgTags: ReadonlySet<string> = new Set(["animate", "set"]);

/**
 * Props that put raw markup on a page without an HTML Embed. React writes the
 * value of `dangerouslySetInnerHTML` (an object holding `__html`, from a JSON
 * value or an expression) into any element as markup, and neither the props
 * panel, the component generator nor the canvas filters it. Publishing drops
 * these props while the switch is off, and the canvas skips them.
 */
export const pausedPropNames: ReadonlySet<string> = new Set([
  "dangerouslySetInnerHTML",
]);

/**
 * Whether a prop of this name may reach an element. Not one that writes raw
 * markup into it (`pausedPropNames`), unless the switch is on.
 */
export const propNameMayRun = (
  name: string,
  mayRun: boolean = orgScriptMayRun()
): boolean => mayRun || pausedPropNames.has(name) === false;

const offeredTags: ReadonlySet<string> = new Set(tags);

/**
 * Whether an element may be created with this tag. Only a string that is
 * exactly one of the tags the builder offers (`tags` of `@webstudio-is/sdk`,
 * the list the Tag control shows and HTML paste filters on), unless the switch
 * is on. `script` is not one, nor is any other spelling of it: React hoists a
 * `<script async src>` into the document's `<head>` and runs it, creates a
 * `SCRIPT` as a live element, and the generator writes a tag that is JSX
 * syntax into the page module as code. A value that is not a string is never a
 * tag, even one that becomes a tag string.
 *
 * Publishing applies it to every tag it can read (`classify` in the CLI's
 * `organizeos-org-script.ts`), and the canvas to every tag it renders, whether
 * it comes from `instance.tag`, `data-ws-tag` or a `tag` prop, held by the
 * component that makes the element or by one that passes its props to it
 * (`checksTagProp`), so an expression that evaluates to `"script"` is caught as
 * well.
 */
export const elementTagMayRun = (
  tag: unknown,
  mayRun: boolean = orgScriptMayRun()
): boolean => mayRun || (typeof tag === "string" && offeredTags.has(tag));

/**
 * The props that choose the element of the component that reads them: Box, Text
 * and Heading read `data-ws-tag` (`tagProperty` of `@webstudio-is/sdk/runtime`,
 * which a test pins) before their legacy `tag` prop, and Radix's DialogTitle
 * renders `<Tag>` from `tag` with no check. The component generator also writes
 * `instance.tag` under the first name on every component but `ws:element`.
 *
 * Reading the prop is not the only way it reaches an element. Radix's triggers
 * (Collapsible, Dialog, Popover and Tooltip triggers, and Navigation Menu's
 * link and trigger) render `<Primitive.Trigger asChild {...props}>`, and
 * Radix's Slot merges those props onto the first child, which may be a Box,
 * Text or Heading that makes its element from them. So these names are held to
 * `elementTagMayRun` on every component that is not `ws:element` or in
 * `anyTagComponents`, wherever the prop sits.
 */
export const tagPropNames: readonly string[] = ["data-ws-tag", "tag"];

/**
 * The components that take any tag name by design, so the tag rule leaves their
 * `tag` alone. XML Node (category xml) writes the tag as the name of an XML
 * element (`urlset`, `url`, `loc`, `xhtml:link` in a sitemap) and adds a suffix
 * that no HTML element has, so it never makes a `script`. Its other risks are
 * not this rule's: "XML Node in an HTML page" is a path docs/ORGANIZEOS-FORK.md
 * section 10 lists as not covered by this pause.
 */
export const anyTagComponents: ReadonlySet<string> = new Set(["XmlNode"]);

/**
 * Whether the tag of an instance of this component (`instance.tag`) must be one
 * the builder offers: every component but XML Node. On `ws:element` it is the
 * element itself, and on the others it is written as `data-ws-tag`, where the
 * component or the child it passes its props to may make an element of it.
 */
export const checksInstanceTag = (component: string): boolean =>
  anyTagComponents.has(component) === false;

/**
 * Whether a prop of this name on this component must hold a tag the builder
 * offers: `data-ws-tag` and `tag` on every component but `ws:element` (an
 * attribute there, on an element that is already made) and XML Node.
 */
export const checksTagProp = (component: string, name: string): boolean =>
  component !== elementComponent &&
  checksInstanceTag(component) &&
  tagPropNames.includes(name);

/**
 * The props without a `data-ws-tag` or `tag` that is not a tag the builder
 * offers, for a component that creates an element, or passes its props to a
 * child that does. The same object when nothing goes, and never a changed
 * input. The canvas uses it on what a component receives after its parent's
 * props are merged in, so a tag a Radix trigger passes down is checked as well.
 */
export const withoutBlockedTagProps = <Props extends Record<string, unknown>>(
  component: string,
  props: Props,
  mayRun: boolean = orgScriptMayRun()
): Props => {
  if (mayRun) {
    return props;
  }
  let result = props;
  for (const name of tagPropNames) {
    if (
      name in props &&
      checksTagProp(component, name) &&
      elementTagMayRun(props[name], mayRun) === false
    ) {
      if (result === props) {
        result = { ...props };
      }
      delete result[name];
    }
  }
  return result;
};
