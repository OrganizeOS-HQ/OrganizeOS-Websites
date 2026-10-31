// The routes the platform serves on a site's own host, which a template links
// to by path and never has a page at (OrganizeOS docs/features/
// website-builder.md, the transactional flows). A published site's router has
// no route there, so a link to one is a document navigation
// (`reloadDocument`), as the Event Card's link to `/events/{slug}` is; any
// other page is linked by its key. More join as a template needs them.

export const PLATFORM_PATHS = ["/donate"] as const;

export type PlatformPath = (typeof PLATFORM_PATHS)[number];

export const isPlatformPath = (href: string): href is PlatformPath =>
  (PLATFORM_PATHS as readonly string[]).includes(href);
