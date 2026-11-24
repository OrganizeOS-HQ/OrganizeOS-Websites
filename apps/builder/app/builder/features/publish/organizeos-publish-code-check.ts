import type {
  DataSource,
  Instance,
  Pages,
  Prop,
  Resource,
} from "@webstudio-is/sdk";
import {
  checkCustomCodeNames,
  findCodeCheckFailure,
  pagesToCheck,
} from "@organizeos/site-components/org-script";

/**
 * OrganizeOS fork: the Publish dialog checks the build it holds with the same
 * input validation prebuild runs (code-check.ts in
 * @organizeos/site-components), so a value prebuild would refuse is named
 * here instead of in a run log the builder never sees. One line naming the
 * page or element and the field, or undefined when everything passes.
 *
 * `customCode` is the site's custom code exactly as prebuild would compile it,
 * passed only when it would ship (embeds may ship and it is not blank). Its
 * tag and attribute names are checked as prebuild checks them
 * (custom-code-names.ts).
 */
export const findPublishBlocker = ({
  pages,
  instances,
  props,
  resources,
  dataSources,
  customCode,
}: {
  pages: Pages | undefined;
  instances: Map<Instance["id"], Instance>;
  props: Map<Prop["id"], Prop>;
  resources: Map<Resource["id"], Resource>;
  dataSources: Map<DataSource["id"], DataSource>;
  customCode?: string;
}): string | undefined => {
  const failure = findCodeCheckFailure({
    pages: pages === undefined ? [] : pagesToCheck(pages),
    instances: instances.values(),
    props: props.values(),
    resources: resources.values(),
    dataSources: dataSources.values(),
  });
  if (failure === undefined) {
    if (customCode !== undefined) {
      const names = checkCustomCodeNames(customCode);
      if (names.ok === false) {
        return `Can't publish: Custom code, "${names.name}".`;
      }
    }
    return;
  }
  const { place, field, reason } = failure;
  let name = "a data resource";
  if (place.type === "page") {
    const page =
      pages?.pages.get(place.id) ?? pages?.pageTemplates?.get(place.id);
    name = `page "${page?.name ?? place.id}"`;
  }
  if (place.type === "instance") {
    const instance = instances.get(place.id);
    const component = instance?.component.split(":").at(-1);
    name = `"${instance?.label || component || place.id}"`;
  }
  return `Can't publish: the ${field} of ${name}. ${reason}.`;
};
