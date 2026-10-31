import {
  $,
  PageValue,
  css,
  type TemplateStyleDecl,
} from "@webstudio-is/template";
import { type PlatformPath, isPlatformPath } from "../platform-paths";
import type { PageContext } from "../types";
import {
  BREAKPOINT,
  type KitStyle,
  SPACE,
  focusRing,
  fontWeight,
  tapTarget,
} from "./layout";

// The kit's links and buttons, shared by the nav, the footer and the
// templates' own buttons: where a link goes and how it looks.

/**
 * A link to one of the template's pages by its key, to an element of the
 * same page by an in-page anchor (`#sign-up`), or to a route the platform
 * serves on the site's own host by its path (`/donate`, PLATFORM_PATHS).
 */
export type SiteLink =
  | { label: string; pageKey: string }
  | { label: string; href: `#${string}` | PlatformPath };

/** A page's id as a link target; a key the template lacks fails its check. */
export const pageHref = (
  pageIds: PageContext["pageIds"],
  pageKey: string
): PageValue => new PageValue(pageIds[pageKey]);

/**
 * A Link's props for where it goes: `href`, its page's id or its anchor or
 * path as a plain string; and for a platform path `reloadDocument`, since the
 * published site's router has no route there and would show its own 404.
 */
export const linkProps = (
  pageIds: PageContext["pageIds"],
  link: SiteLink
): { href: PageValue | string; reloadDocument?: true } => {
  if ("href" in link === false) {
    return { href: pageHref(pageIds, link.pageKey) };
  }
  return isPlatformPath(link.href)
    ? { href: link.href, reloadDocument: true }
    : { href: link.href };
};

/**
 * The Link's "Current page" state, written as its meta writes it so the
 * Style panel offers it (a quoted value would be another state).
 */
const currentPage = "[aria-current=page]";

/**
 * A plain text link in the surrounding colour, underlined on hover and when
 * it is the current page.
 */
export const textLinkStyles = (): TemplateStyleDecl[] => [
  ...tapTarget(),
  ...css`
    color: inherit;
    text-decoration-line: none;
    text-underline-offset: 4px;
    &:hover {
      text-decoration-line: underline;
    }
    &${currentPage} {
      text-decoration-line: underline;
    }
  `,
  ...focusRing(),
];

/**
 * A text link to `link`; `key` only quiets React's list check. `styles` adds
 * to the link's own, as the nav's spacing does.
 */
export const textLink = (
  pageIds: PageContext["pageIds"],
  link: SiteLink,
  key: number,
  styles: TemplateStyleDecl[] = []
): JSX.Element => (
  <$.Link
    key={key}
    {...linkProps(pageIds, link)}
    ws:style={[...textLinkStyles(), ...styles]}
  >
    {link.label}
  </$.Link>
);

/**
 * A button: a link filled with accent-1 and labelled in base (a checked
 * pair), at least 44px tall, with the template's corners and label weight.
 */
export const buttonStyles = ({
  buttonRadius,
  buttonWeight,
}: KitStyle = {}): TemplateStyleDecl[] => [
  ...tapTarget(),
  ...css`
    justify-content: center;
    padding-left: ${SPACE[24]};
    padding-right: ${SPACE[24]};
    background-color: var(--accent-1);
    color: var(--base);
    text-decoration-line: none;
    ${BREAKPOINT.landscape} {
      padding-left: ${SPACE[16]};
      padding-right: ${SPACE[16]};
    }
  `,
  ...(buttonRadius === undefined
    ? []
    : css`
        border-radius: ${buttonRadius};
      `),
  ...fontWeight(buttonWeight),
  ...focusRing(),
];
