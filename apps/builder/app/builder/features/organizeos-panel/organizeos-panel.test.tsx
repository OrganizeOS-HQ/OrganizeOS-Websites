import { describe, expect, test } from "vitest";
import { renderTemplate, type TemplateMeta } from "@webstudio-is/template";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import * as radixMetas from "@webstudio-is/sdk-components-react-radix/metas";
import { platformUrl } from "~/shared/branding";
import { $organizeosSite } from "~/shared/nano-states";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import {
  $isOrganizeosPanelAvailable,
  getWorkspaceAreaUrl,
  groupOrganizeosBlocks,
} from "./organizeos-panel";

const namespace = "@organizeos/site-components";

// What registerComponentLibrary puts in the registry for a library.
const register = (
  library: Record<string, TemplateMeta>,
  prefix: string
): Array<[string, ReturnType<typeof generate>]> =>
  Object.entries(library).map(([name, meta]) => [
    `${prefix}${name}`,
    generate(meta),
  ]);
const generate = ({ template, ...meta }: TemplateMeta) => ({
  ...meta,
  template: renderTemplate(template),
});

const metas = new Map<string, WsComponentMeta>(
  Object.entries(organizeosMetas).map(([name, meta]) => [
    `${namespace}:${name}`,
    meta,
  ])
);

describe("groupOrganizeosBlocks", () => {
  test("lists the namespace's templates in their sections, and nothing else", () => {
    const templates = new Map([
      ...register(organizeosTemplates, `${namespace}:`),
      ...register(
        { Sheet: organizeosTemplates.SignupForm },
        "@webstudio-is/sdk-components-react-radix:"
      ),
    ]);

    expect(groupOrganizeosBlocks(templates, metas)).toEqual([
      {
        label: "Sections",
        // no workspace area: the block reads no platform data
        area: undefined,
        blocks: [
          {
            name: `${namespace}:RotatingTabs`,
            label: "Rotating Tabs",
            description: organizeosTemplates.RotatingTabs.description,
            // its own icon, not upstream Tabs' (the card's fallback)
            icon: organizeosTemplates.RotatingTabs.icon,
            firstInstance: expect.objectContaining({
              component: "@webstudio-is/sdk-components-react-radix:Tabs",
            }),
          },
        ],
      },
      {
        label: "Events",
        area: { label: "Manage events in OrganizeOS", path: "events" },
        blocks: [
          {
            name: `${namespace}:EventList`,
            label: "Event List",
            description: organizeosTemplates.EventList.description,
            icon: organizeosTemplates.EventList.icon,
            firstInstance: expect.objectContaining({
              component: "ws:element",
              label: "Event List",
            }),
          },
          {
            name: `${namespace}:EventCard`,
            label: "Event Card",
            description: organizeosTemplates.EventCard.description,
            icon: organizeosTemplates.EventCard.icon,
            firstInstance: expect.objectContaining({
              component: "ws:element",
              label: "Event Card",
            }),
          },
          {
            name: `${namespace}:RsvpForm`,
            label: "RSVP Form",
            description: organizeosTemplates.RsvpForm.description,
            icon: organizeosTemplates.RsvpForm.icon,
            // the one Events block whose root is a component of the namespace
            firstInstance: expect.objectContaining({
              component: `${namespace}:RsvpForm`,
            }),
          },
        ],
      },
      {
        label: "Signups",
        area: { label: "Manage forms in OrganizeOS", path: "pages/embeds" },
        blocks: [
          {
            name: `${namespace}:SignupForm`,
            label: "Signup Form",
            description: organizeosTemplates.SignupForm.description,
            icon: undefined,
            firstInstance: expect.objectContaining({
              component: `${namespace}:SignupForm`,
            }),
          },
        ],
      },
      // registered ahead of its Sections entry (phase 3B plan, amendment 1)
      {
        label: "More",
        blocks: [
          {
            name: `${namespace}:Marquee`,
            label: "Marquee",
            description: organizeosTemplates.Marquee.description,
            icon: organizeosTemplates.Marquee.icon,
            firstInstance: expect.objectContaining({
              component: `${namespace}:Marquee`,
            }),
          },
        ],
      },
    ]);
  });

  test("Rotating Tabs has its own icon, not the one of upstream's Tabs it starts with", () => {
    expect(organizeosTemplates.RotatingTabs.icon).toEqual(expect.any(String));
    expect(organizeosTemplates.RotatingTabs.icon).not.toBe(
      radixMetas.Tabs.icon
    );
  });

  test("still offers a block no section names, after the others", () => {
    const templates = new Map([
      ...register(organizeosTemplates, `${namespace}:`),
      ...register(
        { FutureBlock: organizeosTemplates.SignupForm },
        `${namespace}:`
      ),
    ]);

    expect(
      groupOrganizeosBlocks(templates, metas).map((section) => [
        section.label,
        section.blocks.map((block) => block.name),
      ])
    ).toEqual([
      ["Sections", [`${namespace}:RotatingTabs`]],
      [
        "Events",
        [
          `${namespace}:EventList`,
          `${namespace}:EventCard`,
          `${namespace}:RsvpForm`,
        ],
      ],
      ["Signups", [`${namespace}:SignupForm`]],
      ["More", [`${namespace}:Marquee`, `${namespace}:FutureBlock`]],
    ]);
  });

  test("skips a block a section names that is not registered", () => {
    const { RsvpForm: _unregistered, ...registered } = organizeosTemplates;

    expect(
      groupOrganizeosBlocks(
        new Map(register(registered, `${namespace}:`)),
        metas
      ).map((section) => [
        section.label,
        section.blocks.map((block) => block.name),
      ])
    ).toEqual([
      ["Sections", [`${namespace}:RotatingTabs`]],
      ["Events", [`${namespace}:EventList`, `${namespace}:EventCard`]],
      ["Signups", [`${namespace}:SignupForm`]],
      ["More", [`${namespace}:Marquee`]],
    ]);
  });

  test("lists no section while the library is not registered", () => {
    expect(groupOrganizeosBlocks(new Map(), new Map())).toEqual([]);
  });
});

describe("getWorkspaceAreaUrl", () => {
  const site: OrganizeosSite = {
    organizationId: "org-1",
    subdomain: "acme",
    siteUrl: "https://acme.organizeos.org",
    manageUrl: "https://app.organizeos.org/acme/website",
    platformUrl: "https://app.organizeos.org",
    blocksEnabled: true,
  };

  test("links the org's workspace area on the app host", () => {
    expect(getWorkspaceAreaUrl(site, "pages/embeds")).toBe(
      "https://app.organizeos.org/acme/pages/embeds"
    );
    expect(getWorkspaceAreaUrl(site, "events")).toBe(
      "https://app.organizeos.org/acme/events"
    );
  });

  test("falls back to the Website area's link while the subdomain is unknown", () => {
    expect(
      getWorkspaceAreaUrl(
        {
          ...site,
          subdomain: undefined,
          siteUrl: undefined,
          manageUrl: "https://app.organizeos.org/dashboard",
        },
        "pages/embeds"
      )
    ).toBe("https://app.organizeos.org/dashboard");
  });

  test("links the platform home for a project no org owns", () => {
    expect(getWorkspaceAreaUrl(undefined, "pages/embeds")).toBe(platformUrl);
  });
});

describe("$isOrganizeosPanelAvailable", () => {
  const site: OrganizeosSite = {
    organizationId: "org-1",
    manageUrl: "https://app.organizeos.org/dashboard",
    platformUrl: "https://app.organizeos.org",
    blocksEnabled: true,
  };

  test.each([
    ["an org on the blocks' allowlist", site, true],
    ["an org off it", { ...site, blocksEnabled: false }, false],
    ["a project no org owns", undefined, false],
  ])("offers the panel to %s: %s", (_case, value, expected) => {
    $organizeosSite.set(value);
    expect($isOrganizeosPanelAvailable.get()).toBe(expected);
  });
});
