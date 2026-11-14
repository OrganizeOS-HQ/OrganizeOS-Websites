import { describe, expect, test, vi } from "vitest";
import { createReorderState } from "./reorder-state";

describe("whenSent", () => {
  test("runs every waiter once no E13 is in flight and no order is queued", () => {
    const state = createReorderState();
    const record = state.get("posts");
    record.sending = 1;
    record.queued = ["b", "a"];
    const first = vi.fn();
    const second = vi.fn();
    state.whenSent("posts", first);
    state.whenSent("posts", second);
    // the E13 answered, and the queued order is still to be sent
    record.sending = 0;
    state.notify();
    expect(first).not.toHaveBeenCalled();
    // the queued order is in flight
    record.queued = undefined;
    record.sending = 1;
    state.notify();
    expect(first).not.toHaveBeenCalled();
    record.sending = 0;
    state.notify();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    state.notify();
    expect(first).toHaveBeenCalledTimes(1);
  });

  test("runs at once with nothing in flight, and waits for its own collection only", () => {
    const state = createReorderState();
    const now = vi.fn();
    state.whenSent("posts", now);
    expect(now).toHaveBeenCalledTimes(1);
    state.get("people").sending = 1;
    const later = vi.fn();
    state.whenSent("people", later);
    state.get("posts").sending = 0;
    state.notify();
    expect(later).not.toHaveBeenCalled();
    state.get("people").sending = 0;
    state.notify();
    expect(later).toHaveBeenCalledTimes(1);
  });
});
