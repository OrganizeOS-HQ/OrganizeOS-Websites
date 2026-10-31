// The names a page's top-level sections go by in the Navigator (OrganizeOS
// spec 2026-10-30-website-template-inventory-design.md, section 3). A page's
// body holds nothing but sections, each labelled with one of these, so the
// Navigator reads the same on every template and a member finds "Events" or
// "Sign-up" by name. checkSiteTemplate holds every template to it.

export const SECTION_LABELS = [
  "Page header",
  "Hero",
  "About",
  "Mission and values",
  "Spotlight",
  "Stats",
  "Issues or programs",
  "Team or leadership",
  "FAQ",
  "Resources",
  "Endorsements and testimonials",
  "Updates or news",
  "Logo wall",
  "Events",
  "Sign-up",
  "Call to action band",
  "Volunteer opportunities",
  "Donate",
  "Join or become a member",
  "Shop",
  "Contact",
  // Short forms: the Navigator shows a label whole, and "Issues or programs"
  // reads badly where a template has only one of the two.
  "Issues",
  "Programs",
  "Team",
  "Leadership",
  "Endorsements",
  "Testimonials",
  "Updates",
  "News",
  "Join",
  // The kit's top bar and bottom bar.
  "Nav",
  "Footer",
] as const;

/**
 * Whether `label` is a section name, or one followed by a variant after a
 * colon (`Hero: Split`, `Nav: Centered`, `Events: Featured`).
 */
export const isSectionLabel = (label: string): boolean =>
  SECTION_LABELS.some(
    (name) => label === name || label.startsWith(`${name}: `)
  );
