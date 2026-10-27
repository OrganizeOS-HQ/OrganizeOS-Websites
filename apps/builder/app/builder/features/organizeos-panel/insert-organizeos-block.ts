import { nanoid } from "nanoid";
import { showAttribute } from "@webstudio-is/react-sdk";
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
  EVENTS_BINDING_NAME,
  FORMS_PRESET_KEY,
  FORMS_PRESET_NAME,
  UPCOMING_EVENTS_BINDING_NAME,
  UPCOMING_EVENTS_PRESET_KEY,
  UPCOMING_EVENTS_RESOURCE_NAME,
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
 * references one of the project's catalog Resources (Forms, Events or Upcoming
 * Events), and the props its table entry names are bound to that binding by
 * id. The Forms and Upcoming Events Resources are added when the project
 * lacks them, from the Events Resource that provisioning wrote. Click and
 * Enter (the Components panel's OrganizeOS section) and drop (the canvas's
 * drag and drop) all insert through here.
 *
 * Webstudio loads a resource DataSource, in the builder and on a published
 * page, only when its scope is on the page, so the data loads on the pages
 * that have a block and nowhere else.
 */

/** The namespace the blocks are registered under (canvas.tsx). */
export const organizeosNamespace = "@organizeos/site-components";

export const isOrganizeosBlock = (component: string) =>
  component.startsWith(`${organizeosNamespace}:`);

/**
 * What a block reads from the org's catalog, and where its template reads it:
 * the table `organizeosBlockData`, keyed by the template's key (the
 * `component` the Components panel inserts, not the root's component: an
 * Event List's root is a Share Code Carrier).
 */
export type BlockData = {
  /** The catalog Resource the block's binding references. */
  catalog: "events" | "forms" | "upcoming-events";
  /** The name of the block's binding. */
  bindingName: string;
  /** The props bound to the binding, by the `ws:id` the template gives. */
  binds: ReadonlyArray<{
    /** "root", or the `ws:id` of an instance of the template. */
    instance: "root" | string;
    prop: string;
    /** The expression, given the encoded binding variable. */
    value: (variable: string) => string;
  }>;
};

/**
 * What the Event List and the Event Card bind (their template:
 * packages/sdk-components-organizeos `events/event-card.template.tsx`). The
 * variable is the resources loader's `{ ok, status, statusText, data }`, so
 * `.data` is the response body and `.data.data` is the DTO's list; `ok` sits on
 * the variable, not on the body.
 *
 * - The collection reads the list only when `ok` is true, so it stays on a list
 *   for a successful read only and agrees with the empty and Unavailable boxes.
 *   (A failed read hands over an error body, `{ error }` or a 429's
 *   `{ error, retryAfter }`, whose `.data.data` is undefined and renders no
 *   card either way. Binding the body itself, `.data`, would iterate one card
 *   per key of it.)
 * - The whole condition is parenthesized. A published page iterates
 *   `Object.entries(<bind> ?? {})`, and `??` binds tighter than `?:`: bare, it
 *   would guard only the `[]` branch, and a 200 whose body has no list (an HTML
 *   page after a redirect, `{}`) would throw while the page renders.
 * - The "No upcoming events" box shows for an empty list, and the "Events
 *   unavailable" box for a failed read.
 * - While the Resource loads the variable is undefined. Expressions are
 *   transpiled with optional chaining, so the collection is empty and both
 *   boxes stay hidden.
 *
 * A designer caps the list by editing the collection's `data` expression, for
 * example `<binding>.data.data.slice(0, 6)` inside the condition.
 */
const eventsBlockData = (
  list: (variable: string) => string
): Pick<BlockData, "catalog" | "bindingName" | "binds"> => ({
  catalog: "upcoming-events",
  bindingName: UPCOMING_EVENTS_BINDING_NAME,
  binds: [
    {
      instance: "events",
      prop: "data",
      value: (variable) => `(${variable}.ok === true ? ${list(variable)} : [])`,
    },
    {
      instance: "empty",
      prop: showAttribute,
      value: (variable) =>
        `${variable}.ok === true && ${variable}.data.data.length === 0`,
    },
    {
      instance: "unavailable",
      prop: showAttribute,
      value: (variable) => `${variable}.ok === false`,
    },
  ],
});

/**
 * The blocks that read the org's data. A template key with no entry is
 * inserted untouched. Exported so a test can register a block of its own.
 */
export const organizeosBlockData = new Map<string, BlockData>([
  [
    `${organizeosNamespace}:SignupForm`,
    {
      catalog: "forms",
      bindingName: FORMS_PRESET_NAME,
      // GET /v1/forms: `{ data: [...] }`
      binds: [
        {
          instance: "root",
          prop: "data",
          value: (variable) => `${variable}.data`,
        },
      ],
    },
  ],
  [
    `${organizeosNamespace}:RsvpForm`,
    {
      // The Events Resource itself, never created: provisioning always writes
      // it. Every item carries the registration details the form reads (when
      // the event starts and ends, whether it is full, its guests, shifts and
      // questions), and the block finds its event in the list by `record`.
      catalog: "events",
      bindingName: EVENTS_BINDING_NAME,
      // GET /v1/events: `{ data: [...] }`, the body, as the Signup Form reads
      // its forms. A failed read hands over an error body, which the form reads
      // as no data and answers with its Unavailable state.
      binds: [
        {
          instance: "root",
          prop: "data",
          value: (variable) => `${variable}.data`,
        },
      ],
    },
  ],
  [
    `${organizeosNamespace}:EventList`,
    eventsBlockData((variable) => `${variable}.data.data`),
  ],
  [
    // the next upcoming event (plan decision D12): the first of the list
    `${organizeosNamespace}:EventCard`,
    eventsBlockData((variable) => `${variable}.data.data.slice(0, 1)`),
  ],
]);

type PresetIds = { resourceId: string; bindingId: string };

export type OrganizeosPresetIds = {
  events: PresetIds;
  forms: PresetIds;
  upcomingEvents: PresetIds;
};

export const getOrganizeosPresetIds = async (
  projectId: string
): Promise<OrganizeosPresetIds> => {
  const [events, forms, upcomingEvents] = await Promise.all([
    getResourcePresetIds(projectId, "events"),
    getResourcePresetIds(projectId, FORMS_PRESET_KEY),
    getResourcePresetIds(projectId, UPCOMING_EVENTS_PRESET_KEY),
  ]);
  return { events, forms, upcomingEvents };
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
 * An endpoint next to the Events one, for a catalog Resource the project lacks.
 * Provisioning writes the Events URL as a string literal,
 * `"<API base>/events"`; anything else is not a URL this can derive from.
 */
const getSiblingUrl = (eventsUrl: string, path: string) => {
  let url: unknown;
  try {
    url = JSON.parse(eventsUrl);
  } catch {
    return;
  }
  if (typeof url !== "string" || url.endsWith("/events") === false) {
    return;
  }
  return JSON.stringify(`${url.slice(0, -"/events".length)}${path}`);
};

// The Resources a block can create, in the shape provisioning writes
// (buildOrgResourcePresets): their name and their path under the API base.
const createdResources = {
  forms: { name: FORMS_PRESET_NAME, path: "/forms" },
  "upcoming-events": {
    name: UPCOMING_EVENTS_RESOURCE_NAME,
    path: "/events?upcoming=true",
  },
} as const;

export type OrganizeosBlockCompletion =
  | { status: "refused" }
  | {
      status: "ready";
      fragment: WebstudioFragment;
      // For a block that reads the org's data: the catalog Resource its
      // binding references, that Resource when the project lacks it, the
      // binding's name, and the props bound to it (by fragment instance id).
      binding?: {
        resourceId: Resource["id"];
        resource?: Resource;
        name: string;
        binds: Array<{
          instanceId: Instance["id"];
          prop: string;
          value: (variable: string) => string;
        }>;
      };
    };
/**
 * Complete a block's template fragment against the project's catalog. Pure:
 * reads the given map, returns the fragment to insert and what the insert
 * adds with it (completeOrganizeosInsertMutable), never touches a store.
 * `component` is the template's key, which names the block's table entry; a
 * key with no entry is returned as it is.
 */
export const completeOrganizeosFragment = ({
  component,
  fragment,
  presetIds,
  resources,
}: {
  component: string;
  fragment: WebstudioFragment;
  presetIds: OrganizeosPresetIds;
  resources: Resources;
}): OrganizeosBlockCompletion => {
  const entry = organizeosBlockData.get(component);
  const rootChild = fragment.children.find((child) => child.type === "id");
  const root = fragment.instances.find(
    (instance) => instance.id === rootChild?.value
  );
  if (entry === undefined || root === undefined) {
    return { status: "ready", fragment };
  }

  // A bind names an instance of the template by its `ws:id`. One the fragment
  // lacks is a template bug (the template tests catch it); nothing is written.
  const instanceIds = new Set(fragment.instances.map(({ id }) => id));
  const binds = entry.binds.map((bind) => ({
    instanceId: bind.instance === "root" ? root.id : bind.instance,
    prop: bind.prop,
    value: bind.value,
  }));
  if (binds.some((bind) => instanceIds.has(bind.instanceId) === false)) {
    return { status: "refused" };
  }

  // The Events Resource, found by its id and never by name, is the project's
  // link to the org's data: its API base and its read token. Without it, or
  // without the token, a Resource could not authenticate, so nothing is
  // written and the admin is told who can restore it.
  const events = resources.get(presetIds.events.resourceId);
  const authorization =
    events === undefined ? undefined : findAuthorizationHeader(events);
  if (events === undefined || authorization === undefined) {
    return { status: "refused" };
  }

  // Find or create the catalog Resource by the id provisioning gives it, in
  // the shape provisioning writes (buildOrgResourcePresets), so a
  // re-provision rewrites this same Resource instead of adding a second one.
  // Events is always there by now, and is never created.
  const resourceId =
    entry.catalog === "events"
      ? presetIds.events.resourceId
      : entry.catalog === "forms"
        ? presetIds.forms.resourceId
        : presetIds.upcomingEvents.resourceId;
  let resource: undefined | Resource;
  if (entry.catalog !== "events" && resources.has(resourceId) === false) {
    const { name, path } = createdResources[entry.catalog];
    const url = getSiblingUrl(events.url, path);
    if (url === undefined) {
      return { status: "refused" };
    }
    resource = {
      id: resourceId,
      name,
      method: "get",
      url,
      headers: [{ name: "Authorization", value: authorization.value }],
    };
  }

  // The insert binds these props to the block's own binding; any binding the
  // template made under the same names is dropped.
  return {
    status: "ready",
    fragment: {
      ...fragment,
      props: fragment.props.filter(
        (prop) =>
          binds.some(
            (bind) =>
              bind.instanceId === prop.instanceId && bind.prop === prop.name
          ) === false
      ),
    },
    binding: { resourceId, resource, name: entry.bindingName, binds },
  };
};

/**
 * What a completion adds, written into the insert's own transaction once the
 * block's instances have their ids there (`newInstanceIds` maps each fragment
 * id to its new one): the catalog Resource when the project still lacks it
 * (one that appeared meanwhile is kept, never replaced), a resource DataSource
 * with a fresh id scoped to the block's root that references it, and each
 * bound prop set to an expression over that DataSource's variable, by id, so
 * no variable that shares its name captures it at insert (copies are another
 * matter: see the known limits).
 */
export const completeOrganizeosInsertMutable = (
  data: Pick<WebstudioData, "resources" | "dataSources" | "props">,
  completion: Extract<OrganizeosBlockCompletion, { status: "ready" }>,
  newInstanceIds: Map<Instance["id"], Instance["id"]>
) => {
  const { binding: block } = completion;
  const rootChild = completion.fragment.children.find(
    (child) => child.type === "id"
  );
  const rootId =
    rootChild === undefined ? undefined : newInstanceIds.get(rootChild.value);
  if (block === undefined || rootId === undefined) {
    return;
  }
  if (
    block.resource !== undefined &&
    data.resources.has(block.resourceId) === false
  ) {
    data.resources.set(block.resourceId, block.resource);
  }
  const binding: DataSource = {
    type: "resource",
    id: nanoid(),
    scopeInstanceId: rootId,
    name: block.name,
    resourceId: block.resourceId,
  };
  data.dataSources.set(binding.id, binding);
  const variable = encodeDataSourceVariable(binding.id);
  for (const bind of block.binds) {
    const instanceId = newInstanceIds.get(bind.instanceId);
    if (instanceId === undefined) {
      continue;
    }
    for (const prop of data.props.values()) {
      if (prop.instanceId === instanceId && prop.name === bind.prop) {
        data.props.delete(prop.id);
      }
    }
    const prop = {
      id: nanoid(),
      instanceId,
      name: bind.prop,
      type: "expression" as const,
      value: bind.value(variable),
    };
    data.props.set(prop.id, prop);
  }
};

/**
 * Whether the org behind this project may use the blocks: it is not on the
 * deny list (`ORGANIZEOS_BLOCKS_DENY_ORG_IDS`, resolved by the builder's
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
    component,
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

  // Through the same transaction as any insert, so it syncs and undoes as
  // one step, and writes nothing when the block has no place to go. "ours":
  // a token the project already has (the designer may have restyled "OS
  // Input") is reused as it stands, never added again as "OS Input-1".
  return insertWebstudioFragmentAt(completion.fragment, insertable, "ours", {
    onInsert: (data, newInstanceIds) => {
      completeOrganizeosInsertMutable(data, completion, newInstanceIds);
    },
  });
};
