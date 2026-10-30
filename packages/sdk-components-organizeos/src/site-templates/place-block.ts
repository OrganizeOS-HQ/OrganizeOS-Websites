import { cloneElement, isValidElement } from "react";
import { eventsTemplate } from "../events/event-card.template";
import { rsvpFormTemplate } from "../rsvp-form.template";
import { signupFormTemplate } from "../signup-form.template";

// The platform blocks a site template can place, by their Components-panel
// keys. The block templates are factories (see block-factories.test.tsx), so
// each placement gets a tree of its own.
export type BlockKey =
  | "@organizeos/site-components:SignupForm"
  | "@organizeos/site-components:RsvpForm"
  | "@organizeos/site-components:EventList"
  | "@organizeos/site-components:EventCard";

export type BlockPlacement = { key: BlockKey; rootId: string };

const factories: Record<BlockKey, () => JSX.Element> = {
  "@organizeos/site-components:SignupForm": signupFormTemplate,
  "@organizeos/site-components:RsvpForm": rsvpFormTemplate,
  "@organizeos/site-components:EventList": () =>
    eventsTemplate({ label: "Event List" }),
  "@organizeos/site-components:EventCard": () =>
    eventsTemplate({ label: "Event Card" }),
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
 * caller can tell the apply routine where each block's root is.
 */
export const createBlockPlacer = () => {
  const placements: BlockPlacement[] = [];
  const placeBlock = (key: BlockKey, placementId: string): JSX.Element => {
    if (placements.some((placement) => placement.rootId === placementId)) {
      throw new Error(`Block placement "${placementId}" is used twice`);
    }
    const element = prefixWsIds(factories[key](), placementId);
    placements.push({ key, rootId: placementId });
    return element;
  };
  return { placeBlock, placements };
};
