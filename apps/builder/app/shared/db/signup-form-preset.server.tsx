import {
  getPagePath,
  type DataSource,
  type Instance,
  type Pages,
  type Prop,
  type Resource,
  type WebstudioData,
} from "@webstudio-is/sdk";
import { formDataParameterName } from "@webstudio-is/sdk/runtime";
import { parsePages, serializePages } from "@webstudio-is/project-build/server";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import {
  ws,
  ActionValue,
  expression,
  FormActionsValue,
  Parameter,
  PlaceholderValue,
  renderData,
  ResourceValue,
  Variable,
  type RenderTemplateOptions,
} from "@webstudio-is/template";
import { SIGNUP_PAGE_PATH, uuidV5 } from "../organizeos-preset-ids";
import {
  updateDevBuildWithVersionBump,
  upsertById,
} from "./resource-presets.server";

/**
 * OrganizeOS Websites 2.0: a native signup form preset (Phase 4d write side).
 *
 * Builds a Webstudio form whose submit posts to the OrganizeOS /v1/signups
 * write endpoint. The mechanics:
 *  - The form is Webstudio's managed Form, persisted as `ResourceForm` (owner
 *    decision D15 of the 0.309.0 merge). Its `action` names one Resource,
 *    scoped to the form, whose body is the form's `formData` parameter. On
 *    submit the runtime posts the form to the page's server action, which runs
 *    that Resource SERVER-SIDE, so the Authorization token never reaches the
 *    browser.
 *  - We inject the org read token into that resource's Authorization header
 *    as a literal expression (evaluated server-side only; see below).
 *  - Input `name` attributes become the JSON body keys, so they MUST match the
 *    /v1/signups schema (email, first_name, last_name).
 *  - A `formState` variable drives initial/success/error visibility.
 *  - The form is written as `ResourceForm` itself, never as `Form` with
 *    pages' `formComponentIdentityVersion`: that marker is a historical input
 *    upstream no longer writes, and on pages it would make 0.309.0 read every
 *    other stored `Form` of the build (an org's own Webhook Form) as a
 *    ResourceForm, which its Resource-typed action is not.
 *
 * This module ASSEMBLES the form data (pure, testable), and
 * seedSignupFormPage merges it into the org's dev build as a "Newsletter" page
 * at SIGNUP_PAGE_PATH.
 */

const SIGNUP_PAGE_NAME = "Newsletter";

// Signup-form ids are derived in the same namespace as the read presets
// (shared/organizeos-preset-ids.ts), so all preset ids live in one
// deterministic family.

/** Input `name`s, in lockstep with the /v1/signups request schema. */
export const SIGNUP_FORM_FIELD_NAMES = [
  "email",
  "first_name",
  "last_name",
] as const;

/** The name of the form's action Resource, as the builder lists it. */
export const SIGNUP_RESOURCE_NAME = "Newsletter signup";

/**
 * The form's ids are `{projectId}:{family}:{n}`, n below SIGNUP_ID_SPACE.
 *
 * Its elements and its `formState` variable keep the ids the Form before it
 * (provisioned before 0.309.0) held under the `signup` family, by role, so
 * every org's styles, props and children on them carry over to the
 * ResourceForm. The index of each is its place in that Form's render order:
 * the Form, then `formState` (its first prop's variable), then its subtree.
 * Only the records the Form never had, the `formData` parameter, the action
 * Resource and its data source, take the `signup-form` family.
 *
 * A re-seed removes every record under either family that the current form
 * does not carry (the Form's Resource-typed action and its Resource, its
 * `state` prop), so nothing of an earlier form is left.
 */
const SIGNUP_ID_FAMILY = "signup-form";
const LEGACY_SIGNUP_ID_FAMILY = "signup";
const SIGNUP_ID_SPACE = 64;

const SIGNUP_ELEMENT_INDEX = {
  form: 0,
  content: 2,
  emailLabel: 3,
  emailInput: 4,
  firstNameLabel: 5,
  firstNameInput: 6,
  lastNameLabel: 7,
  lastNameInput: 8,
  button: 9,
  success: 10,
  error: 11,
} as const;
const SIGNUP_FORM_STATE_INDEX = 1;

type SignupElementIds = Record<keyof typeof SIGNUP_ELEMENT_INDEX, string>;

// A server module renders the template without the component libraries:
// this marker stands for the managed Form, and renderData persists it under
// its registered id.
const ResourceForm = (_props: Record<string, unknown>) => null;
const renderOptions: RenderTemplateOptions = {
  componentIds: new Map([[ResourceForm, "ResourceForm"]]),
};

/** The signup form subtree wrapped in a page body. */
const signupFormTemplate = (bodyId: string, ids: SignupElementIds) => {
  const formState = new Variable("formState", "initial");
  const formData = new Parameter(formDataParameterName);
  // url and Authorization are literals, set once the template is rendered.
  const signup = new ResourceValue(SIGNUP_RESOURCE_NAME, {
    method: "post",
    url: expression`""`,
    headers: [{ name: "Content-Type", value: expression`"application/json"` }],
    body: expression`${formData}`,
  });
  return (
    <ws.element ws:tag="body" ws:id={bodyId}>
      <ResourceForm
        ws:id={ids.form}
        action={new FormActionsValue([signup])}
        formData={formData}
        onStateChange={
          new ActionValue(["state"], expression`${formState} = state`)
        }
      >
        <ws.element
          ws:id={ids.content}
          ws:tag="div"
          ws:label="Form Content"
          ws:show={expression`${formState} === 'initial' || ${formState} === 'error'`}
        >
          <ws.element ws:id={ids.emailLabel} ws:tag="label">
            {new PlaceholderValue("Email")}
          </ws.element>
          <ws.element
            ws:id={ids.emailInput}
            ws:tag="input"
            name="email"
            type="email"
            required={true}
          />
          <ws.element ws:id={ids.firstNameLabel} ws:tag="label">
            {new PlaceholderValue("First name")}
          </ws.element>
          <ws.element
            ws:id={ids.firstNameInput}
            ws:tag="input"
            name="first_name"
          />
          <ws.element ws:id={ids.lastNameLabel} ws:tag="label">
            {new PlaceholderValue("Last name")}
          </ws.element>
          <ws.element
            ws:id={ids.lastNameInput}
            ws:tag="input"
            name="last_name"
          />
          <ws.element ws:id={ids.button} ws:tag="button">
            {new PlaceholderValue("Sign up")}
          </ws.element>
        </ws.element>
        <ws.element
          ws:id={ids.success}
          ws:tag="div"
          ws:label="Success"
          ws:show={expression`${formState} === 'success'`}
        >
          {new PlaceholderValue("Thanks for signing up!")}
        </ws.element>
        <ws.element
          ws:id={ids.error}
          ws:tag="div"
          ws:label="Error"
          ws:show={expression`${formState} === 'error'`}
        >
          {new PlaceholderValue("Something went wrong. Please try again.")}
        </ws.element>
      </ResourceForm>
    </ws.element>
  );
};

export type SignupFormData = {
  /** The rendered + resource-wired form data (instances/props/dataSources/resources/...). */
  data: Omit<WebstudioData, "pages">;
  /** Body instance id: the rootInstanceId for the seeded signup page. */
  bodyId: string;
  /** Deterministic id for the seeded page. */
  pageId: string;
};

/**
 * Assemble the signup form: render the template with deterministic ids, point
 * its action resource at /v1/signups and inject the org token header as a
 * literal. Pure: no I/O (async only because the id derivation is).
 * Deterministic per projectId, so re-seeding converges instead of duplicating.
 */
export const buildSignupFormData = async ({
  projectId,
  apiBaseUrl,
  readToken,
}: {
  projectId: string;
  apiBaseUrl: string;
  readToken: string;
}): Promise<SignupFormData> => {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const [bodyId, pageId] = await Promise.all([
    uuidV5(`${projectId}:signup:body`),
    uuidV5(`${projectId}:signup:page`),
  ]);
  const legacyIds = await Promise.all(
    Array.from({ length: SIGNUP_ELEMENT_INDEX.error + 1 }, (_, index) =>
      uuidV5(`${projectId}:${LEGACY_SIGNUP_ID_FAMILY}:${index}`)
    )
  );
  const elementIds = Object.fromEntries(
    Object.entries(SIGNUP_ELEMENT_INDEX).map(([role, index]) => [
      role,
      legacyIds[index],
    ])
  ) as SignupElementIds;
  const template = () => signupFormTemplate(bodyId, elementIds);

  // Every element carries its id; renderData asks its generator only for the
  // variables, the parameter and the Resource. It is synchronous and uuidV5
  // is async, so render once with the place of each request as its id, derive
  // the ids, and render again handing them out in order: both renders walk
  // the same template the same way. `formState` takes the id the earlier Form
  // gave it; the nth other request takes uuidV5("{projectId}:signup-form:{n}").
  let count = 0;
  const draft = renderData(
    template(),
    () => String(count++),
    [],
    renderOptions
  );
  if (count > SIGNUP_ID_SPACE) {
    throw new Error(
      `The signup form derives ${count} ids, more than its ${SIGNUP_ID_SPACE}`
    );
  }
  const formStatePlace = [...draft.dataSources.values()].find(
    (dataSource) =>
      dataSource.type === "variable" && dataSource.name === "formState"
  )?.id;
  const ids = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      String(index) === formStatePlace
        ? legacyIds[SIGNUP_FORM_STATE_INDEX]
        : uuidV5(`${projectId}:${SIGNUP_ID_FAMILY}:${index}`)
    )
  );
  let counter = 0;
  const data = renderData(template(), () => ids[counter++], [], renderOptions);

  // Point the action resource at /v1/signups and inject the org read token
  // into its Authorization header, both as LITERAL expressions. Variables are
  // instance-scoped and page codegen drops out-of-scope ones (the publish
  // spike produced "Bearer " + undefined via the variable route); resource
  // headers are evaluated only server-side, so the literal is equivalent
  // security-wise, and the deterministic ids mean a re-seed rewrites it on
  // token rotation.
  const authHeaderValue = JSON.stringify(`Bearer ${readToken}`);
  for (const resource of data.resources.values()) {
    if (resource.name === SIGNUP_RESOURCE_NAME) {
      resource.url = JSON.stringify(`${base}/signups`);
      resource.headers.push({ name: "Authorization", value: authHeaderValue });
    }
  }

  return { data, bodyId, pageId };
};

export type BuildContent = {
  instances: Instance[];
  props: Prop[];
  dataSources: DataSource[];
  resources: Resource[];
  pages: Pages;
};

/** Every id the preset may have derived for a project, in either family. */
const getSignupIds = async (projectId: string) =>
  new Set(
    await Promise.all(
      [SIGNUP_ID_FAMILY, LEGACY_SIGNUP_ID_FAMILY].flatMap((family) =>
        Array.from({ length: SIGNUP_ID_SPACE }, (_, index) =>
          uuidV5(`${projectId}:${family}:${index}`)
        )
      )
    )
  );

/**
 * Whether a record's id is one the preset derives: a derived id itself (an
 * instance, a data source, a Resource an earlier preset keyed by its Form's
 * id), `resource:{id}` (renderData's Resource ids) or `{id}:{name}` (its prop
 * ids). A derived id is a UUID, so it holds no colon.
 */
const isSignupRecordId = (id: string, signupIds: Set<string>) => {
  const bare = id.startsWith("resource:") ? id.slice("resource:".length) : id;
  const separator = bare.indexOf(":");
  return signupIds.has(separator === -1 ? bare : bare.slice(0, separator));
};

/**
 * An element's children after a re-seed: the template's, with every child an
 * org added (an instance that is not one of the preset's) kept, placed after
 * the template child it followed. The template's own children and text keep
 * the template's order, as every re-seed has.
 */
const keepAddedChildren = (
  existing: Instance["children"],
  incoming: Instance["children"],
  isPresetInstance: (id: string) => boolean
): Instance["children"] => {
  const addedAfter = new Map<string | undefined, Instance["children"]>();
  let anchor: string | undefined;
  for (const child of existing) {
    if (child.type !== "id") {
      continue;
    }
    if (isPresetInstance(child.value)) {
      anchor = child.value;
      continue;
    }
    addedAfter.set(anchor, [...(addedAfter.get(anchor) ?? []), child]);
  }
  if (addedAfter.size === 0) {
    return incoming;
  }
  const children = [...(addedAfter.get(undefined) ?? [])];
  const placed = new Set<string | undefined>([undefined]);
  for (const child of incoming) {
    children.push(child);
    if (child.type === "id" && addedAfter.has(child.value)) {
      children.push(...addedAfter.get(child.value)!);
      placed.add(child.value);
    }
  }
  // after an element the template no longer has: at the end
  for (const [after, added] of addedAfter) {
    if (placed.has(after) === false) {
      children.push(...added);
    }
  }
  return children;
};

/**
 * The records of `existing`, without those under a preset id that `incoming`
 * does not carry: what is left of a form an earlier preset rendered.
 */
const withoutStaleSignupRecords = <Item extends { id: string }>(
  existing: Item[],
  incoming: Iterable<Item>,
  signupIds: Set<string>
) => {
  const incomingIds = new Set(Array.from(incoming, (item) => item.id));
  return existing.filter(
    (item) =>
      isSignupRecordId(item.id, signupIds) === false || incomingIds.has(item.id)
  );
};

/**
 * Merge the signup form into a build's content and add a "Newsletter" page at
 * SIGNUP_PAGE_PATH. Pure: mutates only the returned values (pages is mutated
 * in place, so pass a build you own). Only the content maps are merged: the
 * form's PRESET STYLES and breakpoints are intentionally dropped so the seeded
 * fragment never has to reconcile its breakpoints against the build's. The
 * starter form ships unstyled; the org styles it in the builder.
 * Deterministic ids make this idempotent: a re-seed replaces in place, in
 * order, and moves a page seeded at an older path (`/signup`) to the current
 * one under the same id. An element keeps every child an org added to it
 * (keepAddedChildren), and its styles and props, which are keyed to its id.
 * The re-seed also drops every record under a preset id that the current
 * form does not have, so the Form an org was provisioned with before 0.309.0
 * becomes the ResourceForm under the same element ids, and its
 * Resource-typed action and the Resource keyed by its id are gone.
 *
 * When another page already answers at SIGNUP_PAGE_PATH, nothing is moved
 * there: a page seeded earlier keeps its path and gets its content re-synced
 * (a rotated token), and a build without one gets nothing.
 */
export const mergeSignupFormIntoBuild = async (
  build: BuildContent,
  {
    projectId,
    apiBaseUrl,
    readToken,
  }: { projectId: string; apiBaseUrl: string; readToken: string }
): Promise<BuildContent> => {
  const { data, bodyId, pageId } = await buildSignupFormData({
    projectId,
    apiBaseUrl,
    readToken,
  });

  const pages = build.pages;
  const seededPage = pages.pages.get(pageId);
  const pathIsTaken = [...pages.pages.values()].some(
    (page) =>
      page.id !== pageId && getPagePath(page.id, pages) === SIGNUP_PAGE_PATH
  );
  if (pathIsTaken && seededPage === undefined) {
    return build;
  }

  const signupIds = await getSignupIds(projectId);
  const merge = <Item extends { id: string }>(
    existing: Item[],
    incoming: Map<string, Item>
  ) =>
    upsertById(
      withoutStaleSignupRecords(existing, incoming.values(), signupIds),
      [...incoming.values()]
    );
  const existingInstances = new Map(
    build.instances.map((instance) => [instance.id, instance])
  );
  const isPresetInstance = (id: string) =>
    data.instances.has(id) || isSignupRecordId(id, signupIds);
  const incomingInstances = new Map(
    Array.from(data.instances, ([id, instance]) => {
      const existing = existingInstances.get(id);
      return [
        id,
        existing === undefined
          ? instance
          : {
              ...instance,
              children: keepAddedChildren(
                existing.children,
                instance.children,
                isPresetInstance
              ),
            },
      ];
    })
  );
  const instances = merge(build.instances, incomingInstances);
  const props = merge(build.props, data.props);
  const dataSources = merge(build.dataSources, data.dataSources);
  const resources = merge(build.resources, data.resources);

  pages.pages.set(
    pageId,
    pathIsTaken && seededPage !== undefined
      ? seededPage
      : {
          id: pageId,
          name: SIGNUP_PAGE_NAME,
          path: SIGNUP_PAGE_PATH,
          // title is an expression (a quoted string literal), matching
          // createPages.
          title: JSON.stringify(SIGNUP_PAGE_NAME),
          meta: {},
          rootInstanceId: bodyId,
        }
  );
  const rootFolder = pages.folders.get(pages.rootFolderId);
  if (rootFolder && rootFolder.children.includes(pageId) === false) {
    rootFolder.children.push(pageId);
  }

  return { instances, props, dataSources, resources, pages };
};

/**
 * Seed (or re-sync) the org's dev build with the signup form and its
 * "Newsletter" page. Merges content-only and writes back with
 * updateDevBuildWithVersionBump (a compare-and-swap that bumps the version, so
 * an open builder reloads rather than keep a replaced token). Idempotent: an
 * unchanged form writes nothing. Runs after seedProjectResourcePresets at
 * provision time.
 */
export const seedSignupFormPage = async (
  context: AppContext,
  {
    projectId,
    apiBaseUrl,
    readToken,
  }: { projectId: string; apiBaseUrl: string; readToken: string }
): Promise<void> => {
  await updateDevBuildWithVersionBump(context, projectId, async (build) => {
    const merged = await mergeSignupFormIntoBuild(
      {
        instances: JSON.parse(build.instances) as Instance[],
        props: JSON.parse(build.props) as Prop[],
        dataSources: JSON.parse(build.dataSources) as DataSource[],
        resources: JSON.parse(build.resources) as Resource[],
        pages: parsePages(build.pages),
      },
      { projectId, apiBaseUrl, readToken }
    );
    const pages = serializePages(merged.pages);
    return {
      instances: JSON.stringify(merged.instances),
      props: JSON.stringify(merged.props),
      dataSources: JSON.stringify(merged.dataSources),
      resources: JSON.stringify(merged.resources),
      // Compared as the builder would write them, so pages stored in another
      // serialization do not count as a change.
      ...(pages === serializePages(parsePages(build.pages)) ? {} : { pages }),
    };
  });
};
