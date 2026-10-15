import { nanoid } from "nanoid";
import {
  type DataSource,
  type DataSources,
  type Page,
  type Resource,
  ROOT_INSTANCE_ID,
} from "@webstudio-is/sdk";
import { $selectedPage } from "~/shared/nano-states";
import {
  findAvailableVariables,
  rebindTreeVariablesMutable,
} from "~/shared/data-variables";
import { updateWebstudioData } from "~/shared/instance-utils/data";
import { isOrganizeosBlocksEnabled } from "./insert-organizeos-block";

/**
 * The OrganizeOS panel's Data section: the org's catalog (Events, Fundraisers,
 * Stats, each public collection, and Forms and Upcoming Events once a block
 * has added them), one row per Resource, each with "Add to this page".
 *
 * Data loads only where it is used. A catalog Resource loads nowhere by
 * itself: Webstudio loads a resource DataSource only when its scope is an
 * instance on the page or `:root`. Adding a Resource to a page gives that page
 * its own binding, scoped to the page's root, which the data panel then lists
 * on every element of the page and the builder loads while the page is open,
 * as a published site loads it on that page alone.
 */

/**
 * Whether the page already has the Resource page-wide: a binding to it scoped
 * to the page's root, or one at `:root` (which older provisioning wrote for
 * Forms). A block's own binding is scoped to the block and does not count.
 */
export const isCatalogResourceOnPage = ({
  page,
  dataSources,
  resourceId,
}: {
  page: Pick<Page, "rootInstanceId">;
  dataSources: DataSources;
  resourceId: Resource["id"];
}) => {
  for (const dataSource of dataSources.values()) {
    if (
      dataSource.type === "resource" &&
      dataSource.resourceId === resourceId &&
      (dataSource.scopeInstanceId === page.rootInstanceId ||
        dataSource.scopeInstanceId === ROOT_INSTANCE_ID)
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Add a catalog Resource to the selected page: a resource DataSource with a
 * fresh id, named like the Resource (or "<name> 2", and so on, when a variable
 * visible at the page root, its own or `:root`'s, has that name), scoped to
 * the page's root and referencing the Resource by id. Decided inside the
 * transaction, so a page that already has it (see isCatalogResourceOnPage)
 * gets no second one. Returns whether it added one.
 *
 * Known limit: two builder tabs that add the same Resource at once both pass
 * that check against their own state, and single-player sync refuses the
 * second tab's save as a version mismatch, so only with multiplayer on could
 * both be saved as two page-root bindings.
 */
export const addCatalogResourceToPage = (resourceId: Resource["id"]) => {
  const page = $selectedPage.get();
  if (page === undefined || isOrganizeosBlocksEnabled() === false) {
    return false;
  }
  let added = false;
  updateWebstudioData((data) => {
    const resource = data.resources.get(resourceId);
    if (
      resource === undefined ||
      isCatalogResourceOnPage({
        page,
        dataSources: data.dataSources,
        resourceId,
      })
    ) {
      return;
    }
    // Expressions resolve variables by name, and the rebinding below re-resolves
    // the page's by name: a binding on the page root masks every variable of
    // that name visible there, a page-root one and a `:root` one alike, and
    // would capture the expressions that read it. So the new binding takes the
    // first name no variable visible at the page root has ("Events 2"), as the
    // data panel names a duplicate.
    const taken = new Set(
      findAvailableVariables({
        startingInstanceId: page.rootInstanceId,
        instances: data.instances,
        dataSources: data.dataSources,
      }).map((item) => item.name)
    );
    let name = resource.name;
    for (let suffix = 2; taken.has(name); suffix += 1) {
      name = `${resource.name} ${suffix}`;
    }
    const binding: DataSource = {
      type: "resource",
      id: nanoid(),
      scopeInstanceId: page.rootInstanceId,
      name,
      resourceId,
    };
    data.dataSources.set(binding.id, binding);
    // as the data panel does when it adds a variable
    rebindTreeVariablesMutable({
      startingInstanceId: page.rootInstanceId,
      ...data,
    });
    added = true;
  });
  return added;
};
