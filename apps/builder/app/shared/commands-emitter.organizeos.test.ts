// OrganizeOS fork: the emitter's command allowance (docs/ORGANIZEOS-FORK.md section 7)
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  $commandMetas,
  createCommandsEmitter,
  suppressCommandsForEvent,
} from "./commands-emitter";

type CommandPayload = {
  source: string;
  name: string;
};

const pubsubMock = vi.hoisted(() => {
  let publisher: { publish?: (action: unknown) => void } = {};
  const subscribers = new Map<
    string,
    Array<(payload: CommandPayload) => void>
  >();

  return {
    getPublisher: () => publisher,
    setPublisher: (next: { publish?: (action: unknown) => void }) => {
      publisher = next;
    },
    subscribe: (type: string, callback: (payload: CommandPayload) => void) => {
      const callbacks = subscribers.get(type) ?? [];
      callbacks.push(callback);
      subscribers.set(type, callbacks);
      return () => {
        subscribers.set(
          type,
          (subscribers.get(type) ?? []).filter((item) => item !== callback)
        );
      };
    },
    emit: (type: string, payload: CommandPayload) => {
      for (const callback of subscribers.get(type) ?? []) {
        callback(payload);
      }
    },
    reset: () => {
      publisher = {};
      subscribers.clear();
    },
  };
});

vi.mock("~/shared/pubsub", () => ({
  $publisher: {
    get: pubsubMock.getPublisher,
    set: pubsubMock.setPublisher,
  },
  subscribe: pubsubMock.subscribe,
}));

vi.mock("~/shared/sync/sync-stores", () => ({
  clientSyncStore: {
    register: vi.fn(),
    createTransaction: vi.fn(
      (
        stores: Array<{ get: () => unknown }>,
        callback: (value: unknown) => void
      ) => {
        callback(stores[0].get());
      }
    ),
  },
}));

const handlers = {
  undo: vi.fn(),
  redo: vi.fn(),
  testDelete: vi.fn(),
};

const press = (key: string, init: KeyboardEventInit = {}) => {
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    })
  );
};

const suppressors: Array<(event: KeyboardEvent) => void> = [];

const suppressWith = (options?: { allow?: readonly string[] }) => {
  const listener = (event: KeyboardEvent) => {
    suppressCommandsForEvent(event, options);
  };
  suppressors.push(listener);
  document.addEventListener("keydown", listener, true);
};

describe("suppressCommandsForEvent", () => {
  let unsubscribe: (() => void) | undefined;

  beforeEach(() => {
    for (const handler of Object.values(handlers)) {
      handler.mockClear();
    }
    const { subscribeCommands } = createCommandsEmitter({
      source: "builder",
      commands: [
        { name: "undo", defaultHotkeys: ["meta+z"], handler: handlers.undo },
        {
          name: "redo",
          defaultHotkeys: ["meta+shift+z"],
          handler: handlers.redo,
        },
        {
          name: "testDelete",
          defaultHotkeys: ["backspace"],
          handler: handlers.testDelete,
        },
      ],
    });
    unsubscribe = subscribeCommands();
  });

  afterEach(() => {
    unsubscribe?.();
    for (const listener of suppressors.splice(0)) {
      document.removeEventListener("keydown", listener, true);
    }
    pubsubMock.reset();
    $commandMetas.set(new Map());
  });

  test("without options it keeps every command from the event", () => {
    suppressWith();
    press("Backspace");
    press("z", { metaKey: true });
    expect(handlers.testDelete).not.toHaveBeenCalled();
    expect(handlers.undo).not.toHaveBeenCalled();
  });

  test("with allow it lets only those commands through", () => {
    suppressWith({ allow: ["undo", "redo"] });
    press("z", { metaKey: true });
    press("z", { metaKey: true, shiftKey: true });
    press("Backspace");
    expect(handlers.undo).toHaveBeenCalledTimes(1);
    expect(handlers.redo).toHaveBeenCalledTimes(1);
    expect(handlers.testDelete).not.toHaveBeenCalled();
  });

  test("two suppressions narrow: one without a list wins", () => {
    suppressWith({ allow: ["undo"] });
    suppressWith();
    press("z", { metaKey: true });
    expect(handlers.undo).not.toHaveBeenCalled();
  });

  test("an event nobody suppressed runs as before", () => {
    press("Backspace");
    expect(handlers.testDelete).toHaveBeenCalledTimes(1);
  });
});
