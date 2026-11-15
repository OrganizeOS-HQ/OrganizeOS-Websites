import { describe, expect, test } from "vitest";
import { toValue } from "@webstudio-is/css-engine";
import type { Instance, StyleDecl, WebstudioFragment } from "@webstudio-is/sdk";
import { ws } from "@webstudio-is/template";
import { SITE_TEMPLATES } from "../site-templates/catalog";
import { renderPageBody } from "../site-templates/render";
import type { CompleteKitStyle } from "../site-templates/types";
import { checkStarterPage } from "./check";
import { NEUTRAL_LOOK } from "./look";
import {
  aboutImageLeft,
  aboutTextOnly,
  contactSplit,
  ctaBandCentered,
  ctaBandSplit,
  eventsCardGrid,
  faqTwoColumns,
  heroSplit,
  opportunitiesCards,
  pageHeader,
  signUpCentered,
  signUpSideBySide,
  teamCompact,
  valuesList,
  valuesThreeColumns,
} from "./sections";
import type { StarterPage, StarterPageContext } from "./types";
import { sampleStarterPage } from "./__fixtures__/sample";

const EventList = "@organizeos/site-components:EventList" as const;
const SignupForm = "@organizeos/site-components:SignupForm" as const;
const RsvpForm = "@organizeos/site-components:RsvpForm" as const;

const values: [string, string, string][] = [
  ["01", "[A value]", "[What it means to you.]"],
  ["02", "[A value]", "[What it means to you.]"],
  ["03", "[A value]", "[What it means to you.]"],
];
const questions: [string, string][] = [
  ["[A question people ask]", "[Its answer.]"],
  ["[Another question]", "[Its answer.]"],
];

/** Page A: the header and every section but the hero and its kin. */
const pageA = ({ look, placeBlock }: StarterPageContext) => [
  pageHeader({
    look,
    eyebrow: "[Eyebrow]",
    title: "Say what this page is for",
    intro: "Say in one sentence why someone is here.",
  }),
  eventsCardGrid({
    look,
    placeBlock,
    heading: "Upcoming events",
    intro: "Come to one.",
  }),
  signUpSideBySide({
    look,
    placeBlock,
    heading: "Stay in touch",
    intro: "Hear first.",
    formHeading: "Get event updates",
  }),
  ctaBandCentered({
    look,
    heading: "Give today",
    intro: "Every gift helps.",
    button: { label: "Donate", href: "/donate" },
  }),
  valuesThreeColumns({ look, heading: "What we value", intro: "", values }),
  aboutTextOnly({
    look,
    heading: "What to expect",
    paragraphs: ["Say what happens.", "Say who it is for."],
  }),
  opportunitiesCards({
    look,
    heading: "Ways to help",
    intro: "Pick one.",
    opportunities: [
      ["[An hour a week]", "[A role]", "[What it involves.]"],
      ["[A weekend]", "[A role]", "[What it involves.]"],
    ],
  }),
  teamCompact({
    look,
    heading: "Our team",
    people: [["[Name]", "[Role]", "[A line about them.]"]],
  }),
  faqTwoColumns({ look, heading: "Questions", questions }),
];

/** Page B: the hero and the sections page A leaves out. */
const pageB = ({ look, placeBlock, image }: StarterPageContext) => [
  heroSplit({
    look,
    image,
    eyebrow: "[Campaign]",
    title: "Say what the campaign is for",
    intro: "Say why now.",
  }),
  signUpCentered({
    look,
    placeBlock,
    heading: "RSVP",
    intro: "Tell us you are coming.",
  }),
  ctaBandSplit({
    look,
    heading: "Become a member",
    intro: "Join us.",
    button: { label: "Become a member", href: "/join" },
  }),
  valuesList({ look, heading: "Where the money goes", intro: "", values }),
  aboutImageLeft({
    look,
    image,
    heading: "About us",
    paragraphs: ["Say who you are."],
  }),
  contactSplit({
    look,
    heading: "Get in touch",
    methods: [
      ["[Email]", "[name@example.org]"],
      ["[Phone]", "[(555) 555-0100]"],
    ],
    visit: { heading: "Visit us", lines: ["[Street address]", "[Hours]"] },
  }),
];

const asPage = (
  id: string,
  sections: (context: StarterPageContext) => JSX.Element[],
  blocks: StarterPage["blocks"]
): StarterPage => ({
  ...sampleStarterPage,
  id,
  blocks,
  body: (context) => <ws.element ws:tag="body">{sections(context)}</ws.element>,
});

const render = (
  sections: (context: StarterPageContext) => JSX.Element[],
  look: CompleteKitStyle
) =>
  renderPageBody("x", (placeBlock) => (
    <ws.element ws:tag="body">
      {sections({
        placeBlock,
        look,
        image: () => ({ alt: "Replace with a photo" }),
      })}
    </ws.element>
  ));

/** Every instance outside the placed blocks' subtrees. */
const ownInstances = (
  fragment: WebstudioFragment,
  rootIds: string[]
): Instance[] => {
  const byId = new Map(fragment.instances.map((item) => [item.id, item]));
  const placed = new Set<string>();
  const visit = (id: string) => {
    placed.add(id);
    for (const child of byId.get(id)?.children ?? []) {
      if (child.type === "id") {
        visit(child.value);
      }
    }
  };
  rootIds.forEach(visit);
  return fragment.instances.filter((item) => placed.has(item.id) === false);
};

const declsOf = (fragment: WebstudioFragment, instanceId: string) => {
  const sources = new Set(
    fragment.styleSourceSelections.find(
      (selection) => selection.instanceId === instanceId
    )?.values ?? []
  );
  return fragment.styles.filter((decl) => sources.has(decl.styleSourceId));
};

const css = (decl: StyleDecl) => toValue(decl.value);

const declOf = (
  fragment: WebstudioFragment,
  instanceId: string,
  property: string
) =>
  declsOf(fragment, instanceId).find(
    (decl) => decl.property === property && decl.state === undefined
  );

/** The smallest px a font-size value can take: its own, or clamp's first. */
const minimumPx = (value: string) => {
  const clamp = /^clamp\(\s*([\d.]+)px/.exec(value);
  const plain = /^([\d.]+)px$/.exec(value);
  const px = clamp?.[1] ?? plain?.[1];
  return px === undefined ? 0 : Number(px);
};

const sentinel: CompleteKitStyle = {
  ...NEUTRAL_LOOK,
  headingWeight: 123,
  buttonWeight: 456,
  headingCase: "uppercase",
};

const both = (context: StarterPageContext) => [
  ...pageA(context),
  ...pageB(context),
];

describe("the neutral sections", () => {
  test("sections take weight and case from the look", () => {
    const { fragment, placements } = render(both, sentinel);
    const own = ownInstances(
      fragment,
      placements.map((placement) => placement.rootId)
    );
    let headingFont = 0;
    for (const instance of own) {
      for (const decl of declsOf(fragment, instance.id)) {
        if (decl.property === "fontWeight") {
          expect(["123", "456"], instance.label ?? instance.tag).toContain(
            css(decl)
          );
        }
      }
      const family = declOf(fragment, instance.id, "fontFamily");
      if (family !== undefined && css(family) === "var(--font-heading)") {
        headingFont += 1;
        expect(
          css(declOf(fragment, instance.id, "fontWeight")!),
          instance.tag
        ).toBe("123");
        expect(
          css(declOf(fragment, instance.id, "textTransform")!),
          instance.tag
        ).toBe("uppercase");
      }
      if (instance.label === "Eyebrow" || instance.label === "Label") {
        expect(css(declOf(fragment, instance.id, "fontWeight")!)).toBe("456");
      }
    }
    expect(headingFont).toBeGreaterThan(10);

    const neutral = render(both, NEUTRAL_LOOK);
    expect(
      neutral.fragment.styles.some(
        (decl) =>
          decl.property === "textTransform" &&
          css(decl) === "uppercase" &&
          neutral.fragment.instances.some(
            (item) =>
              ["h1", "h2", "h3"].includes(item.tag ?? "") &&
              declsOf(neutral.fragment, item.id).includes(decl)
          )
      )
    ).toBe(false);
  });

  test("small text stays off accent-2", () => {
    const { fragment, placements } = render(both, NEUTRAL_LOOK);
    for (const instance of ownInstances(
      fragment,
      placements.map((placement) => placement.rootId)
    )) {
      const decls = declsOf(fragment, instance.id);
      const accent = decls.some(
        (decl) =>
          decl.property === "color" &&
          ["var(--accent-2)", "var(--accent-text, var(--accent-2))"].includes(
            css(decl)
          )
      );
      if (accent === false) {
        continue;
      }
      const sizes = decls.filter((decl) => decl.property === "fontSize");
      expect(sizes.length, instance.label ?? instance.tag).toBeGreaterThan(0);
      for (const size of sizes) {
        expect(
          minimumPx(css(size)),
          instance.label ?? instance.tag
        ).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test("no tag the browser bolds", () => {
    const { fragment } = render(both, NEUTRAL_LOOK);
    expect(
      fragment.instances.filter((item) =>
        ["strong", "b", "th", "dt"].includes(item.tag ?? "")
      )
    ).toEqual([]);
  });

  test("a band's button is inverted", () => {
    const { fragment } = render(both, NEUTRAL_LOOK);
    const buttons = fragment.instances.filter((item) => {
      const href = fragment.props.find(
        (prop) => prop.instanceId === item.id && prop.name === "href"
      );
      return (
        item.component === "Link" &&
        href?.type === "string" &&
        ["/donate", "/join"].includes(href.value)
      );
    });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(css(declOf(fragment, button.id, "backgroundColor")!)).toBe(
        "var(--base)"
      );
      expect(css(declOf(fragment, button.id, "color")!)).toBe(
        "var(--accent-1)"
      );
      expect(
        fragment.props.find(
          (prop) =>
            prop.instanceId === button.id && prop.name === "reloadDocument"
        )?.value
      ).toBe(true);
    }
  });

  test("each section is labelled and the blocks placed once", () => {
    const { fragment, placements } = render(both, NEUTRAL_LOOK);
    const [root] = fragment.children;
    const body = fragment.instances.find(
      (item) => root.type === "id" && item.id === root.value
    )!;
    const labels = body.children.map(
      (child) =>
        child.type === "id" &&
        fragment.instances.find((item) => item.id === child.value)?.label
    );
    expect(labels).toEqual([
      "Page header",
      "Events: Card grid",
      "Sign-up: Side by side",
      "Call to action band: Centered",
      "Mission and values: Three columns",
      "About: Text only",
      "Volunteer opportunities: Cards",
      "Team or leadership: Compact",
      "FAQ: Two columns",
      "Hero: Split",
      "Sign-up: Centered",
      "Call to action band: Split",
      "Mission and values: List",
      "About: Image left",
      "Contact: Split",
    ]);
    expect(placements).toEqual([
      { key: EventList, rootId: "events" },
      { key: SignupForm, rootId: "signup" },
      { key: RsvpForm, rootId: "rsvp" },
    ]);
  });

  test("every section passes the starter check alone", () => {
    const looks = [NEUTRAL_LOOK, ...SITE_TEMPLATES.map((t) => t.look)];
    expect(
      checkStarterPage(asPage("a", pageA, [EventList, SignupForm]), looks)
    ).toEqual([]);
    expect(checkStarterPage(asPage("b", pageB, [RsvpForm]), looks)).toEqual([]);
  });
});
