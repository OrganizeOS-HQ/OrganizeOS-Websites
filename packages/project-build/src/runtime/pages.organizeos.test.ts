// OrganizeOS fork: a page never takes a path the platform serves on the
// site's host, and a page already there keeps saving (docs/ORGANIZEOS-FORK.md
// section 7)
import { describe, expect, test } from "vitest";
import { migratePages } from "@webstudio-is/project-migrations/pages";
import type { Page, Pages } from "@webstudio-is/sdk";
import { createRootFolder } from "../shared/pages-utils";
import {
  getPageSettingsValues,
  pageSettingsDefaultValues,
  validatePageSettings,
  type PageSettingsValues,
} from "./pages";

const PLATFORM = "The platform uses this path";

const page = (id: string, path: string): Page => ({
  id,
  name: id,
  path,
  title: `"${id}"`,
  meta: {},
  rootInstanceId: `${id}Body`,
});

const createPages = () =>
  migratePages({
    meta: {},
    homePage: page("home", ""),
    pages: [
      page("join", "/join"),
      page("about", "/about"),
      page("eventItem", "/:slug"),
    ],
    folders: [
      createRootFolder(["home", "join", "about", "events"]),
      { id: "events", name: "Events", slug: "events", children: ["eventItem"] },
    ],
  });

const createPageSettingsValues = (
  values: Partial<PageSettingsValues> = {}
): PageSettingsValues => ({
  ...pageSettingsDefaultValues,
  auth: { ...pageSettingsDefaultValues.auth },
  customMetas: [...pageSettingsDefaultValues.customMetas],
  marketplace: { ...pageSettingsDefaultValues.marketplace },
  ...values,
});

const validate = (
  pages: Pages,
  pageId: string | undefined,
  values: PageSettingsValues
) => validatePageSettings({ pages, pageId, values, variableValues: new Map() });

const newPageErrors = async (values: Partial<PageSettingsValues>) => {
  const pages = createPages();
  return validate(
    pages,
    undefined,
    createPageSettingsValues({ parentFolderId: pages.rootFolderId, ...values })
  );
};

const ownValues = (pages: Pages, pageId: string) => {
  const stored = pages.pages.get(pageId);
  if (stored === undefined) {
    throw new Error(`No page "${pageId}"`);
  }
  return getPageSettingsValues({ page: stored, pages, isHomePage: false });
};

describe("the platform path guard", () => {
  test("a new page at /join is refused", async () => {
    const errors = await newPageErrors({ path: "/join" });
    expect(errors.path).toEqual(
      expect.arrayContaining(["All paths must be unique", PLATFORM])
    );
  });

  test("a new page at /join/ is refused", async () => {
    const errors = await newPageErrors({ path: "/join/" });
    expect(errors.path).toEqual(
      expect.arrayContaining(["Can't end with a /", PLATFORM])
    );
  });

  test("a new /events/:slug is refused, at the root and in a folder slugged events", async () => {
    const atRoot = await newPageErrors({ path: "/events/:slug" });
    expect(atRoot.path).toContain(PLATFORM);
    const inFolder = await newPageErrors({
      path: "/:slug",
      parentFolderId: "events",
    });
    expect(inFolder.path).toContain(PLATFORM);
  });

  test("/giving/manage is refused", async () => {
    const errors = await newPageErrors({ path: "/giving/manage" });
    expect(errors.path).toContain(PLATFORM);
  });

  test("/events, /join-us and /give are allowed", async () => {
    for (const path of ["/events", "/join-us", "/give"]) {
      const errors = await newPageErrors({ path });
      expect(errors.path ?? []).not.toContain(PLATFORM);
    }
  });

  test("an existing page on a served path still saves", async () => {
    const pages = createPages();
    const errors = await validate(pages, "join", {
      ...ownValues(pages, "join"),
      title: `"Join the union"`,
    });
    expect(errors).toEqual({});
  });

  test("an existing page in a folder on a served path still saves", async () => {
    const pages = createPages();
    const errors = await validate(
      pages,
      "eventItem",
      ownValues(pages, "eventItem")
    );
    expect(errors).toEqual({});
  });

  test("an existing page moved onto a served path is refused", async () => {
    const pages = createPages();
    const errors = await validate(pages, "about", {
      ...ownValues(pages, "about"),
      path: "/donate",
    });
    expect(errors.path).toContain(PLATFORM);
  });

  test("the home page is never refused", async () => {
    const pages = createPages();
    const home = pages.pages.get(pages.homePageId);
    if (home === undefined) {
      throw new Error("No home page");
    }
    const errors = await validate(
      pages,
      home.id,
      getPageSettingsValues({ page: home, pages, isHomePage: true })
    );
    expect(errors.path ?? []).not.toContain(PLATFORM);
  });
});
