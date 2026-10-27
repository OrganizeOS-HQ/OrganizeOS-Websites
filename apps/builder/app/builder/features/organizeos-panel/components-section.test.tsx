import { beforeEach, describe, expect, test } from "vitest";
import { renderTemplate, type TemplateMeta } from "@webstudio-is/template";
import { coreMetas, type WsComponentMeta } from "@webstudio-is/sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import * as radixMetas from "@webstudio-is/sdk-components-react-radix/metas";
import { platformUrl } from "~/shared/branding";
import {
  $organizeosSite,
  $registeredComponentMetas,
  $registeredTemplates,
} from "~/shared/nano-states";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import {
  $organizeosComponentGroups,
  getWorkspaceAreaUrl,
  groupOrganizeosBlocks,
  manageLink,
  organizeosGroupLabel,
  withOrganizeosGroups,
  type ComponentsPanelMeta,
} from "./components-section";

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
          {
            name: `${namespace}:Marquee`,
            label: "Marquee",
            description: organizeosTemplates.Marquee.description,
            icon: organizeosTemplates.Marquee.icon,
            firstInstance: expect.objectContaining({
              component: `${namespace}:Marquee`,
            }),
          },
          {
            name: `${namespace}:ConvergenceField`,
            label: "Convergence Field",
            description: organizeosTemplates.ConvergenceField.description,
            icon: organizeosTemplates.ConvergenceField.icon,
            firstInstance: expect.objectContaining({
              component: `${namespace}:ConvergenceField`,
            }),
          },
        ],
      },
      {
        label: "Content",
        // no workspace area: a designer binds it to a collection's item
        area: undefined,
        blocks: [
          {
            name: `${namespace}:RichText`,
            label: "Rich Text",
            description: organizeosTemplates.RichText.description,
            icon: organizeosTemplates.RichText.icon,
            firstInstance: expect.objectContaining({
              component: `${namespace}:RichText`,
            }),
          },
        ],
      },
      {
        label: "Events",
        // the Website area, the one link the Signups share
        area: { label: "Manage in OrganizeOS ↗", path: "website" },
        blocks: [
          {
            name: `${namespace}:EventList`,
            label: "Event List",
            description: organizeosTemplates.EventList.description,
            icon: organizeosTemplates.EventList.icon,
            firstInstance: expect.objectContaining({
              component: `${namespace}:ShareCodeCarrier`,
              label: "Event List",
            }),
          },
          {
            name: `${namespace}:EventCard`,
            label: "Event Card",
            description: organizeosTemplates.EventCard.description,
            icon: organizeosTemplates.EventCard.icon,
            firstInstance: expect.objectContaining({
              component: `${namespace}:ShareCodeCarrier`,
              label: "Event Card",
            }),
          },
          {
            name: `${namespace}:RsvpForm`,
            label: "RSVP Form",
            description: organizeosTemplates.RsvpForm.description,
            icon: organizeosTemplates.RsvpForm.icon,
            // the one Events block whose root is its own component
            firstInstance: expect.objectContaining({
              component: `${namespace}:RsvpForm`,
            }),
          },
        ],
      },
      {
        label: "Signups",
        area: { label: "Manage in OrganizeOS ↗", path: "website" },
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
    ]);
  });

  test("Rotating Tabs has its own icon, not the one of upstream's Tabs it starts with", () => {
    expect(organizeosTemplates.RotatingTabs.icon).toEqual(expect.any(String));
    expect(organizeosTemplates.RotatingTabs.icon).not.toBe(
      radixMetas.Tabs.icon
    );
  });

  test("Marquee, Convergence Field and Rich Text have their own icons, not one of an upstream component", () => {
    const upstreamIcons = new Set(
      [
        ...Object.values(defaultMetas),
        ...Object.values(radixMetas),
        ...Object.values(coreMetas),
      ].map((meta) => (meta as WsComponentMeta).icon)
    );
    for (const template of [
      organizeosTemplates.Marquee,
      organizeosTemplates.ConvergenceField,
      organizeosTemplates.RichText,
    ]) {
      expect(template.icon).toEqual(expect.any(String));
      expect(upstreamIcons.has(template.icon)).toBe(false);
    }
    expect(organizeosTemplates.ConvergenceField.icon).not.toBe(
      organizeosTemplates.Marquee.icon
    );
    // not Markdown Embed's, the upstream block it is styled like
    expect(organizeosTemplates.RichText.icon).not.toBe(
      defaultMetas.MarkdownEmbed.icon
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
      [
        "Sections",
        [
          `${namespace}:RotatingTabs`,
          `${namespace}:Marquee`,
          `${namespace}:ConvergenceField`,
        ],
      ],
      ["Content", [`${namespace}:RichText`]],
      [
        "Events",
        [
          `${namespace}:EventList`,
          `${namespace}:EventCard`,
          `${namespace}:RsvpForm`,
        ],
      ],
      ["Signups", [`${namespace}:SignupForm`]],
      ["More", [`${namespace}:FutureBlock`]],
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
      [
        "Sections",
        [
          `${namespace}:RotatingTabs`,
          `${namespace}:Marquee`,
          `${namespace}:ConvergenceField`,
        ],
      ],
      ["Content", [`${namespace}:RichText`]],
      ["Events", [`${namespace}:EventList`, `${namespace}:EventCard`]],
      ["Signups", [`${namespace}:SignupForm`]],
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

  test("links the Manage link to the Website area, the menu's own link", () => {
    expect(getWorkspaceAreaUrl(site, manageLink.path)).toBe(site.manageUrl);
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

describe("$organizeosComponentGroups", () => {
  const site: OrganizeosSite = {
    organizationId: "org-1",
    manageUrl: "https://app.organizeos.org/dashboard",
    platformUrl: "https://app.organizeos.org",
    blocksEnabled: true,
  };
  const registerLibrary = (library: Record<string, TemplateMeta>) => {
    $registeredComponentMetas.set(metas);
    $registeredTemplates.set(new Map(register(library, `${namespace}:`)));
  };

  beforeEach(() => {
    $registeredComponentMetas.set(new Map());
    $registeredTemplates.set(new Map());
    $organizeosSite.set(undefined);
  });

  test("empty off the allowlist", () => {
    registerLibrary(organizeosTemplates);
    $organizeosSite.set({ ...site, blocksEnabled: false });
    expect($organizeosComponentGroups.get()).toEqual([]);
  });

  test("empty for a project no org owns", () => {
    registerLibrary(organizeosTemplates);
    expect($organizeosComponentGroups.get()).toEqual([]);
  });

  test("empty with the library unregistered", () => {
    $organizeosSite.set(site);
    expect($organizeosComponentGroups.get()).toEqual([]);
  });

  test("on the allowlist, one OrganizeOS group with the blocks in order, More last, and one Manage link", () => {
    registerLibrary({
      ...organizeosTemplates,
      FutureBlock: organizeosTemplates.SignupForm,
    });
    $organizeosSite.set(site);
    const groups = $organizeosComponentGroups.get();
    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.category).toBe("organizeos");
    expect(group.metas.map((meta) => meta.name)).toEqual(
      [
        "RotatingTabs",
        "Marquee",
        "ConvergenceField",
        "RichText",
        "EventList",
        "EventCard",
        "RsvpForm",
        "SignupForm",
        "FutureBlock",
      ].map((name) => `${namespace}:${name}`)
    );
    // in the Components panel's Meta shape, with the block's own card
    expect(group.metas[0]).toEqual({
      name: `${namespace}:RotatingTabs`,
      category: "organizeos",
      order: undefined,
      label: "Rotating Tabs",
      description: organizeosTemplates.RotatingTabs.description,
      icon: organizeosTemplates.RotatingTabs.icon,
      firstInstance: expect.objectContaining({
        component: "@webstudio-is/sdk-components-react-radix:Tabs",
      }),
    });
    expect(group.link).toEqual({
      label: "Manage in OrganizeOS ↗",
      path: "website",
    });
  });

  test("the Manage link shows with any block that reads the org's data, and not with only the others", () => {
    $organizeosSite.set(site);
    registerLibrary({ RsvpForm: organizeosTemplates.RsvpForm });
    expect($organizeosComponentGroups.get()[0].link).toBe(manageLink);
    registerLibrary({ SignupForm: organizeosTemplates.SignupForm });
    expect($organizeosComponentGroups.get()[0].link).toBe(manageLink);
    registerLibrary({
      Marquee: organizeosTemplates.Marquee,
      RichText: organizeosTemplates.RichText,
    });
    expect($organizeosComponentGroups.get()[0].link).toBeUndefined();
  });
});

describe("withOrganizeosGroups", () => {
  const meta = (label: string, category: string): ComponentsPanelMeta => ({
    name: label.replaceAll(" ", ""),
    category,
    order: undefined,
    label,
    description: undefined,
    firstInstance: { component: label.replaceAll(" ", "") },
  });
  const general = { category: "general", metas: [meta("Box", "general")] };
  const typography = {
    category: "typography",
    metas: [meta("Heading", "typography")],
  };
  const blocks = {
    category: "organizeos" as const,
    metas: [
      meta("Event List", "organizeos"),
      meta("RSVP Form", "organizeos"),
      meta("Signup Form", "organizeos"),
    ],
  };
  const html = { documentType: "html", search: "" };

  test("puts the group after General", () => {
    expect(
      withOrganizeosGroups([general, typography], [blocks], html).map(
        (group) => group.category
      )
    ).toEqual(["general", "organizeos", "typography"]);
  });

  test("puts it first when General is absent", () => {
    expect(
      withOrganizeosGroups([typography], [blocks], html).map(
        (group) => group.category
      )
    ).toEqual(["organizeos", "typography"]);
  });

  test("places two OrganizeOS groups in their order and searches both", () => {
    const second = {
      category: "organizeos" as const,
      metas: [meta("Hero Section", "organizeos")],
    };
    expect(
      withOrganizeosGroups([general, typography], [blocks, second], html).map(
        (group) => group.metas.map((meta) => meta.label)
      )
    ).toEqual([
      ["Box"],
      ["Event List", "RSVP Form", "Signup Form"],
      ["Hero Section"],
      ["Heading"],
    ]);
    expect(
      withOrganizeosGroups([], [blocks, second], {
        documentType: "html",
        search: "e",
      }).flatMap((group) => group.metas.map((meta) => meta.label))
    ).toEqual(expect.arrayContaining(["Event List", "Hero Section"]));
  });

  test("returns its input unchanged on an XML page", () => {
    const groups = [general, typography];
    for (const search of ["", "rsvp"]) {
      const result = withOrganizeosGroups(groups, [blocks], {
        documentType: "xml",
        search,
      });
      expect(result).toBe(groups);
      expect(result).toEqual([general, typography]);
    }
  });

  test("returns its input unchanged with no OrganizeOS group", () => {
    const groups = [general, typography];
    const result = withOrganizeosGroups(groups, [], html);
    expect(result).toBe(groups);
    expect(result).toEqual([general, typography]);
  });

  test("ranks matching blocks together with upstream's matches in one Found group", () => {
    // as upstream's search hands them over: one Found group of its matches
    const found = {
      category: "found",
      metas: [meta("Form", "forms"), meta("Platform Logo", "general")],
    };
    const result = withOrganizeosGroups([found], [blocks], {
      documentType: "html",
      search: "form",
    });
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("found");
    // a block ranks between upstream's matches: the equal match, the word
    // starts, then the match inside a word
    expect(result[0].metas.map((meta) => meta.label)).toEqual([
      "Form",
      "RSVP Form",
      "Signup Form",
      "Platform Logo",
    ]);
  });

  test("builds the Found group when upstream's search returned [] and a block matches (rsvp)", () => {
    expect(
      withOrganizeosGroups([], [blocks], {
        documentType: "html",
        search: "rsvp",
      })
    ).toEqual([{ category: "found", metas: [blocks.metas[1]] }]);
  });

  test("returns no group when nothing matches", () => {
    expect(
      withOrganizeosGroups([], [blocks], {
        documentType: "html",
        search: "zzzz",
      })
    ).toEqual([]);
  });
});

describe("organizeosGroupLabel", () => {
  test("OrganizeOS for the group, undefined for upstream's categories", () => {
    expect(organizeosGroupLabel("organizeos")).toBe("OrganizeOS");
    for (const category of ["general", "typography", "found", "radix"]) {
      expect(organizeosGroupLabel(category)).toBeUndefined();
    }
  });
});
