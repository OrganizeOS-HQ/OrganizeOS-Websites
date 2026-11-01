import {
  getPagePath,
  replaceFormActionsWithResources,
  type DataSource,
  type Instance,
  type Pages,
  type Prop,
  type Resource,
  type WebstudioData,
} from "@webstudio-is/sdk";
import {
  parsePages,
  serializePages,
} from "@webstudio-is/project-build/index.server";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import {
  $,
  ws,
  ActionValue,
  expression,
  PlaceholderValue,
  renderData,
  Variable,
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
 *  - The Form has a string `action` prop. replaceFormActionsWithResources turns
 *    it into a server-side ACTION resource (a prop of type 'resource' + a
 *    resource keyed by the form instance id). On submit the runtime posts the
 *    form to the page's server action, which overlays the FormData onto the
 *    resource body and runs it SERVER-SIDE, so the Authorization token never
 *    reaches the browser.
 *  - We inject the org read token into that resource's Authorization header
 *    as a literal expression (evaluated server-side only; see below).
 *  - Input `name` attributes become the JSON body keys, so they MUST match the
 *    /v1/signups schema (email, first_name, last_name).
 *  - A `formState` variable drives initial/success/error visibility.
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

/** The signup form subtree wrapped in a page body. */
const signupFormTemplate = (actionUrl: string, bodyId: string) => {
  const formState = new Variable("formState", "initial");
  return (
    <ws.element ws:tag="body" ws:id={bodyId}>
      <$.Form
        action={actionUrl}
        method="post"
        state={expression`${formState}`}
        onStateChange={
          new ActionValue(["state"], expression`${formState} = state`)
        }
      >
        <ws.element
          ws:tag="div"
          ws:label="Form Content"
          ws:show={expression`${formState} === 'initial' || ${formState} === 'error'`}
        >
          <ws.element ws:tag="label">
            {new PlaceholderValue("Email")}
          </ws.element>
          <ws.element
            ws:tag="input"
            name="email"
            type="email"
            required={true}
          />
          <ws.element ws:tag="label">
            {new PlaceholderValue("First name")}
          </ws.element>
          <ws.element ws:tag="input" name="first_name" />
          <ws.element ws:tag="label">
            {new PlaceholderValue("Last name")}
          </ws.element>
          <ws.element ws:tag="input" name="last_name" />
          <ws.element ws:tag="button">
            {new PlaceholderValue("Sign up")}
          </ws.element>
        </ws.element>
        <ws.element
          ws:tag="div"
          ws:label="Success"
          ws:show={expression`${formState} === 'success'`}
        >
          {new PlaceholderValue("Thanks for signing up!")}
        </ws.element>
        <ws.element
          ws:tag="div"
          ws:label="Error"
          ws:show={expression`${formState} === 'error'`}
        >
          {new PlaceholderValue("Something went wrong. Please try again.")}
        </ws.element>
      </$.Form>
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
 * Assemble the signup form: render the template with deterministic ids, convert
 * the form action into a server-side action resource, inject the org token
 * header as a literal. Pure: no I/O (async only because the id derivation is).
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
  const template = () => signupFormTemplate(`${base}/signups`, bodyId);

  // renderData takes a synchronous id generator, and uuidV5 is async. So count
  // the ids one render asks for, derive them, and render again handing them
  // out in order: both renders walk the same template the same way, so the nth
  // id is uuidV5("{projectId}:signup:{n}"), exactly as before.
  let count = 0;
  renderData(template(), () => String(count++));
  const ids = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      uuidV5(`${projectId}:signup:${index}`)
    )
  );
  let counter = 0;
  const data = renderData(template(), () => ids[counter++]);

  // Turn the form's string action into a server-side action resource.
  replaceFormActionsWithResources({
    props: data.props,
    instances: data.instances,
    resources: data.resources,
  });

  // Inject the org read token into the action resource's Authorization header
  // as a LITERAL expression. Variables are instance-scoped and page codegen
  // drops out-of-scope ones (the publish spike produced "Bearer " + undefined
  // via the variable route); resource headers are evaluated only server-side,
  // so the literal is equivalent security-wise, and the deterministic ids mean
  // a re-seed rewrites it on token rotation.
  const authHeaderValue = JSON.stringify(`Bearer ${readToken}`);
  for (const resource of data.resources.values()) {
    if (resource.name === "action") {
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

/**
 * Merge the signup form into a build's content and add a "Newsletter" page at
 * SIGNUP_PAGE_PATH. Pure: mutates only the returned values (pages is mutated
 * in place, so pass a build you own). Only the content maps are merged: the
 * form's PRESET STYLES and breakpoints are intentionally dropped so the seeded
 * fragment never has to reconcile its breakpoints against the build's. The
 * starter form ships unstyled; the org styles it in the builder.
 * Deterministic ids make this idempotent: a re-seed replaces in place, in
 * order, and moves a page seeded at an older path (`/signup`) to the current
 * one under the same id.
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

  const instances = upsertById(build.instances, [...data.instances.values()]);
  const props = upsertById(build.props, [...data.props.values()]);
  const dataSources = upsertById(build.dataSources, [
    ...data.dataSources.values(),
  ]);
  const resources = upsertById(build.resources, [...data.resources.values()]);

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
