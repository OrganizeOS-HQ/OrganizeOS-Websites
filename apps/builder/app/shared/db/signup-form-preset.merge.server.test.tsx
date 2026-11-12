import { describe, expect, test } from "vitest";
import type { Instance } from "@webstudio-is/sdk";
import { parsePages, serializePages } from "@webstudio-is/project-build/server";
import { migrateResourceFormInstancesMutable } from "@webstudio-is/project-migrations";
import { hasHistoricalFormComponentIdentityVersion } from "@webstudio-is/project-migrations/pages";
import { SIGNUP_PAGE_PATH, uuidV5 } from "../organizeos-preset-ids";
import {
  buildSignupFormData,
  mergeSignupFormIntoBuild,
  seedSignupFormPage,
  SIGNUP_RESOURCE_NAME,
  type BuildContent,
} from "./signup-form-preset.server";

const args = {
  projectId: "project-1",
  apiBaseUrl: "https://app.example.org/api/public/v1",
  readToken: "osk_secrettoken",
};

const HOME_BODY = "home-body-id";

// A minimal but valid base build: a home page whose root is a body instance.
const makeBase = (): BuildContent => ({
  instances: [
    {
      id: HOME_BODY,
      type: "instance",
      component: "ws:element",
      tag: "body",
      children: [],
    },
  ],
  props: [],
  dataSources: [],
  resources: [],
  pages: {
    homePageId: "home",
    rootFolderId: "root",
    pages: new Map([
      [
        "home",
        {
          id: "home",
          name: "Home",
          path: "",
          title: `"Home"`,
          meta: {},
          rootInstanceId: HOME_BODY,
        },
      ],
    ]),
    folders: new Map([
      ["root", { id: "root", name: "Root", slug: "", children: ["home"] }],
    ]),
  },
});

// Nothing in the build points at a record that is not there: a prop's or a
// data source's instance, an instance's child, a page's root. And no instance
// has two parents, which would render it twice.
const expectNothingDangles = (build: BuildContent) => {
  const instanceIds = new Set(build.instances.map((i) => i.id));
  const dangling = [
    ...build.props
      .filter((prop) => instanceIds.has(prop.instanceId) === false)
      .map((prop) => `prop ${prop.id}`),
    ...build.dataSources
      .filter(
        (dataSource) =>
          instanceIds.has(dataSource.scopeInstanceId ?? "") === false
      )
      .map((dataSource) => `data source ${dataSource.id}`),
    ...build.instances.flatMap((instance) =>
      instance.children
        .filter(
          (child) =>
            child.type === "id" && instanceIds.has(child.value) === false
        )
        .map((child) => `child ${child.value} of ${instance.id}`)
    ),
    ...[...build.pages.pages.values()]
      .filter((page) => instanceIds.has(page.rootInstanceId) === false)
      .map((page) => `root of page ${page.id}`),
  ];
  expect(dangling).toEqual([]);
  const parents = new Map<string, string[]>();
  for (const instance of build.instances) {
    for (const child of instance.children) {
      if (child.type === "id") {
        parents.set(child.value, [
          ...(parents.get(child.value) ?? []),
          instance.id,
        ]);
      }
    }
  }
  expect(
    [...parents].filter(([, instanceParents]) => instanceParents.length > 1)
  ).toEqual([]);
};

const childIds = (build: BuildContent, id: string) =>
  build.instances
    .find((instance) => instance.id === id)!
    .children.flatMap((child) => (child.type === "id" ? [child.value] : []));

// Stateful fake of the Build table; the update honours its match on version.
const makeBuildRowContext = (base: BuildContent, builderSaves = 0) => {
  const row = {
    id: "build-1",
    version: 3,
    updatedAt: "2026-11-01T00:00:00.000Z",
    instances: JSON.stringify(base.instances),
    props: JSON.stringify(base.props),
    dataSources: JSON.stringify(base.dataSources),
    resources: JSON.stringify(base.resources),
    pages: serializePages(base.pages),
  };
  const state = { row, writes: [] as Array<Record<string, unknown>> };
  let saves = builderSaves;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            single: async () => ({ data: { ...state.row }, error: null }),
          }),
        }),
      }),
      update: (payload: Record<string, unknown>) => ({
        match: async (match: Record<string, unknown>) => {
          state.writes.push({ ...payload, match });
          if (saves > 0) {
            saves -= 1;
            state.row.version += 1;
          }
          if (state.row.version !== match.version) {
            return { error: null, count: 0 };
          }
          Object.assign(state.row, payload);
          return { error: null, count: 1 };
        },
      }),
    }),
  };
  return { context: { postgrest: { client } } as never, state };
};

describe("mergeSignupFormIntoBuild", () => {
  test("adds a Newsletter page whose root resolves to a seeded body instance", async () => {
    const merged = await mergeSignupFormIntoBuild(makeBase(), args);

    const signupPage = [...merged.pages.pages.values()].find(
      (p) => p.path === "/newsletter"
    );
    expect(signupPage).toBeDefined();
    expect(signupPage?.name).toBe("Newsletter");
    expect(signupPage?.title).toBe(`"Newsletter"`);

    // The page root must point at an instance that actually exists in the merge.
    const rootId = signupPage!.rootInstanceId;
    const rootInstance = merged.instances.find((i) => i.id === rootId);
    expect(rootInstance).toBeDefined();
    expect(rootInstance?.component).toBe("ws:element");
  });

  test("keeps the existing home page and body intact", async () => {
    const merged = await mergeSignupFormIntoBuild(makeBase(), args);
    expect(merged.pages.pages.has("home")).toBe(true);
    expect(merged.instances.some((i) => i.id === HOME_BODY)).toBe(true);
    const rootFolder = merged.pages.folders.get("root");
    expect(rootFolder?.children).toContain("home");
    const signupPage = [...merged.pages.pages.values()].find(
      (p) => p.path === "/newsletter"
    );
    expect(rootFolder?.children).toContain(signupPage!.id);
  });

  test("carries the ResourceForm, its action Resource and no token variable into the build", async () => {
    const merged = await mergeSignupFormIntoBuild(makeBase(), args);
    expect(
      merged.instances.filter((i) => i.component === "ResourceForm")
    ).toHaveLength(1);
    const action = merged.resources.find(
      (r) => r.name === SIGNUP_RESOURCE_NAME
    );
    expect(action?.url).toBe(`"https://app.example.org/api/public/v1/signups"`);
    expect(action?.headers.some((h) => h.name === "Authorization")).toBe(true);
    // Token travels as a literal on the action resource, not a variable.
    expect(
      merged.dataSources.some(
        (d) => d.type === "variable" && d.name === "Site read token"
      )
    ).toBe(false);
  });

  // The decisive headless check: the merged pages must survive the builder's
  // REAL load path (parsePages runs migratePages), which is exactly what the
  // builder does when opening the project. If this round-trips, the builder
  // will load the seeded page.
  test("the merged pages survive the builder's parse/serialize load path", async () => {
    const merged = await mergeSignupFormIntoBuild(makeBase(), args);
    const roundTripped = parsePages(serializePages(merged.pages));
    const signup = [...roundTripped.pages.values()].find(
      (p) => p.path === "/newsletter"
    );
    expect(signup).toBeDefined();
    expect(signup?.rootInstanceId).toBe(
      [...merged.pages.pages.values()].find((p) => p.path === "/newsletter")
        ?.rootInstanceId
    );
    // Root folder still references both pages after the round trip.
    const rootFolder = roundTripped.folders.get(roundTripped.rootFolderId);
    expect(rootFolder?.children).toContain("home");
    expect(rootFolder?.children).toContain(signup!.id);
  });

  test("is idempotent: re-seeding does not duplicate the page or instances", async () => {
    const once = await mergeSignupFormIntoBuild(makeBase(), args);
    const instanceCount = once.instances.length;
    const pageCount = once.pages.pages.size;

    const twice = await mergeSignupFormIntoBuild(once, args);
    expect(twice.instances.length).toBe(instanceCount);
    expect(twice.pages.pages.size).toBe(pageCount);
    const signupPages = [...twice.pages.pages.values()].filter(
      (p) => p.path === "/newsletter"
    );
    expect(signupPages).toHaveLength(1);
    // The root folder lists the signup page exactly once.
    const rootFolder = twice.pages.folders.get("root");
    const signupId = signupPages[0].id;
    expect(rootFolder?.children.filter((c) => c === signupId)).toHaveLength(1);
  });

  test("moves a page seeded at /signup to /newsletter, in place", async () => {
    const once = await mergeSignupFormIntoBuild(makeBase(), args);
    const { pageId } = await buildSignupFormData(args);
    const seeded = once.pages.pages.get(pageId)!;
    once.pages.pages.set(pageId, {
      ...seeded,
      name: "Sign up",
      path: "/signup",
      title: `"Sign up"`,
    });

    const moved = await mergeSignupFormIntoBuild(once, args);

    expect(moved.pages.pages.get(pageId)).toEqual({
      ...seeded,
      name: "Newsletter",
      path: "/newsletter",
      title: `"Newsletter"`,
    });
    expect(moved.pages.pages.size).toBe(2);
    expect(moved.pages.folders.get("root")?.children).toEqual(["home", pageId]);
  });

  describe("when another page answers at /newsletter", () => {
    const withNewsletter = (base: BuildContent, folderSlug?: string) => {
      base.pages.pages.set("theirs", {
        id: "theirs",
        name: "Our newsletter",
        path: "/newsletter",
        title: `"Our newsletter"`,
        meta: {},
        rootInstanceId: HOME_BODY,
      });
      if (folderSlug === undefined) {
        base.pages.folders.get("root")?.children.push("theirs");
      } else {
        base.pages.folders.set("folder", {
          id: "folder",
          name: "Folder",
          slug: folderSlug,
          children: ["theirs"],
        });
        base.pages.folders.get("root")?.children.push("folder");
      }
      return base;
    };

    test("seeds nothing into a build without the seeded page", async () => {
      const base = withNewsletter(makeBase());
      const before = structuredClone(base);

      const merged = await mergeSignupFormIntoBuild(base, args);

      expect(merged).toEqual(before);
    });

    test("leaves a page seeded at /signup where it is, and re-syncs its form", async () => {
      const once = await mergeSignupFormIntoBuild(makeBase(), args);
      const { pageId } = await buildSignupFormData(args);
      const atSignup = {
        ...once.pages.pages.get(pageId)!,
        name: "Sign up",
        path: "/signup",
      };
      once.pages.pages.set(pageId, atSignup);
      withNewsletter(once);

      const merged = await mergeSignupFormIntoBuild(once, {
        ...args,
        readToken: "osk_rotated",
      });

      expect(merged.pages.pages.get(pageId)).toEqual(atSignup);
      expect(merged.pages.pages.get("theirs")?.path).toBe("/newsletter");
      const action = merged.resources.find(
        (r) => r.name === SIGNUP_RESOURCE_NAME
      );
      expect(action?.headers).toContainEqual({
        name: "Authorization",
        value: `"Bearer osk_rotated"`,
      });
    });

    test("is not taken by a page at /newsletter inside a folder", async () => {
      const merged = await mergeSignupFormIntoBuild(
        withNewsletter(makeBase(), "blog"),
        args
      );
      const { pageId } = await buildSignupFormData(args);
      expect(merged.pages.pages.get(pageId)?.path).toBe("/newsletter");
    });
  });
});

// OrganizeOS fork, owner decision D15 of the 0.309.0 merge: an org provisioned
// before 0.309.0 has the preset's earlier form, a Form whose action is a
// Resource with the Form's own id. Its records are laid out as that preset's
// renderData laid them out: elements and variables under `{projectId}:signup:
// {n}` in render order, props as `{instanceId}:{name}`. Its next provision
// replaces that form with the ResourceForm and leaves none of its records
// behind.
describe("an existing org's stored signup form", () => {
  const legacyId = (n: number) => uuidV5(`project-1:signup:${n}`);

  const legacyBuild = async (): Promise<BuildContent> => {
    const base = makeBase();
    const { bodyId, pageId } = await buildSignupFormData(args);
    const ids = await Promise.all(
      Array.from({ length: 12 }, (_, n) => legacyId(n))
    );
    const [form, formState, content] = ids;
    const fields = [
      { label: ids[3], input: ids[4], name: "email" },
      { label: ids[5], input: ids[6], name: "first_name" },
      { label: ids[7], input: ids[8], name: "last_name" },
    ];
    const [button, success, error] = ids.slice(9);
    const element = (
      id: string,
      tag: string,
      children: Instance["children"] = []
    ): Instance => ({
      type: "instance",
      id,
      component: "ws:element",
      tag,
      children,
    });
    const child = (value: string) => ({ type: "id" as const, value });
    const show = `$ws$dataSource$${formState}`;
    base.instances.push(
      element(bodyId, "body", [child(form)]),
      {
        type: "instance",
        id: form,
        component: "Form",
        children: [child(content), child(success), child(error)],
      },
      element(content, "div", [
        ...fields.flatMap(({ label, input }) => [child(label), child(input)]),
        child(button),
      ]),
      ...fields.flatMap(({ label, input }) => [
        element(label, "label"),
        element(input, "input"),
      ]),
      element(button, "button"),
      element(success, "div"),
      element(error, "div")
    );
    base.props.push(
      // replaceFormActionsWithResources made the string action a Resource
      // prop, and dropped the method prop
      {
        id: `${form}:action`,
        instanceId: form,
        name: "action",
        type: "resource",
        value: form,
      },
      {
        id: `${form}:state`,
        instanceId: form,
        name: "state",
        type: "expression",
        value: show,
      },
      {
        id: `${form}:onStateChange`,
        instanceId: form,
        name: "onStateChange",
        type: "action",
        value: [{ type: "execute", args: ["state"], code: `${show} = state` }],
      },
      ...[content, success, error].map((instanceId) => ({
        id: `${instanceId}:data-ws-show`,
        instanceId,
        name: "data-ws-show",
        type: "expression" as const,
        value: `${show} === 'initial'`,
      })),
      ...fields.map(({ input, name }) => ({
        id: `${input}:name`,
        instanceId: input,
        name: "name",
        type: "string" as const,
        value: name,
      }))
    );
    base.dataSources.push({
      id: formState,
      scopeInstanceId: form,
      name: "formState",
      type: "variable",
      value: { type: "string", value: "initial" },
    });
    base.resources.push({
      id: form,
      name: "action",
      method: "post",
      url: `"https://app.example.org/api/public/v1/signups"`,
      headers: [
        { name: "Content-Type", value: `"application/json"` },
        { name: "Authorization", value: `"Bearer osk_old"` },
      ],
    });
    base.pages.pages.set(pageId, {
      id: pageId,
      name: "Newsletter",
      path: SIGNUP_PAGE_PATH,
      title: `"Newsletter"`,
      meta: {},
      rootInstanceId: bodyId,
    });
    base.pages.folders.get("root")?.children.push(pageId);
    return base;
  };

  // The earlier form's elements, by role, at their place in its render order.
  const legacyRoles = [
    [0, "ResourceForm", undefined],
    [2, "ws:element", "div"],
    [3, "ws:element", "label"],
    [4, "ws:element", "input"],
    [5, "ws:element", "label"],
    [6, "ws:element", "input"],
    [7, "ws:element", "label"],
    [8, "ws:element", "input"],
    [9, "ws:element", "button"],
    [10, "ws:element", "div"],
    [11, "ws:element", "div"],
  ] as const;

  test("becomes the ResourceForm on the next provision under its element ids, and keeps nothing else of the earlier form", async () => {
    const merged = await mergeSignupFormIntoBuild(await legacyBuild(), args);
    expectNothingDangles(merged);
    const fresh = await mergeSignupFormIntoBuild(makeBase(), args);

    // exactly what a new org gets, the replaced records where they were
    const byId = <Item extends { id: string }>(items: Item[]) =>
      [...items].sort((a, b) => a.id.localeCompare(b.id));
    for (const key of [
      "instances",
      "props",
      "dataSources",
      "resources",
    ] as const) {
      expect(byId<{ id: string }>(merged[key])).toEqual(
        byId<{ id: string }>(fresh[key])
      );
    }
    expect(merged.pages).toEqual(fresh.pages);
    expect(merged.instances.map((i) => i.component)).not.toContain("Form");
    expect(merged.resources.map((r) => r.name)).toEqual([SIGNUP_RESOURCE_NAME]);
    expect(merged.props.map((prop) => prop.name)).not.toContain("state");

    // every element keeps the id it had, as the element of the same role
    const instances = new Map(merged.instances.map((i) => [i.id, i]));
    for (const [n, component, tag] of legacyRoles) {
      const instance = instances.get(await legacyId(n));
      expect({ n, component: instance?.component, tag: instance?.tag }).toEqual(
        { n, component, tag }
      );
    }
    const inputNames = await Promise.all(
      ([4, 6, 8] as const).map(async (n) => {
        const id = await legacyId(n);
        const prop = merged.props.find(
          (prop) => prop.instanceId === id && prop.name === "name"
        );
        return prop?.type === "string" ? prop.value : undefined;
      })
    );
    expect(inputNames).toEqual(["email", "first_name", "last_name"]);
    // and so does formState
    expect(
      merged.dataSources.find(
        (dataSource) =>
          dataSource.type === "variable" && dataSource.name === "formState"
      )?.id
    ).toBe(await legacyId(1));
  });

  test("an org's styles, props and the children it added stay on the same elements", async () => {
    const legacy = await legacyBuild();
    const [form, content, emailInput, button] = await Promise.all(
      [0, 2, 4, 9].map(legacyId)
    );
    const { bodyId } = await buildSignupFormData(args);
    // The styles column, which provisioning never writes, keyed by element.
    const styleSourceSelections = [
      { instanceId: form, values: ["org-form-local"] },
      { instanceId: emailInput, values: ["org-email-local", "org-token"] },
    ];
    const styles = [
      {
        styleSourceId: "org-form-local",
        breakpointId: "base",
        property: "gap",
        value: { type: "unit", unit: "px", value: 12 },
      },
    ];
    // A prop and children the org added in the builder.
    legacy.props.push({
      id: "org-placeholder",
      instanceId: emailInput,
      name: "placeholder",
      type: "string",
      value: "you@example.org",
    });
    const added = (id: string, tag: string): Instance => ({
      type: "instance",
      id,
      component: "ws:element",
      tag,
      children: [{ type: "text", value: id }],
    });
    legacy.instances.push(
      added("org-heading", "h1"),
      added("org-note", "p"),
      added("org-hint", "p")
    );
    const instance = (id: string) => legacy.instances.find((i) => i.id === id)!;
    instance(bodyId).children.unshift({ type: "id", value: "org-heading" });
    instance(content).children.push({ type: "id", value: "org-note" });
    instance(form).children.splice(1, 0, { type: "id", value: "org-hint" });

    const merged = await mergeSignupFormIntoBuild(legacy, args);
    expectNothingDangles(merged);
    const byId = new Map(merged.instances.map((i) => [i.id, i]));

    // the styles still name the same elements
    expect(byId.get(form)?.component).toBe("ResourceForm");
    expect(
      merged.props.find(
        (prop) => prop.instanceId === emailInput && prop.name === "name"
      )
    ).toMatchObject({ value: "email" });
    const styled = styleSourceSelections.find(({ values }) =>
      values.includes(styles[0].styleSourceId)
    );
    expect(byId.get(styled!.instanceId)?.component).toBe("ResourceForm");
    for (const { instanceId } of styleSourceSelections) {
      expect(byId.has(instanceId)).toBe(true);
    }
    // the org's prop is kept
    expect(merged.props).toContainEqual(
      expect.objectContaining({ id: "org-placeholder", instanceId: emailInput })
    );
    // and each child stays where the org put it
    const ids = (id: string) =>
      byId
        .get(id)!
        .children.flatMap((child) =>
          child.type === "id" ? [child.value] : []
        );
    expect(ids(bodyId)).toEqual(["org-heading", form]);
    expect(ids(form)).toEqual([
      content,
      "org-hint",
      await legacyId(10),
      await legacyId(11),
    ]);
    expect(ids(content).slice(-2)).toEqual([button, "org-note"]);
    for (const id of ["org-heading", "org-note", "org-hint"]) {
      expect(byId.get(id)).toEqual(added(id, byId.get(id)!.tag!));
    }

    // and a second provision changes nothing more
    expect(
      await mergeSignupFormIntoBuild(structuredClone(merged), args)
    ).toEqual(merged);
  });

  // The builder's "Wrap in" keeps the wrapped element's id and gives the
  // wrapper a new one, in the wrapped element's place.
  describe("an element the org wrapped", () => {
    const wrap = (
      build: BuildContent,
      parentId: string,
      wrappedIds: string[],
      wrapperId: string
    ) => {
      const parent = build.instances.find((i) => i.id === parentId)!;
      const at = parent.children.findIndex(
        (child) => child.type === "id" && child.value === wrappedIds[0]
      );
      parent.children = parent.children.filter(
        (child) =>
          child.type !== "id" || wrappedIds.includes(child.value) === false
      );
      parent.children.splice(at, 0, { type: "id", value: wrapperId });
      build.instances.push({
        type: "instance",
        id: wrapperId,
        component: "ws:element",
        tag: "div",
        children: wrappedIds.map((value) => ({ type: "id", value })),
      });
      return build;
    };

    // Every element of the form is in the tree exactly once.
    const expectEachPresetElementOnce = async (build: BuildContent) => {
      const { data, bodyId } = await buildSignupFormData(args);
      const counts = new Map<string, number>();
      for (const instance of build.instances) {
        for (const child of instance.children) {
          if (child.type === "id") {
            counts.set(child.value, (counts.get(child.value) ?? 0) + 1);
          }
        }
      }
      const presetIds = [...data.instances.keys()].filter(
        (id) => id !== bodyId
      );
      expect(presetIds.map((id) => [id, counts.get(id)])).toEqual(
        presetIds.map((id) => [id, 1])
      );
    };

    test("the form in a container in the body stays in it, provisioned twice", async () => {
      const { bodyId } = await buildSignupFormData(args);
      const form = await legacyId(0);
      const provisioned = await mergeSignupFormIntoBuild(makeBase(), args);
      const wrapped = wrap(provisioned, bodyId, [form], "org-container");

      const once = await mergeSignupFormIntoBuild(
        structuredClone(wrapped),
        args
      );
      const twice = await mergeSignupFormIntoBuild(structuredClone(once), args);

      for (const build of [once, twice]) {
        expectNothingDangles(build);
        await expectEachPresetElementOnce(build);
        expect(childIds(build, bodyId)).toEqual(["org-container"]);
        expect(childIds(build, "org-container")).toEqual([form]);
      }
      expect(twice).toEqual(once);
    });

    test("the email label and input in a row inside the content stay in it, provisioned twice", async () => {
      const [content, emailLabel, emailInput, firstLabel, firstInput] =
        await Promise.all([2, 3, 4, 5, 6].map(legacyId));
      const [lastLabel, lastInput, button] = await Promise.all(
        [7, 8, 9].map(legacyId)
      );
      const wrapped = wrap(
        await legacyBuild(),
        content,
        [emailLabel, emailInput],
        "org-row"
      );

      const once = await mergeSignupFormIntoBuild(
        structuredClone(wrapped),
        args
      );
      const twice = await mergeSignupFormIntoBuild(structuredClone(once), args);

      for (const build of [once, twice]) {
        expectNothingDangles(build);
        await expectEachPresetElementOnce(build);
        expect(childIds(build, content)).toEqual([
          "org-row",
          firstLabel,
          firstInput,
          lastLabel,
          lastInput,
          button,
        ]);
        expect(childIds(build, "org-row")).toEqual([emailLabel, emailInput]);
      }
      expect(twice).toEqual(once);
    });
  });

  test("a child the org put after a template text stays after it", async () => {
    const legacy = await legacyBuild();
    const [emailLabel, button] = await Promise.all([3, 9].map(legacyId));
    const instance = (id: string) => legacy.instances.find((i) => i.id === id)!;
    // a link after the label's text, an icon after "Sign up", and a badge the
    // org put before the button's text
    instance(emailLabel).children = [
      { type: "text", value: "Email" },
      { type: "id", value: "org-link" },
    ];
    instance(button).children = [
      { type: "id", value: "org-badge" },
      { type: "text", value: "Sign up" },
      { type: "id", value: "org-icon" },
    ];
    for (const id of ["org-link", "org-icon", "org-badge"]) {
      legacy.instances.push({
        type: "instance",
        id,
        component: "ws:element",
        tag: "span",
        children: [],
      });
    }

    const merged = await mergeSignupFormIntoBuild(legacy, args);
    expectNothingDangles(merged);
    const children = (id: string) =>
      merged.instances.find((i) => i.id === id)!.children;

    expect(children(emailLabel)).toEqual([
      { type: "text", value: "Email", placeholder: true },
      { type: "id", value: "org-link" },
    ]);
    expect(children(button)).toEqual([
      { type: "id", value: "org-badge" },
      { type: "text", value: "Sign up", placeholder: true },
      { type: "id", value: "org-icon" },
    ]);
    expect(
      await mergeSignupFormIntoBuild(structuredClone(merged), args)
    ).toEqual(merged);
  });

  test("provisioning writes no formComponentIdentityVersion marker, so the build's other stored Forms read as before", async () => {
    // An org's own Form, made in the builder before 0.309.0.
    const base = makeBase();
    base.instances[0].children.push({ type: "id", value: "their-form" });
    base.instances.push({
      type: "instance",
      id: "their-form",
      component: "Form",
      children: [],
    });
    const { context, state } = makeBuildRowContext(base);

    await seedSignupFormPage(context, args);

    // what provisioning wrote, as it wrote it
    expect(state.writes).toHaveLength(1);
    const writtenPages: unknown = JSON.parse(state.row.pages);
    expect(writtenPages).toHaveProperty("homePageId");
    expect(writtenPages).not.toHaveProperty("formComponentIdentityVersion");

    // read as 0.309.0 loads a build
    const instances = JSON.parse(state.row.instances) as Instance[];
    migrateResourceFormInstancesMutable(
      instances,
      hasHistoricalFormComponentIdentityVersion(writtenPages)
    );
    const byId = new Map(instances.map((i) => [i.id, i.component]));
    expect(byId.get("their-form")).toBe("WebhookForm");
    expect(
      instances.filter((i) => i.component === "ResourceForm")
    ).toHaveLength(1);
  });
});

// Every org host sends these paths to the platform (a 308 to the account
// sign-up for /signup), so a site page under any of them never renders.
const ORG_HOST_REDIRECTED_PREFIXES = [
  "/login",
  "/signup",
  "/reset-password",
  "/auth",
  "/workspace-auth",
  "/dashboard",
  "/account",
  "/onboarding",
  "/meetings",
  "/embed",
  "/api",
];

describe("SIGNUP_PAGE_PATH", () => {
  test.each(ORG_HOST_REDIRECTED_PREFIXES)(
    "is not under %s, which every org host redirects",
    (prefix) => {
      expect(SIGNUP_PAGE_PATH.startsWith(prefix)).toBe(false);
    }
  );

  test("is where the page is seeded", async () => {
    const merged = await mergeSignupFormIntoBuild(makeBase(), args);
    const { pageId } = await buildSignupFormData(args);
    expect(merged.pages.pages.get(pageId)?.path).toBe(SIGNUP_PAGE_PATH);
    expect(await uuidV5("project-1:signup:page")).toBe(pageId);
  });
});

describe("seedSignupFormPage", () => {
  const makeContext = (builderSaves: number) =>
    makeBuildRowContext(makeBase(), builderSaves);

  test("writes with compare-and-swap on the version, bumps it, and then writes nothing", async () => {
    const { context, state } = makeContext(0);
    await seedSignupFormPage(context, args);

    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({
      version: 4,
      match: {
        id: "build-1",
        version: 3,
        updatedAt: "2026-11-01T00:00:00.000Z",
      },
    });
    expect(
      [...parsePages(state.row.pages).pages.values()].map((page) => page.path)
    ).toEqual(["", "/newsletter"]);
    expect(JSON.parse(state.row.pages)).not.toHaveProperty(
      "formComponentIdentityVersion"
    );
    expect(
      (JSON.parse(state.row.instances) as Instance[]).map(
        (instance) => instance.component
      )
    ).toContain("ResourceForm");

    await seedSignupFormPage(context, args);
    expect(state.writes).toHaveLength(1);
    expect(state.row.version).toBe(4);
  });

  test("retries after a builder save lands first", async () => {
    const { context, state } = makeContext(1);
    await seedSignupFormPage(context, args);

    expect(state.writes.map((write) => write.match)).toEqual([
      { id: "build-1", version: 3, updatedAt: "2026-11-01T00:00:00.000Z" },
      { id: "build-1", version: 4, updatedAt: "2026-11-01T00:00:00.000Z" },
    ]);
    expect(state.row.version).toBe(5);
  });
});
