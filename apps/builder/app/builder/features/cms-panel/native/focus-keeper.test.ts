import { afterEach, expect, test } from "vitest";
import { keepFocusInScreen } from "./focus-keeper";

afterEach(() => {
  document.body.innerHTML = "";
});

/** A screen holding `html`, the focus on the page. */
const screenOf = (html: string) => {
  document.body.innerHTML = `<div data-cms-native-screen>${html}</div>`;
  (document.activeElement as HTMLElement | null)?.blur();
};

const byId = (id: string) => document.getElementById(id);

// R5-10: the keeper's order, past disabled controls, to a fallback the
// Fields tab always draws
test.each([
  [
    "a disabled Add field: the selected tab",
    `<button role="tab" aria-selected="false" id="other">Collections</button>
     <button role="tab" aria-selected="true" id="target">Fields</button>
     <button aria-label="Add field" disabled>+</button>`,
  ],
  [
    "the item editor's Back before the current field row",
    `<div data-cms-editor-header><button aria-label="Back" id="target">B</button></div>
     <div data-cms-field-row data-current><button>Title</button></div>`,
  ],
  [
    "the structure view's Back before the item editor's",
    `<div data-cms-editor-header><button aria-label="Back">B</button></div>
     <div data-cms-structure-header><button aria-label="Back" id="target">B</button></div>`,
  ],
  [
    "a refusal line's first button before +",
    `<button aria-label="New collection">+</button>
     <div data-cms-refusal="forbidden"><button id="target">Retry</button></div>`,
  ],
  [
    "+ before the first collection's row",
    `<div data-cms-collection="posts"><button>Posts</button></div>
     <button aria-label="New collection" id="target">+</button>`,
  ],
  [
    "a disabled + gives way to the first collection's row",
    `<div data-cms-collection="posts"><button id="target">Posts</button></div>
     <div data-cms-collection="people"><button>People</button></div>
     <button aria-label="New collection" disabled>+</button>`,
  ],
])("%s", (_name, html) => {
  screenOf(html);
  keepFocusInScreen();
  expect(document.activeElement).toBe(byId("target"));
});

test("an open menu or dialog leaves the focus on the page", () => {
  for (const role of ["menu", "dialog", "alertdialog", "listbox"]) {
    screenOf(
      `<button aria-label="New collection">+</button><div role="${role}"></div>`
    );
    keepFocusInScreen();
    expect(document.activeElement).toBe(document.body);
  }
});
