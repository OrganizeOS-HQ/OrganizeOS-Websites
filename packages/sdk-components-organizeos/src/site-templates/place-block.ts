import { cloneElement, isValidElement } from "react";
import type { TemplateStyleDecl } from "@webstudio-is/template";
import {
  type EventCardVariant,
  eventsTemplate,
} from "../events/event-card.template";
import { rsvpFormTemplate } from "../rsvp-form.template";
import { signupFormTemplate } from "../signup-form.template";
import type { BlockStyle } from "./types";

// The platform blocks a site template can place, by their Components-panel
// keys. The block templates are factories (see block-factories.test.tsx), so
// each placement gets a tree of its own.
export type EventsBlockKey =
  | "@organizeos/site-components:EventList"
  | "@organizeos/site-components:EventCard";

export type FormBlockKey =
  | "@organizeos/site-components:SignupForm"
  | "@organizeos/site-components:RsvpForm";

export type BlockKey = FormBlockKey | EventsBlockKey;

/** How a template places an events block. */
export type EventsBlockOptions = {
  /** The cover card (the default, as the Components panel inserts) or the dated one. */
  card?: EventCardVariant;
  /**
   * Local style on the block's root, replacing the root's own declarations
   * by key (breakpoint, state, property): the list's columns, say. Checked
   * as the page's own styles are.
   */
  style?: BlockStyle;
};

/**
 * Places a platform block. Only the events blocks take options: a form
 * block given any is a type error.
 */
export type PlaceBlock = {
  (
    key: EventsBlockKey,
    placementId: string,
    options?: EventsBlockOptions
  ): JSX.Element;
  (key: BlockKey, placementId: string): JSX.Element;
};

export type BlockPlacement = { key: BlockKey; rootId: string };

const factories: Record<
  BlockKey,
  (options: EventsBlockOptions) => JSX.Element
> = {
  "@organizeos/site-components:SignupForm": signupFormTemplate,
  "@organizeos/site-components:RsvpForm": rsvpFormTemplate,
  "@organizeos/site-components:EventList": ({ card }) =>
    eventsTemplate({ label: "Event List", card }),
  "@organizeos/site-components:EventCard": ({ card }) =>
    eventsTemplate({ label: "Event Card", card }),
};

const declarationKey = ({ breakpoint, state, property }: TemplateStyleDecl) =>
  JSON.stringify([breakpoint ?? "", state ?? "", property]);

/**
 * `styles` with each of `overrides` in place of the one of the same key, and
 * the overrides no style has after them.
 */
const replaceByKey = (
  styles: TemplateStyleDecl[],
  overrides: TemplateStyleDecl[]
) => {
  const byKey = new Map(
    overrides.map((override) => [declarationKey(override), override])
  );
  const replaced = styles.map((style) => {
    const key = declarationKey(style);
    const override = byKey.get(key);
    byKey.delete(key);
    return override ?? style;
  });
  return [...replaced, ...byKey.values()];
};

/**
 * Returns a deep clone of a block's template whose root has the `ws:id`
 * `placementId` and whose descendants with a `ws:id` have `${placementId}:${wsId}`.
 *
 * A block fixes some `ws:id`s (the events blocks' "events", "empty" and
 * "unavailable", which the builder's insert binds by), and `renderTemplate`
 * uses a `ws:id` literally as the instance id, so two placements on one page
 * would collide without this. A descendant with no `ws:id` is left to the
 * renderer, which gives it an id of its own.
 *
 * Only `ws:id` and `children` are replaced, so the props the cloned elements
 * share with the original, a collection's `item` Parameter and the Variables
 * the expressions read, stay the same objects and stay bound to each other.
 * A child that is not an element (an expression, a placeholder, a string)
 * passes through as it is.
 */
export const prefixWsIds = (
  element: JSX.Element,
  placementId: string
): JSX.Element => {
  const clone = (source: JSX.Element, isRoot: boolean): JSX.Element => {
    const props: Record<string, unknown> = {};
    const wsId = source.props["ws:id"];
    if (isRoot) {
      props["ws:id"] = placementId;
    } else if (typeof wsId === "string") {
      props["ws:id"] = `${placementId}:${wsId}`;
    }
    const children: unknown = source.props.children;
    if (children !== undefined) {
      const visit = (child: unknown) =>
        isValidElement(child) ? clone(child, false) : child;
      props.children = Array.isArray(children)
        ? children.map(visit)
        : visit(children);
    }
    return cloneElement(source, props);
  };
  return clone(element, true);
};

/**
 * One placer per page. Every placement gets a template of its own, ids
 * prefixed by its `placementId`, and the placer records what it placed so the
 * caller can tell the apply routine where each block's root is. An events
 * block's options pick its card and give its root a style of the template's,
 * on the clone, so the block's own template is left as it was.
 */
export const createBlockPlacer = () => {
  const placements: BlockPlacement[] = [];
  const placeBlock: PlaceBlock = (
    key: BlockKey,
    placementId: string,
    options: EventsBlockOptions = {}
  ): JSX.Element => {
    if (placements.some((placement) => placement.rootId === placementId)) {
      throw new Error(`Block placement "${placementId}" is used twice`);
    }
    let element = prefixWsIds(factories[key](options), placementId);
    if (options.style !== undefined) {
      const style: TemplateStyleDecl[] = element.props["ws:style"] ?? [];
      element = cloneElement(element, {
        "ws:style": replaceByKey(style, options.style),
      });
    }
    placements.push({ key, rootId: placementId });
    return element;
  };
  return { placeBlock, placements };
};
