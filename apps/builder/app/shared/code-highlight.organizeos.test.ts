import { expect, test } from "vitest";
import { highlightCss } from "./code-highlight";

test("the CSS preview writes a style's text as text, never as markup", () => {
  const html = highlightCss(
    `a { content: "<i>x</i>"; font-family: </span><b>y</b> &amp; }`
  );
  const container = document.createElement("template");
  container.innerHTML = html;
  expect(container.content.querySelector("i, b")).toBeNull();
  expect(container.content.textContent).toContain(`"<i>x</i>"`);
  expect(container.content.textContent).toContain(`</span><b>y</b> &amp;`);
});

test("the CSS preview still highlights", () => {
  const html = highlightCss(`a { color: red }`);
  const container = document.createElement("template");
  container.innerHTML = html;
  expect(container.content.querySelectorAll("span").length).toBeGreaterThan(0);
  expect(container.content.textContent).toContain("color");
});
