import { describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import { coreMetas, type Instance, type Resource } from "@webstudio-is/sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
// The body of GET /v1/forms, the platform's contract fixture.
import formsBody from "../../../../../../../packages/sdk-components-organizeos/src/__fixtures__/forms.json";
// The body of GET /v1/events, the platform's contract fixture.
import eventsBody from "../../../../../../../packages/sdk-components-organizeos/src/__fixtures__/events.json";
import {
  $organizeosSite,
  $registeredComponentMetas,
  $selectedInstanceKey,
  getInstanceKey,
  registerComponentLibrary,
  selectInstance,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { registerContainers } from "~/shared/sync/sync-stores";
import {
  $assets,
  $breakpoints,
  $dataSources,
  $instances,
  $pages,
  $project,
  $props,
  $resources,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import {
  $resourcesCache,
  computeResourceRequest,
  getResourceKey,
} from "~/shared/resources";
import { buildOrgResourcePresets } from "~/shared/db/resource-presets.server";
import {
  getOrganizeosPresetIds,
  insertOrganizeosBlock,
} from "~/builder/features/organizeos-panel/insert-organizeos-block";
import { renderControl } from "./combined";
import { TextControl } from "./text";
import {
  $selectedInstanceDataProp,
  OrganizeosRecordControl,
  getOrganizeosRecordOptions,
  isOrganizeosRecordProp,
} from "./organizeos-record";

enableMapSet();
registerContainers();

$registeredComponentMetas.set(
  new Map(Object.entries({ ...defaultMetas, ...coreMetas }))
);
registerComponentLibrary({
  namespace: "@organizeos/site-components",
  components: {},
  metas: organizeosMetas,
  templates: organizeosTemplates,
});

const signupForm = "@organizeos/site-components:SignupForm";
const rsvpForm = "@organizeos/site-components:RsvpForm";
const [newsletter, contactForm, membershipForm] = formsBody.data;

const none = { value: "", label: "None (org defaults)" };
const newsletterOption = {
  value: newsletter.id,
  label: "Newsletter (Newsletter)",
};
const contactOption = {
  value: contactForm.id,
  label: "Get in touch (Contact)",
};
const unavailable = (value: string) => ({ value, label: "Unavailable form" });

describe("isOrganizeosRecordProp", () => {
  test("is true for record on the Signup Form and on the RSVP Form", () => {
    expect(isOrganizeosRecordProp(signupForm, "record")).toBe(true);
    expect(isOrganizeosRecordProp(rsvpForm, "record")).toBe(true);
  });

  test.each([
    ["record on Box", "Box", "record"],
    [
      "record on another library's component",
      "@webstudio-is/sdk-components-react-radix:Select",
      "record",
    ],
    ["record on a SignupForm outside the namespace", "SignupForm", "record"],
    ["data on the Signup Form", signupForm, "data"],
    ["action on the Signup Form", signupForm, "action"],
    ["data on the RSVP Form", rsvpForm, "data"],
    ["state on the RSVP Form", rsvpForm, "state"],
    ["record on an RSVP Form outside the namespace", "RsvpForm", "record"],
    [
      "record on an OrganizeOS component the picker has no kinds for",
      "@organizeos/site-components:Field",
      "record",
    ],
    [
      "record on an unknown OrganizeOS component",
      "@organizeos/site-components:JoinForm",
      "record",
    ],
    ["record on an instance that is not there", undefined, "record"],
  ])("is false for %s", (_case, component, propName) => {
    expect(isOrganizeosRecordProp(component, propName)).toBe(false);
  });
});

describe("renderControl", () => {
  test("gives the Signup Form's and the RSVP Form's record the picker, and record anywhere else the text control", () => {
    const instance = (id: string, component: string): [string, Instance] => [
      id,
      { type: "instance", id, component, children: [] },
    ];
    $instances.set(
      new Map([
        instance("form", signupForm),
        instance("rsvp", rsvpForm),
        instance("box", "Box"),
        instance("field", "@organizeos/site-components:Field"),
      ])
    );
    const getControl = (instanceId: string, propName: string) =>
      renderControl({
        instanceId,
        meta: { type: "string", control: "text", required: false },
        prop: undefined,
        propName,
        computedValue: undefined,
        onChange: () => {},
      })?.type;

    expect(getControl("form", "record")).toBe(OrganizeosRecordControl);
    expect(getControl("form", "actionPage")).toBe(TextControl);
    expect(getControl("rsvp", "record")).toBe(OrganizeosRecordControl);
    expect(getControl("rsvp", "actionPage")).toBe(TextControl);
    expect(getControl("box", "record")).toBe(TextControl);
    expect(getControl("field", "record")).toBe(TextControl);
    expect(getControl("missing", "record")).toBe(TextControl);
  });
});

describe("getOrganizeosRecordOptions", () => {
  test("lists None first, then the newsletter and the contact form, and not the membership form", () => {
    const { options, selected, hasData } = getOrganizeosRecordOptions(
      signupForm,
      formsBody,
      undefined
    );

    expect(options).toEqual([none, newsletterOption, contactOption]);
    expect(options.some((option) => option.value === membershipForm.id)).toBe(
      false
    );
    expect(selected).toEqual(none);
    expect(hasData).toBe(true);
  });

  test("selects the form the record names", () => {
    expect(
      getOrganizeosRecordOptions(signupForm, formsBody, contactForm.id)
    ).toEqual({
      options: [none, newsletterOption, contactOption],
      selected: contactOption,
      hasData: true,
    });
  });

  test("reads the record as the block does: trimmed, and the org defaults when empty or not a string", () => {
    for (const record of [undefined, null, "", "  ", 42, { id: "x" }]) {
      expect(getOrganizeosRecordOptions(signupForm, formsBody, record)).toEqual(
        {
          options: [none, newsletterOption, contactOption],
          selected: none,
          hasData: true,
        }
      );
    }
    expect(
      getOrganizeosRecordOptions(signupForm, formsBody, ` ${newsletter.id} `)
        .selected
    ).toEqual(newsletterOption);
  });

  test.each([
    ["is not in the data", "00000000-0000-4000-8000-000000000000"],
    ["is a kind the block does not take", membershipForm.id],
  ])("keeps a record that %s as Unavailable form", (_case, record) => {
    expect(getOrganizeosRecordOptions(signupForm, formsBody, record)).toEqual({
      options: [none, unavailable(record), newsletterOption, contactOption],
      selected: unavailable(record),
      hasData: true,
    });
  });

  test.each([
    ["undefined", undefined],
    ["null", null],
    ["{}", {}],
    [`{ data: "x" }`, { data: "x" }],
    ["{ data: {} }", { data: {} }],
    ["an array", formsBody.data],
    ["the loader's error body", { error: "unauthorized" }],
  ])(
    "with no data (%s), gives None alone, plus the current value",
    (_case, data) => {
      expect(getOrganizeosRecordOptions(signupForm, data, "")).toEqual({
        options: [none],
        selected: none,
        hasData: false,
      });
      expect(
        getOrganizeosRecordOptions(signupForm, data, newsletter.id)
      ).toEqual({
        options: [none, unavailable(newsletter.id)],
        selected: unavailable(newsletter.id),
        hasData: false,
      });
    }
  );

  test("skips entries without an id, and gives None alone when that is all of them", () => {
    const withoutIds = {
      data: formsBody.data.map(({ id: _id, ...form }) => form),
    };
    expect(getOrganizeosRecordOptions(signupForm, withoutIds, "")).toEqual({
      options: [none],
      selected: none,
      hasData: true,
    });
    expect(
      getOrganizeosRecordOptions(signupForm, withoutIds, newsletter.id)
    ).toEqual({
      options: [none, unavailable(newsletter.id)],
      selected: unavailable(newsletter.id),
      hasData: true,
    });
  });

  test("skips what the block cannot use, without throwing", () => {
    const data = {
      data: [
        null,
        "form",
        42,
        [],
        { ...newsletter, id: 7 },
        { ...newsletter, id: "" },
        { ...newsletter, id: " padded " },
        { ...newsletter, id: "no-fields", fields: undefined },
        { ...newsletter, id: "unknown-kind", kind: "survey" },
        { ...newsletter, id: "no-kind", kind: undefined },
        newsletter,
        // the block takes the first form with an id, so a second is skipped
        { ...newsletter, name: "A second copy" },
        { ...contactForm, name: undefined },
      ],
    };

    expect(getOrganizeosRecordOptions(signupForm, data, "")).toEqual({
      options: [
        none,
        newsletterOption,
        { value: contactForm.id, label: "Untitled form (Contact)" },
      ],
      selected: none,
      hasData: true,
    });
  });
});

// The RSVP Form's events, as the Events Resource lists them. The moment is
// fixed so the picker's two groups do not depend on the day the tests run: it
// is after the voter registration drive (Sep 12) and the phone bank (Nov 5),
// and before the cookout, which starts at 02:00 UTC on Nov 14 (Nov 13 at 6 PM
// in Los Angeles, the event's own zone) and has no end time.
const [voterDrive, phoneBank, cookout, canvass, rally] = eventsBody.data;
const now = new Date("2026-11-10T00:00:00Z");

const option = (value: string, label: string) => ({ value, label });
const voterOption = option(
  voterDrive.id,
  "Voter Registration Drive, Sep 12, 2026 (ended)"
);
const phoneBankOption = option(
  phoneBank.id,
  "Weekly Phone Bank, Nov 5, 2026 (ended)"
);
const cookoutOption = option(cookout.id, "Neighborhood Cookout, Nov 13, 2026");
const canvassOption = option(
  canvass.id,
  "Saturday Canvass Launch, Nov 21, 2026"
);
const rallyOption = option(rally.id, "City Hall Rally, Dec 5, 2026");
const unavailableEvent = (value: string) => option(value, "Unavailable event");
// upcoming ones first, soonest first, then the ended ones, the latest first
const eventOptions = [
  cookoutOption,
  canvassOption,
  rallyOption,
  phoneBankOption,
  voterOption,
];

const eventsOf = (...events: unknown[]) => ({ data: events });

describe("getOrganizeosRecordOptions for the RSVP Form", () => {
  test("lists the upcoming events soonest first, then the ended ones marked (ended), the latest first, each as title and date", () => {
    expect(
      getOrganizeosRecordOptions(rsvpForm, eventsBody, undefined, now)
    ).toEqual({
      options: eventOptions,
      selected: undefined,
      hasData: true,
    });
  });

  test("has no None option: choosing an event is the only way to a working form", () => {
    const { options } = getOrganizeosRecordOptions(
      rsvpForm,
      eventsBody,
      undefined,
      now
    );
    expect(options.some((item) => item.value === "")).toBe(false);
    expect(options.map((item) => item.label)).not.toContain(
      "None (org defaults)"
    );
  });

  test("dates each event in its own zone: the cookout is Nov 13 where it is held, Nov 14 in UTC", () => {
    expect(cookout.start_time).toBe("2026-11-14T02:00:00+00:00");
    expect(cookout.timezone).toBe("America/Los_Angeles");
    expect(
      getOrganizeosRecordOptions(rsvpForm, eventsBody, "", now).options
    ).toContainEqual(cookoutOption);
    const inUtc = eventsOf({ ...cookout, timezone: "UTC" });
    expect(
      getOrganizeosRecordOptions(rsvpForm, inUtc, "", now).options
    ).toEqual([option(cookout.id, "Neighborhood Cookout, Nov 14, 2026")]);
  });

  test("selects the event the record names, trimmed, an ended one too", () => {
    expect(
      getOrganizeosRecordOptions(rsvpForm, eventsBody, canvass.id, now)
    ).toEqual({
      options: eventOptions,
      selected: canvassOption,
      hasData: true,
    });
    expect(
      getOrganizeosRecordOptions(
        rsvpForm,
        eventsBody,
        ` ${voterDrive.id} `,
        now
      ).selected
    ).toEqual(voterOption);
  });

  test("selects nothing for a record that is blank or not a string, as the block reads it", () => {
    for (const record of [undefined, null, "", "  ", 42, { id: canvass.id }]) {
      expect(
        getOrganizeosRecordOptions(rsvpForm, eventsBody, record, now)
      ).toEqual({
        options: eventOptions,
        selected: undefined,
        hasData: true,
      });
    }
  });

  test("keeps a record it cannot find as Unavailable event, first", () => {
    const missing = "00000000-0000-4000-8000-000000000000";
    expect(
      getOrganizeosRecordOptions(rsvpForm, eventsBody, missing, now)
    ).toEqual({
      options: [unavailableEvent(missing), ...eventOptions],
      selected: unavailableEvent(missing),
      hasData: true,
    });
  });

  test.each([
    ["undefined", undefined],
    ["null", null],
    ["{}", {}],
    [`{ data: "x" }`, { data: "x" }],
    ["{ data: {} }", { data: {} }],
    ["an array", eventsBody.data],
    ["the loader's error body", { error: "unavailable" }],
    ["a 429's error body", { error: "rate_limited", retryAfter: 30 }],
  ])(
    "with no data (%s), lists nothing, plus the current value",
    (_case, data) => {
      expect(getOrganizeosRecordOptions(rsvpForm, data, "", now)).toEqual({
        options: [],
        selected: undefined,
        hasData: false,
      });
      expect(
        getOrganizeosRecordOptions(rsvpForm, data, canvass.id, now)
      ).toEqual({
        options: [unavailableEvent(canvass.id)],
        selected: unavailableEvent(canvass.id),
        hasData: false,
      });
    }
  );

  test("an empty list is data: nothing to pick, and no hint to reload", () => {
    expect(getOrganizeosRecordOptions(rsvpForm, { data: [] }, "", now)).toEqual(
      { options: [], selected: undefined, hasData: true }
    );
  });

  test("skips what the block cannot use, without throwing", () => {
    const data = eventsOf(
      null,
      "event",
      42,
      [],
      { ...canvass, id: 7 },
      { ...canvass, id: "" },
      { ...canvass, id: " padded " },
      { ...canvass, id: undefined },
      canvass,
      // the block takes the first event with an id, so a second is skipped
      { ...canvass, title: "A second copy" },
      { ...rally, title: undefined }
    );

    expect(getOrganizeosRecordOptions(rsvpForm, data, "", now)).toEqual({
      options: [canvassOption, option(rally.id, "Untitled event, Dec 5, 2026")],
      selected: undefined,
      hasData: true,
    });
  });

  test("reads a blank or missing title as Untitled event", () => {
    const labels = [undefined, "", "   ", 7].map(
      (title) =>
        getOrganizeosRecordOptions(
          rsvpForm,
          eventsOf({ ...rally, title }),
          "",
          now
        ).options[0].label
    );
    expect(labels).toEqual(Array(4).fill("Untitled event, Dec 5, 2026"));
  });

  test("dates an event in UTC when its zone is missing or one this browser does not know, and gives a title alone when the start cannot be read", () => {
    const label = (change: Record<string, unknown>) =>
      getOrganizeosRecordOptions(
        rsvpForm,
        eventsOf({ ...rally, ...change }),
        "",
        now
      ).options[0].label;
    // 23:00 UTC on Dec 5 is still Dec 5 in UTC
    expect(label({ timezone: null })).toBe("City Hall Rally, Dec 5, 2026");
    expect(label({ timezone: undefined })).toBe("City Hall Rally, Dec 5, 2026");
    expect(label({ timezone: "Not/AZone" })).toBe(
      "City Hall Rally, Dec 5, 2026"
    );
    expect(label({ timezone: "" })).toBe("City Hall Rally, Dec 5, 2026");
    // 02:00 UTC on Dec 6 is Dec 5 in every US zone, so a fallback to the
    // platform's New York default, or to this browser's own zone, shows Dec 5.
    const lateUtc = { start_time: "2026-12-06T02:00:00Z", end_time: null };
    expect(label({ ...lateUtc, timezone: null })).toBe(
      "City Hall Rally, Dec 6, 2026"
    );
    expect(label({ ...lateUtc, timezone: undefined })).toBe(
      "City Hall Rally, Dec 6, 2026"
    );
    expect(label({ ...lateUtc, timezone: "Not/AZone" })).toBe(
      "City Hall Rally, Dec 6, 2026"
    );
    expect(label({ ...lateUtc, timezone: "" })).toBe(
      "City Hall Rally, Dec 6, 2026"
    );
    expect(label({ ...lateUtc, timezone: "America/New_York" })).toBe(
      "City Hall Rally, Dec 5, 2026"
    );
    // 23:00 UTC is Dec 6 in Tokyo
    expect(label({ timezone: "Asia/Tokyo" })).toBe(
      "City Hall Rally, Dec 6, 2026"
    );
    expect(label({ start_time: "next week" })).toBe("City Hall Rally");
    expect(label({ start_time: null })).toBe("City Hall Rally");
    expect(label({ start_time: undefined })).toBe("City Hall Rally");
  });

  test("an event whose start cannot be read is not ended, and comes after the upcoming ones that can", () => {
    const data = eventsOf(
      {
        ...rally,
        id: "unreadable",
        title: "Unreadable",
        start_time: "soon",
        end_time: null,
      },
      voterDrive,
      canvass
    );
    expect(getOrganizeosRecordOptions(rsvpForm, data, "", now).options).toEqual(
      [canvassOption, option("unreadable", "Unreadable"), voterOption]
    );
  });

  test("an event is ended when its end time is past, or its start time when it has no end time, and not while it runs", () => {
    const labelsAt = (moment: string) =>
      getOrganizeosRecordOptions(
        rsvpForm,
        eventsBody,
        "",
        new Date(moment)
      ).options.map((item) => item.label.endsWith("(ended)"));
    const byId = (moment: string) =>
      Object.fromEntries(
        getOrganizeosRecordOptions(
          rsvpForm,
          eventsBody,
          "",
          new Date(moment)
        ).options.map((item) => [item.value, item.label.endsWith("(ended)")])
      );
    // while the canvass runs (15:00 to 22:00 UTC), it is not over
    expect(byId("2026-11-21T16:00:00Z")[canvass.id]).toBe(false);
    expect(byId("2026-11-21T22:00:01Z")[canvass.id]).toBe(true);
    // the cookout has no end time: over once it has started
    expect(cookout.end_time).toBeNull();
    expect(byId("2026-11-14T01:59:59Z")[cookout.id]).toBe(false);
    expect(byId("2026-11-14T02:00:01Z")[cookout.id]).toBe(true);
    // before all of them, nothing is ended
    expect(labelsAt("2026-01-01T00:00:00Z")).toEqual(Array(5).fill(false));
    // after all of them, all are
    expect(labelsAt("2027-01-01T00:00:00Z")).toEqual(Array(5).fill(true));
  });

  test("reads an end time that is not a string as none, so the start time decides", () => {
    for (const end_time of [7, {}, [], true, undefined]) {
      expect(
        getOrganizeosRecordOptions(
          rsvpForm,
          eventsOf({ ...voterDrive, end_time }),
          "",
          now
        ).options[0].label
      ).toBe("Voter Registration Drive, Sep 12, 2026 (ended)");
    }
    expect(
      getOrganizeosRecordOptions(
        rsvpForm,
        eventsOf({ ...rally, end_time: 7 }),
        "",
        now
      ).options[0].label
    ).toBe("City Hall Rally, Dec 5, 2026");
  });

  test("lists events that start together in the order the data has them, and the ended ones the latest first", () => {
    const twin = { ...canvass, id: "twin", title: "Twin" };
    expect(
      getOrganizeosRecordOptions(
        rsvpForm,
        eventsOf(twin, canvass, voterDrive, phoneBank),
        "",
        now
      ).options.map((item) => item.value)
    ).toEqual(["twin", canvass.id, phoneBank.id, voterDrive.id]);
    expect(
      getOrganizeosRecordOptions(
        rsvpForm,
        eventsOf(canvass, twin),
        "",
        now
      ).options.map((item) => item.value)
    ).toEqual([canvass.id, "twin"]);
  });

  test("falls back to the current time when it is given no moment", () => {
    // every fixture event is in the past by 2027
    vi.useFakeTimers({ now: new Date("2027-06-01T00:00:00Z") });
    try {
      const { options } = getOrganizeosRecordOptions(rsvpForm, eventsBody, "");
      expect(options).toHaveLength(5);
      expect(options.every((item) => item.label.endsWith("(ended)"))).toBe(
        true
      );
    } finally {
      vi.useRealTimers();
    }
  });

  test("leaves the Signup Form's options as they were: forms handed to it, events handed to it", () => {
    expect(
      getOrganizeosRecordOptions(signupForm, formsBody, undefined, now).options
    ).toEqual([none, newsletterOption, contactOption]);
    // events are not forms: none has fields and a kind
    expect(
      getOrganizeosRecordOptions(signupForm, eventsBody, undefined, now)
    ).toEqual({ options: [none], selected: none, hasData: true });
  });
});

describe("an inserted Signup Form", () => {
  test("lists the org's forms once the builder's loader has them", async () => {
    const projectId = "project-1";
    const { forms } = await getOrganizeosPresetIds(projectId);
    const provisioned = await buildOrgResourcePresets({
      projectId,
      apiBaseUrl: "https://staging.example.org/api/public/v1",
      readToken: "osk_eventstoken",
    });
    // as provisioning seeds a project: the first Signup Form adds Forms
    $resources.set(
      new Map(
        provisioned.resources
          .filter((resource) => resource.id !== forms.resourceId)
          .map((resource) => [resource.id, resource])
      )
    );
    $dataSources.set(new Map());
    $instances.set(
      new Map([
        [
          "bodyId",
          { type: "instance", id: "bodyId", component: "Body", children: [] },
        ],
      ])
    );
    $props.set(new Map());
    $breakpoints.set(new Map());
    $styles.set(new Map());
    $styleSources.set(new Map());
    $styleSourceSelections.set(new Map());
    $assets.set(new Map());
    const pages = createDefaultPages({ rootInstanceId: "bodyId" });
    $pages.set(pages);
    $selectedPageId.set(pages.homePageId);
    selectInstance(["bodyId"]);
    $project.set({ id: projectId } as Project);
    $organizeosSite.set({
      organizationId: "org-1",
      manageUrl: "https://app.example.org/dashboard",
      platformUrl: "https://app.example.org",
      blocksEnabled: true,
    });
    $resourcesCache.set(new Map());

    expect(await insertOrganizeosBlock(signupForm)).toBe(true);

    // insert selects the block, and the picker reads its computed data,
    // through the block's own binding to the Forms catalog Resource
    const roots = [...$instances.get().values()].filter(
      (instance) => instance.component === signupForm
    );
    expect(roots).toHaveLength(1);
    expect(
      [...$dataSources.get().values()].filter(
        (dataSource) => dataSource.type === "resource"
      )
    ).toEqual([
      expect.objectContaining({
        scopeInstanceId: roots[0].id,
        resourceId: forms.resourceId,
      }),
    ]);
    expect($selectedInstanceKey.get()).toBe(
      getInstanceKey([roots[0].id, "bodyId"])
    );
    // until the loader has the forms: None alone, and the hint
    expect($selectedInstanceDataProp.get()).toBeUndefined();
    expect(
      getOrganizeosRecordOptions(
        signupForm,
        $selectedInstanceDataProp.get(),
        ""
      )
    ).toEqual({ options: [none], selected: none, hasData: false });

    const request = computeResourceRequest(
      $resources.get().get(forms.resourceId) as Resource,
      new Map()
    );
    $resourcesCache.set(
      new Map([
        [
          getResourceKey(request),
          { ok: true, status: 200, statusText: "", data: formsBody },
        ],
      ])
    );

    expect($selectedInstanceDataProp.get()).toEqual(formsBody);
    expect(
      getOrganizeosRecordOptions(
        signupForm,
        $selectedInstanceDataProp.get(),
        ""
      )
    ).toEqual({
      options: [none, newsletterOption, contactOption],
      selected: none,
      hasData: true,
    });
  });
});

describe("an inserted RSVP Form", () => {
  test("lists the org's events once the builder's loader has them", async () => {
    const projectId = "project-2";
    const { events } = await getOrganizeosPresetIds(projectId);
    const provisioned = await buildOrgResourcePresets({
      projectId,
      apiBaseUrl: "https://staging.example.org/api/public/v1",
      readToken: "osk_eventstoken",
    });
    // as provisioning seeds a project: Events is there, and nothing else is
    // needed to place an RSVP Form
    $resources.set(
      new Map(provisioned.resources.map((resource) => [resource.id, resource]))
    );
    $dataSources.set(new Map());
    $instances.set(
      new Map([
        [
          "bodyId",
          { type: "instance", id: "bodyId", component: "Body", children: [] },
        ],
      ])
    );
    $props.set(new Map());
    $breakpoints.set(new Map());
    $styles.set(new Map());
    $styleSources.set(new Map());
    $styleSourceSelections.set(new Map());
    $assets.set(new Map());
    const pages = createDefaultPages({ rootInstanceId: "bodyId" });
    $pages.set(pages);
    $selectedPageId.set(pages.homePageId);
    selectInstance(["bodyId"]);
    $project.set({ id: projectId } as Project);
    $organizeosSite.set({
      organizationId: "org-1",
      manageUrl: "https://app.example.org/dashboard",
      platformUrl: "https://app.example.org",
      blocksEnabled: true,
    });
    $resourcesCache.set(new Map());

    expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);

    // insert selects the block, and the picker reads its computed data,
    // through the block's own binding to the Events catalog Resource
    const roots = [...$instances.get().values()].filter(
      (instance) => instance.component === rsvpForm
    );
    expect(roots).toHaveLength(1);
    expect(
      [...$dataSources.get().values()].filter(
        (dataSource) => dataSource.type === "resource"
      )
    ).toEqual([
      expect.objectContaining({
        scopeInstanceId: roots[0].id,
        resourceId: events.resourceId,
      }),
    ]);
    expect($selectedInstanceKey.get()).toBe(
      getInstanceKey([roots[0].id, "bodyId"])
    );
    // until the loader has the events: nothing to pick
    expect($selectedInstanceDataProp.get()).toBeUndefined();
    expect(
      getOrganizeosRecordOptions(
        rsvpForm,
        $selectedInstanceDataProp.get(),
        "",
        now
      )
    ).toEqual({ options: [], selected: undefined, hasData: false });

    const request = computeResourceRequest(
      $resources.get().get(events.resourceId) as Resource,
      new Map()
    );
    $resourcesCache.set(
      new Map([
        [
          getResourceKey(request),
          { ok: true, status: 200, statusText: "", data: eventsBody },
        ],
      ])
    );

    expect($selectedInstanceDataProp.get()).toEqual(eventsBody);
    expect(
      getOrganizeosRecordOptions(
        rsvpForm,
        $selectedInstanceDataProp.get(),
        "",
        now
      )
    ).toEqual({ options: eventOptions, selected: undefined, hasData: true });
  });
});
