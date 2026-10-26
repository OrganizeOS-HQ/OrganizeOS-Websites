/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test } from "vitest";
import { checkMarqueeStructure } from "./structure";

const build = (html: string) => {
  document.body.innerHTML = `<div data-root>${html}</div>`;
  const root = document.querySelector("[data-root]") as HTMLElement;
  return {
    root,
    buttons: [...root.querySelectorAll("[data-button]")],
    tracks: [...root.querySelectorAll("[data-track]")],
  };
};

const button = `<button data-button type="button">Pause</button>`;
const track = `<div data-track><div>Item</div></div>`;
const check = `<div data-organizeos-canvas-check>Marquee needs attention</div>`;
const note = `<div data-organizeos-canvas-note>Marquee notes</div>`;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("checkMarqueeStructure", () => {
  test("accepts the template's shape: the button, then the track", () => {
    const { root, buttons, tracks } = build(button + track);
    expect(checkMarqueeStructure(root, buttons, tracks)).toBe(true);
  });

  test("skips the canvas-check boxes the root renders beside its parts", () => {
    const { root, buttons, tracks } = build(check + note + button + track);
    expect(checkMarqueeStructure(root, buttons, tracks)).toBe(true);
    const after = build(button + track + check);
    expect(checkMarqueeStructure(after.root, after.buttons, after.tracks)).toBe(
      true
    );
  });

  test("refuses the button after the track", () => {
    const { root, buttons, tracks } = build(track + button);
    expect(checkMarqueeStructure(root, buttons, tracks)).toBe(false);
  });

  test("refuses another element before the button", () => {
    const { root, buttons, tracks } = build(`<div></div>` + button + track);
    expect(checkMarqueeStructure(root, buttons, tracks)).toBe(false);
  });

  test("refuses a missing, a second or a wrapped part", () => {
    const none = build(track);
    expect(checkMarqueeStructure(none.root, none.buttons, none.tracks)).toBe(
      false
    );
    const noTrack = build(button);
    expect(
      checkMarqueeStructure(noTrack.root, noTrack.buttons, noTrack.tracks)
    ).toBe(false);
    const two = build(button + track + track);
    expect(checkMarqueeStructure(two.root, two.buttons, two.tracks)).toBe(
      false
    );
    const twoButtons = build(button + button + track);
    expect(
      checkMarqueeStructure(
        twoButtons.root,
        twoButtons.buttons,
        twoButtons.tracks
      )
    ).toBe(false);
    const wrapped = build(button + `<div>${track}</div>`);
    expect(
      checkMarqueeStructure(wrapped.root, wrapped.buttons, wrapped.tracks)
    ).toBe(false);
  });

  test("refuses no root", () => {
    const { buttons, tracks } = build(button + track);
    expect(checkMarqueeStructure(null, buttons, tracks)).toBe(false);
  });
});
