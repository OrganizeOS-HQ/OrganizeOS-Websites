import { nanoid } from "nanoid";
import {
  type DataSource,
  type Instance,
  type Resource,
  type Resources,
  type WebstudioData,
  type WebstudioFragment,
  encodeDataSourceVariable,
} from "@webstudio-is/sdk";
import { builderApi } from "~/shared/builder-api";
import { platformName } from "~/shared/branding";
import {
  FORMS_PRESET_NAME,
  getResourcePresetIds,
} from "~/shared/organizeos-preset-ids";
import { $organizeosSite } from "~/shared/nano-states";
import { $project, $resources } from "~/shared/sync/data-stores";
import {
  type Insertable,
  getComponentTemplateData,
  insertWebstudioFragmentAt,
} from "~/shared/instance-utils/insert";
import { getInstanceLabel } from "~/builder/shared/instance-label";

/**
 * Inserting an OrganizeOS block (spec section 4.3). A template cannot know a
 * project's catalog ids, so the block is completed at insert time: it brings
 * its own binding, a resource DataSource scoped to the block's root that
 * references the project's Forms catalog Resource, and its root's `data` prop
 * is bound to that binding by id. The Forms Resource is added when the
 * project lacks it, from the Events Resource that provisioning wrote. Click
 * (the OrganizeOS panel) and drop (the canvas's drag and drop) both insert
 * through here.
 *
 * Webstudio loads a resource DataSource, in the builder and on a published
 * page, only when its scope is on the page, so the forms load on the pages
 * that have a block and nowhere else.
 */

/** The namespace the blocks are registered under (canvas.tsx). */
export const organizeosNamespace = "@organizeos/site-components";

export const isOrganizeosBlock = (component: string) =>
  component.startsWith(`${organizeosNamespace}:`);

// Blocks whose root reads the org's published forms through its `data` prop.
const formsBlocks = new Set([`${organizeosNamespace}:SignupForm`]);

type PresetIds = { resourceId: string; bindingId: string };

export type OrganizeosPresetIds = { events: PresetIds; forms: PresetIds };

export const getOrganizeosPresetIds = async (
  projectId: string
): Promise<OrganizeosPresetIds> => {
  const [events, forms] = await Promise.all([
    getResourcePresetIds(projectId, "events"),
    getResourcePresetIds(projectId, "forms"),
  ]);
  return { events, forms };
};

const isBlankExpression = (expression: string) => {
  try {
    const value: unknown = JSON.parse(expression);
    return typeof value === "string" && value.trim() === "";
  } catch {
    return expression.trim() === "";
  }
};

const findAuthorizationHeader = (resource: Resource) =>
  resource.headers.find(
    (header) =>
      header.name.toLowerCase() === "authorization" &&
      isBlankExpression(header.value) === false
  );

/**
 * The Forms endpoint next to the Events one. Provisioning writes the Events
 * URL as a string literal, `"<API base>/events"`; anything else is not a URL
 * this can derive from.
 */
const getFormsUrl = (eventsUrl: string) => {
  let url: unknown;
  try {
    url = JSON.parse(eventsUrl);
  } catch {
    return;
  }
  if (typeof url !== "string" || url.endsWith("/events") === false) {
    return;
  }
  return JSON.stringify(`${url.slice(0, -"/events".length)}/forms`);
};

export type OrganizeosBlockCompletion =
  | { status: "refused" }
  | {
      status: "ready";
      fragment: WebstudioFragment;
      // For a block that reads the org's forms: the Forms catalog Resource
      // its binding references, and that Resource when the project lacks it.
      forms?: { resourceId: Resource["id"]; resource?: Resource };
    };

/**
 * Complete a block's template fragment against the project's catalog. Pure:
 * reads the given map, returns the fragment to insert and what the insert
 * adds with it (completeOrganizeosInsertMutable), never touches a store.
 */
export const completeOrganizeosFragment = ({
  fragment,
  presetIds,
  resources,
}: {
  fragment: WebstudioFragment;
  presetIds: OrganizeosPresetIds;
  resources: Resources;
}): OrganizeosBlockCompletion => {
  const rootChild = fragment.children.find((child) => child.type === "id");
  const root = fragment.instances.find(
    (instance) => instance.id === rootChild?.value
  );
  if (root === undefined || formsBlocks.has(root.component) === false) {
    return { status: "ready", fragment };
  }

  // The Events Resource, found by its id and never by name, is the project's
  // link to the org's data: its API base and its read token. Without it, or
  // without the token, a Forms Resource could not authenticate, so nothing is
  // written and the admin is told who can restore it.
  const events = resources.get(presetIds.events.resourceId);
  const authorization =
    events === undefined ? undefined : findAuthorizationHeader(events);
  if (events === undefined || authorization === undefined) {
    return { status: "refused" };
  }

  // Find or create the Forms Resource by the id provisioning gives it, in the
  // shape provisioning writes (buildOrgResourcePresets), so a re-provision
  // rewrites this same Resource instead of adding a second one.
  const { forms } = presetIds;
  let formsResource: undefined | Resource;
  if (resources.has(forms.resourceId) === false) {
    const url = getFormsUrl(events.url);
    if (url === undefined) {
      return { status: "refused" };
    }
    formsResource = {
      id: forms.resourceId,
      name: FORMS_PRESET_NAME,
      method: "get",
      url,
      headers: [{ name: "Authorization", value: authorization.value }],
    };
  }

  // The root's `data` is bound by the insert, to the block's own binding;
  // any binding the template made (by name) is dropped.
  return {
    status: "ready",
    fragment: {
      ...fragment,
      props: fragment.props.filter(
        (prop) => prop.instanceId !== root.id || prop.name !== "data"
      ),
    },
    forms: { resourceId: forms.resourceId, resource: formsResource },
  };
};

/**
 * What a completion adds, written into the insert's own transaction once the
 * block's root has its id there: the Forms Resource when the project still
 * lacks it (one that appeared meanwhile is kept, never replaced), a resource
 * DataSource with a fresh id scoped to the block's root that references it,
 * and the root's `data` bound to that DataSource's `.data` by id, the
 * `{ data: [...] }` body of GET /v1/forms, so no variable that shares its name
 * captures it at insert (copies are another matter: see the known limits).
 */
export const completeOrganizeosInsertMutable = (
  data: Pick<WebstudioData, "resources" | "dataSources" | "props">,
  completion: Extract<OrganizeosBlockCompletion, { status: "ready" }>,
  rootId: undefined | Instance["id"]
) => {
  const { forms } = completion;
  if (forms === undefined || rootId === undefined) {
    return;
  }
  if (
    forms.resource !== undefined &&
    data.resources.has(forms.resourceId) === false
  ) {
    data.resources.set(forms.resourceId, forms.resource);
  }
  const binding: DataSource = {
    type: "resource",
    id: nanoid(),
    scopeInstanceId: rootId,
    name: FORMS_PRESET_NAME,
    resourceId: forms.resourceId,
  };
  data.dataSources.set(binding.id, binding);
  for (const prop of data.props.values()) {
    if (prop.instanceId === rootId && prop.name === "data") {
      data.props.delete(prop.id);
    }
  }
  const dataProp = {
    id: nanoid(),
    instanceId: rootId,
    name: "data",
    type: "expression" as const,
    value: `${encodeDataSourceVariable(binding.id)}.data`,
  };
  data.props.set(dataProp.id, dataProp);
};

/**
 * Whether the org behind this project may use the blocks: it is on the
 * rollout allowlist (`ORGANIZEOS_BLOCKS_ORG_IDS`, resolved by the builder's
 * loader into `$organizeosSite`).
 */
export const isOrganizeosBlocksEnabled = () =>
  $organizeosSite.get()?.blocksEnabled === true;

/**
 * Insert a block at the selection, or at `insertable` (a drop), the way the
 * Components panel inserts a template, after completing it, in one
 * transaction. Refuses with a toast, writing nothing, when the org is not on
 * the blocks' allowlist or the project's data is not connected.
 */
export const insertOrganizeosBlock = async (
  component: string,
  insertable?: Insertable
): Promise<boolean> => {
  const project = $project.get();
  if (project === undefined) {
    return false;
  }
  const label = getInstanceLabel({ component });
  if (isOrganizeosBlocksEnabled() === false) {
    builderApi.toast.error(
      `Cannot add ${label}: ${platformName} blocks are not available for this site yet.`
    );
    return false;
  }
  let presetIds: OrganizeosPresetIds;
  try {
    presetIds = await getOrganizeosPresetIds(project.id);
  } catch (error) {
    console.error(error);
    builderApi.toast.error(`Cannot add ${label}.`);
    return false;
  }

  const completion = completeOrganizeosFragment({
    fragment: getComponentTemplateData(component),
    presetIds,
    resources: $resources.get(),
  });
  if (completion.status === "refused") {
    // Opening the builder re-syncs membership only, and nothing in the
    // Website area re-provisions an enabled builder, so support restores it.
    builderApi.toast.error(
      `Cannot add ${label}: this site's link to your organization's data was removed or changed. Contact ${platformName} support to restore it.`
    );
    return false;
  }

  const rootChild = completion.fragment.children.find(
    (child) => child.type === "id"
  );
  // Through the same transaction as any insert, so it syncs and undoes as
  // one step, and writes nothing when the block has no place to go.
  return insertWebstudioFragmentAt(completion.fragment, insertable, undefined, {
    onInsert: (data, newInstanceIds) => {
      completeOrganizeosInsertMutable(
        data,
        completion,
        rootChild === undefined
          ? undefined
          : newInstanceIds.get(rootChild.value)
      );
    },
  });
};
