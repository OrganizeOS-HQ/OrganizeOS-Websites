/**
 * OrganizeOS fork: the placeholder modules the route templates import and
 * prebuild resolves, declared as upstream declares its own
 * (@webstudio-is/react-sdk/placeholder), so the templates typecheck here,
 * where no site's app/__organizeos__/ exists.
 *
 * __ORGANIZEOS_PAGE__ is the copy of @organizeos/site-components' page module
 * (ORGANIZEOS_PAGE_PLACEHOLDER in organizeos-components.ts).
 * organizeos-components.test.ts checks that the build exports every name
 * declared here.
 */
declare module "__ORGANIZEOS_PAGE__" {
  export const PageShareCodeCarrier: () => null;
}
