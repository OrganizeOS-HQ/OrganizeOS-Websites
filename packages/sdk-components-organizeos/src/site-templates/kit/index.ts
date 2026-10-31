// The layout kit (website templates wave 1, Task A2): the measurements and
// the shared pieces every template is built from. Each piece is a function
// that returns fresh JSX, since the renderer keys instances by element
// identity. Imported by the templates, not re-exported by the site-templates
// module.

export {
  BREAKPOINT,
  CONTAINER,
  FOCUS_RING_VARIABLE,
  SPACE,
  type ContainerWidth,
  type KitStyle,
  type SectionBackground,
  container,
  focusRing,
  section,
  tapTarget,
} from "./layout";
export {
  type SiteLink,
  buttonStyles,
  linkProps,
  textLinkStyles,
} from "./links";
export { type NavVariant, nav } from "./nav";
export { type FooterColumn, footer } from "./footer";
export { contentBlock } from "./content-block";
export { keyed, text } from "./elements";
export { sample } from "./sample";
