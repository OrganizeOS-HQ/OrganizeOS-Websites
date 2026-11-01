import type { WebstudioData } from "@webstudio-is/sdk";
import { createPages } from "../../../../../../../packages/project-build/src/template";
import { buildOrgResourcePresets } from "~/shared/db/resource-presets.server";
import { mergeSignupFormIntoBuild } from "~/shared/db/signup-form-preset.server";
import { getOrganizeosPresetIds } from "../insert-organizeos-block";

/**
 * A project as provisioning leaves it: `createPages()` (Home and the 404
 * page), the catalog Resources seeded on every provision (the first block that
 * reads Forms or Upcoming Events creates it) and the seeded sign-up page. What
 * a site template is applied to, in the apply's tests and in the preview
 * tool's dump.
 */
export const createProvisionedProject = async ({
  projectId,
  apiBaseUrl,
  readToken,
}: {
  projectId: string;
  apiBaseUrl: string;
  readToken: string;
}): Promise<WebstudioData> => {
  const presetIds = await getOrganizeosPresetIds(projectId);
  const { resources: catalog } = await buildOrgResourcePresets({
    projectId,
    apiBaseUrl,
    readToken,
  });
  const data = createPages();
  const seeded = await mergeSignupFormIntoBuild(
    {
      instances: [...data.instances.values()],
      props: [...data.props.values()],
      dataSources: [...data.dataSources.values()],
      resources: catalog.filter(
        (resource) =>
          resource.id !== presetIds.forms.resourceId &&
          resource.id !== presetIds.upcomingEvents.resourceId
      ),
      pages: data.pages,
    },
    { projectId, apiBaseUrl, readToken }
  );
  const byId = <Item extends { id: string }>(items: Item[]) =>
    new Map(items.map((item) => [item.id, item]));
  return {
    ...data,
    instances: byId(seeded.instances),
    props: byId(seeded.props),
    dataSources: byId(seeded.dataSources),
    resources: byId(seeded.resources),
    pages: seeded.pages,
  };
};
