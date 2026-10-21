import { render, type RenderResult } from "@testing-library/react";
import { useCallback, type ReactElement, type ReactNode } from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import events from "../__fixtures__/events.json";
import { FormRootContext, type FormPart } from "../form/context";
import type { Renderer } from "../form/submit";
import { RsvpContext } from "./context";
import { parseEventsData, type RsvpEvent } from "./events-data";

// What the tests of the RSVP Form's composite parts (Guests, Shift Options,
// Questions and Email Consent) share: a stand-in for the root that hands a part
// its event, the roles a role_full answer found, and its field messages, and
// that keeps what the part registers so a test can call its `collect`.

/** An event of the fixture `events.json`, as the RSVP Form reads it. */
export const fixtureEvent = (id: string): RsvpEvent => {
  const event = parseEventsData(events)?.find((item) => item.id === id);
  if (event === undefined) {
    throw new Error(`no fixture event ${id}`);
  }
  return event;
};

/** An event with nothing but what a test names. */
export const makeEvent = (overrides: Partial<RsvpEvent> = {}): RsvpEvent => ({
  id: "11111111-1111-4111-8111-111111111111",
  title: "Test event",
  startTime: "2026-11-21T15:00:00+00:00",
  endTime: "2026-11-21T22:00:00+00:00",
  timezone: "UTC",
  waitlist: false,
  full: false,
  maxGuests: 0,
  shifts: [],
  questions: [],
  ...overrides,
});

export type HarnessOptions = {
  renderer?: Renderer;
  /** The block's event; undefined is an event that cannot be found. */
  event?: RsvpEvent;
  /** The root's field messages, by field name. */
  errors?: Record<string, string>;
  fullRoleIds?: string[];
  openRoleIds?: string[];
};

type Registered = Map<number, FormPart>;

let nextKey = 0;

const Harness = ({
  options,
  registered,
  children,
}: {
  options: HarnessOptions;
  registered: Registered;
  children: ReactNode;
}) => {
  // stable, as the root's is: a new function would register every part again
  const register = useCallback(
    (part: FormPart) => {
      nextKey += 1;
      const key = nextKey;
      registered.set(key, part);
      return () => {
        registered.delete(key);
      };
    },
    [registered]
  );
  return (
    <ReactSdkContext.Provider
      value={{
        assetBaseUrl: "/",
        imageLoader: ({ src }) => src,
        resources: {},
        breakpoints: [],
        onError: () => {},
        renderer: options.renderer,
      }}
    >
      <FormRootContext.Provider
        value={{
          register,
          fields: undefined,
          fieldErrors: new Map(Object.entries(options.errors ?? {})),
          state: "initial",
        }}
      >
        <RsvpContext.Provider
          value={{
            event: options.event,
            fullRoleIds: new Set(options.fullRoleIds),
            openRoleIds: new Set(options.openRoleIds),
          }}
        >
          {children}
        </RsvpContext.Provider>
      </FormRootContext.Provider>
    </ReactSdkContext.Provider>
  );
};

export type RenderedPart = Omit<RenderResult, "rerender"> & {
  /** What the parts have registered with the stand-in root, by registration. */
  registered: ReadonlyMap<number, FormPart>;
  collect: (kind: FormPart["kind"]) => unknown;
  rerender: (ui: ReactElement, options?: HarnessOptions) => void;
};

/**
 * Renders a part under the stand-in root. `collect(kind)` calls the `collect`
 * of the latest part of that kind to have registered, as the root does on a
 * submit; `rerender` renders again under new options (the event data moving on,
 * a role_full answer arriving).
 */
export const renderPart = (
  ui: ReactElement,
  options: HarnessOptions = {}
): RenderedPart => {
  const registered: Registered = new Map();
  const view = render(
    <Harness options={options} registered={registered}>
      {ui}
    </Harness>
  );
  return {
    ...view,
    registered,
    collect: (kind: FormPart["kind"]) => {
      const parts = Array.from(registered.values()).filter(
        (part) => part.kind === kind
      );
      const part = parts.at(-1);
      if (part?.collect === undefined) {
        throw new Error(`no ${kind} part with a collect has registered`);
      }
      return part.collect();
    },
    rerender: (next: ReactElement, nextOptions: HarnessOptions = options) =>
      view.rerender(
        <Harness options={nextOptions} registered={registered}>
          {next}
        </Harness>
      ),
  };
};
