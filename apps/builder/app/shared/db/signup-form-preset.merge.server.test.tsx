import { describe, expect, test } from "vitest";
import {
  parsePages,
  serializePages,
} from "@webstudio-is/project-build/index.server";
import { SIGNUP_PAGE_PATH, uuidV5 } from "../organizeos-preset-ids";
import {
  buildSignupFormData,
  mergeSignupFormIntoBuild,
  seedSignupFormPage,
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

  test("carries the Form, its action resource, and the token variable into the build", async () => {
    const merged = await mergeSignupFormIntoBuild(makeBase(), args);
    expect(merged.instances.some((i) => i.component === "Form")).toBe(true);
    const action = merged.resources.find((r) => r.name === "action");
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
      const action = merged.resources.find((r) => r.name === "action");
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
  // Stateful fake of the Build table; the update honours its match on version.
  const makeContext = (builderSaves: number) => {
    const base = makeBase();
    const row = {
      id: "build-1",
      version: 3,
      instances: JSON.stringify(base.instances),
      props: "[]",
      dataSources: "[]",
      resources: "[]",
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

  test("writes with compare-and-swap on the version, bumps it, and then writes nothing", async () => {
    const { context, state } = makeContext(0);
    await seedSignupFormPage(context, args);

    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({
      version: 4,
      match: { id: "build-1", version: 3 },
    });
    expect(
      [...parsePages(state.row.pages).pages.values()].map((page) => page.path)
    ).toEqual(["", "/newsletter"]);

    await seedSignupFormPage(context, args);
    expect(state.writes).toHaveLength(1);
    expect(state.row.version).toBe(4);
  });

  test("retries after a builder save lands first", async () => {
    const { context, state } = makeContext(1);
    await seedSignupFormPage(context, args);

    expect(state.writes.map((write) => write.match)).toEqual([
      { id: "build-1", version: 3 },
      { id: "build-1", version: 4 },
    ]);
    expect(state.row.version).toBe(5);
  });
});
