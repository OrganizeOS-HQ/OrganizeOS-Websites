import { afterEach, expect, test, vi } from "vitest";
import messages from "../__fixtures__/give-embed-messages.json";
import { afterGiftTarget, readGiveMessage } from "./give-messages";

const PLATFORM = "https://app.organizeos.org";
const frame = {} as Window;
const other = {} as Window;

const event = (data: unknown, origin = PLATFORM, source: unknown = frame) => ({
  data,
  origin,
  source: source as MessageEventSource | null,
});

const from = { platformOrigin: PLATFORM, frame };

afterEach(() => {
  vi.unstubAllGlobals();
});

test("reads the fixture's messages", () => {
  expect(readGiveMessage(event(messages.messages.height), from)).toEqual({
    type: "height",
    height: 640,
  });
  expect(readGiveMessage(event(messages.messages.done), from)).toEqual({
    type: "done",
  });
});

test("only from the frame", () => {
  const height = messages.messages.height;
  expect(
    readGiveMessage(event(height, "https://evil.example"), from)
  ).toBeUndefined();
  expect(
    readGiveMessage(event(height, "https://app.organizeos.org/"), from)
  ).toBeUndefined();
  expect(readGiveMessage(event(height, PLATFORM, other), from)).toBeUndefined();
  expect(readGiveMessage(event(height, PLATFORM, null), from)).toBeUndefined();
  expect(
    readGiveMessage(event(height), { platformOrigin: PLATFORM, frame: null })
  ).toBeUndefined();
});

test("heights outside the rule", () => {
  const height = (value: unknown) =>
    readGiveMessage(event({ type: "oos-give-height", height: value }), from);
  for (const bad of ["640", Number.NaN, Infinity, -1, 0, null, undefined]) {
    expect(height(bad), String(bad)).toBeUndefined();
  }
  expect(height(1e9)).toEqual({ type: "height", height: 10000 });
  expect(height(640.2)).toEqual({ type: "height", height: 641 });
});

test("unknown shapes", () => {
  for (const data of [
    "oos-give-done",
    null,
    7,
    [],
    { type: "oos-give-other" },
    { type: "OOS-GIVE-DONE" },
  ]) {
    expect(readGiveMessage(event(data), from), JSON.stringify(data)).toBe(
      undefined
    );
  }
});

// In node, with a window that has only what navigate.ts reads, as
// form/navigate.test.ts does.
const onPage = (href: string) => {
  const url = new URL(href);
  vi.stubGlobal("window", {
    location: { href: url.href, origin: url.origin, search: url.search },
  });
};

test("after-gift targets stay on the page's own origin", () => {
  onPage("https://acme.org/give");
  expect(afterGiftTarget("/thanks")).toBe("https://acme.org/thanks");
  expect(afterGiftTarget("https://acme.org/x?y=1")).toBe(
    "https://acme.org/x?y=1"
  );
  for (const bad of [
    "https://evil.example/x",
    "//evil.example/x",
    "/\\evil.example",
    "javascript:alert(1)",
    "",
    "  ",
    "http://[bad",
    "http://acme.org/x",
    7,
    undefined,
  ]) {
    expect(afterGiftTarget(bad), String(bad)).toBeUndefined();
  }
});
