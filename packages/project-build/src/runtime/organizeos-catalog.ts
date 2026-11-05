// OrganizeOS fork (docs/ORGANIZEOS-FORK.md section 9, "Catalog Resources
// outlive their bindings"). Provisioning seeds an org's data catalog Resources
// under ids derived as RFC 4122 v5 UUIDs; Webstudio's own ids are nanoids. A
// catalog Resource is shared by every block and page that binds it, so the
// runtime never deletes one with a binding, and resources.delete refuses one.
//
// A copy of isPresetId in apps/builder/app/shared/organizeos-preset-ids.ts,
// which this package cannot import; organizeos-preset-ids.node.test.ts pins
// the two to agree.
const UUID_V5_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const isOrganizeosCatalogResourceId = (id: string): boolean =>
  UUID_V5_RE.test(id);
