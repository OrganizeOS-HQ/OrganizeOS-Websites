// Pasted and dropped item shapes, each written into one shared empty field:
// rules after an item's leading nested list, and the lines at the edges of a
// block wrapper that gives way.
import { afterAll, describe, expect, test } from "vitest";
import {
  dropHtml,
  paste,
  plain,
  readingOrder,
  settle,
  sharedField,
  lastHtml,
} from "./rich-text-test-harness";

describe("an item with no content before its nested list leaves no item holding only rules (Z1)", () => {
  const field = sharedField();
  afterAll(() => field.release());
  const PARTS: Record<string, (index: number) => string> = {
    L: (index) => `<ul><li>L${index}q</li></ul>`,
    O: (index) => `<ol><li>O${index}q</li></ol>`,
    R: () => "<hr>",
    T: (index) => `T${index}q`,
    Q: (index) => `<blockquote><p>Q${index}q</p></blockquote>`,
    B: () => "<br>",
    D: (index) => `<div><hr>D${index}q</div>`,
  };
  const KEYS = Object.keys(PARTS);
  /** Shapes with a list, a rule and text, none before the first list. */
  const isShape = (shape: string[]) =>
    /[LO]/.test(shape.join("")) &&
    /[RD]/.test(shape.join("")) &&
    /[TQD]/.test(shape.join("")) &&
    shape
      .slice(
        0,
        shape.findIndex((part) => /[LO]/.test(part))
      )
      .every((part) => /[TQD]/.test(part) === false);
  const shapesOf = (length: number): string[][] =>
    length === 0
      ? [[]]
      : shapesOf(length - 1).flatMap((shape) =>
          KEYS.map((key) => [...shape, key])
        );
  const SHORT = [1, 2, 3].flatMap(shapesOf).filter(isShape);
  // a fixed sample of the longer shapes
  let seed = 7;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const sample = (all: string[][], count: number) => {
    const picked: string[][] = [];
    const pool = [...all];
    while (picked.length < count && pool.length > 0) {
      picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    return picked;
  };
  const LONG = sample([4, 5].flatMap(shapesOf).filter(isShape), 240);
  const htmlOf = (shape: string[]) =>
    `<ul><li>${shape.map((part, index) => PARTS[part](index + 1)).join("")}</li><li>Bq</li></ul>`;
  const onlyRules = (html: string) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return [...template.content.querySelectorAll("li")]
      .filter((item) => {
        const own = [...item.childNodes].filter(
          (node) =>
            (node instanceof Element && /^(UL|OL)$/.test(node.tagName)) ===
            false
        );
        return (
          own.some(
            (node) =>
              node instanceof Element &&
              (node.tagName === "HR" || node.querySelector("hr") !== null)
          ) && own.every((node) => (node.textContent ?? "").trim() === "")
        );
      })
      .map((item) => item.outerHTML);
  };
  const check = async (shape: string[], how: "paste" | "drop") => {
    const html = htmlOf(shape);
    const onChange = await field.fresh();
    if (how === "paste") {
      paste({ "text/html": html, "text/plain": "x" });
      await settle();
    } else {
      await dropHtml(html);
    }
    const written = plain(lastHtml(onChange));
    expect(onlyRules(written), written).toEqual([]);
    expect(written.match(/<hr/g)?.length ?? 0, written).toBe(
      html.match(/<hr/g)?.length ?? 0
    );
    const order = (value: string) => readingOrder(value).replace(/\|/g, "");
    expect(order(written), written).toBe(order(html));
  };
  test.each(SHORT.map((shape) => shape.join(" ")))(
    "paste of %s",
    async (shape) => check(shape.split(" "), "paste")
  );
  test.each(LONG.map((shape) => shape.join(" ")))(
    "paste of %s",
    async (shape) => check(shape.split(" "), "paste")
  );
  test.each(sample([...SHORT, ...LONG], 40).map((shape) => shape.join(" ")))(
    "drop of %s",
    async (shape) => check(shape.split(" "), "drop")
  );
});

describe("the lines at a block wrapper's edges when it gives way (Z2, Z3)", () => {
  const field = sharedField();
  afterAll(() => field.release());
  /** The value's lines: text and line breaks, "|" at each item or list edge. */
  const linesOf = (html: string) =>
    plain(html)
      .replace(/<\/?(li|ul|ol)\b[^>]*>/g, "|")
      .replace(/<(?!br\b)[^>]*>/g, "")
      .replace(/\s*(<br \/>|\|)\s*/g, "$1")
      .replace(/\|+/g, "|");
  const ENDINGS = ["Zq", "Zq<br>", "Zq<br><br>"].flatMap((ending) =>
    ["", " ", "<!--c-->"].map((after) => ending + after)
  );
  const FOLLOWS = [
    "",
    "Qq",
    "<br>Qq",
    "<br><br>Qq",
    " <br>Qq",
    "<!--c--><br>Qq",
    "<div>Qq</div>",
    "<p>Qq</p>",
    "<b>Qq</b>",
  ];
  const PRECEDES = [
    "",
    "Pq",
    "Pq<br>",
    "Pq<br><br>",
    "Pq <!--c--> ",
    "<div>Pq</div>",
    "<p>Pq</p>",
    "<b>Pq</b>",
  ];
  const STARTS = ["Aq", "<br>Aq"];
  const WRAPPERS = ["div", "section"];
  const END_CASES = WRAPPERS.flatMap((wrapper) =>
    ENDINGS.flatMap((ending) =>
      FOLLOWS.map((follows) => ({
        name: `${wrapper} ending ${JSON.stringify(ending)}, then ${JSON.stringify(follows)}`,
        html: `<ul><li><${wrapper}>Aq<ul><li>Xq</li></ul>${ending}</${wrapper}>${follows}</li><li>Bq</li></ul>`,
      }))
    )
  );
  const START_CASES = WRAPPERS.flatMap((wrapper) =>
    PRECEDES.flatMap((precedes) =>
      STARTS.map((start) => ({
        name: `${JSON.stringify(precedes)}, then ${wrapper} starting ${JSON.stringify(start)}`,
        html: `<ul><li>${precedes}<${wrapper}>${start}<ul><li>Xq</li></ul>Zq</${wrapper}></li><li>Bq</li></ul>`,
      }))
    )
  );
  // the other block wrappers, with a few neighbours each
  const OTHER_WRAPPERS = [
    "figure",
    "figcaption",
    "canvas",
    "noscript",
    "video",
  ];
  const OTHER_END_CASES = OTHER_WRAPPERS.flatMap((wrapper) =>
    ["Qq", "<br>Qq", "<div>Qq</div>"].map((follows) => ({
      name: `${wrapper} ending "Zq", then ${JSON.stringify(follows)}`,
      html: `<ul><li><${wrapper}>Aq<ul><li>Xq</li></ul>Zq</${wrapper}>${follows}</li><li>Bq</li></ul>`,
    }))
  );
  const OTHER_START_CASES = OTHER_WRAPPERS.flatMap((wrapper) =>
    ["Pq", "Pq<br>"].map((precedes) => ({
      name: `${JSON.stringify(precedes)}, then ${wrapper} starting "Aq"`,
      html: `<ul><li>${precedes}<${wrapper}>Aq<ul><li>Xq</li></ul>Zq</${wrapper}></li><li>Bq</li></ul>`,
    }))
  );
  const atEnd = (lines: string) => {
    const from = lines.indexOf("Zq");
    return lines.slice(from, lines.indexOf("|", from) + 1);
  };
  const atStart = (lines: string) => {
    const to = lines.indexOf("Aq") + 2;
    return lines.slice(lines.lastIndexOf("|", to - 1), to);
  };
  /** What the import wrote at each edge before a wrapper gave way. */
  const BASE: Record<string, string> = {
    '"Pq", then canvas starting "Aq"': "|Pq<br />Aq",
    '"Pq", then figcaption starting "Aq"': "|Pq<br />Aq",
    '"Pq", then figure starting "Aq"': "|Pq<br />Aq",
    '"Pq", then noscript starting "Aq"': "|Pq<br />Aq",
    '"Pq", then video starting "Aq"': "|Pq<br />Aq",
    '"Pq<br>", then canvas starting "Aq"': "|Pq<br /><br />Aq",
    '"Pq<br>", then figcaption starting "Aq"': "|Pq<br /><br />Aq",
    '"Pq<br>", then figure starting "Aq"': "|Pq<br /><br />Aq",
    '"Pq<br>", then noscript starting "Aq"': "|Pq<br /><br />Aq",
    '"Pq<br>", then video starting "Aq"': "|Pq<br /><br />Aq",
    'canvas ending "Zq", then "<br>Qq"': "Zq<br /><br />Qq|",
    'canvas ending "Zq", then "<div>Qq</div>"': "Zq<br />Qq|",
    'canvas ending "Zq", then "Qq"': "Zq<br />Qq|",
    'figcaption ending "Zq", then "<br>Qq"': "Zq<br /><br />Qq|",
    'figcaption ending "Zq", then "<div>Qq</div>"': "Zq<br />Qq|",
    'figcaption ending "Zq", then "Qq"': "Zq<br />Qq|",
    'figure ending "Zq", then "<br>Qq"': "Zq<br /><br />Qq|",
    'figure ending "Zq", then "<div>Qq</div>"': "Zq<br />Qq|",
    'figure ending "Zq", then "Qq"': "Zq<br />Qq|",
    'noscript ending "Zq", then "<br>Qq"': "Zq<br /><br />Qq|",
    'noscript ending "Zq", then "<div>Qq</div>"': "Zq<br />Qq|",
    'noscript ending "Zq", then "Qq"': "Zq<br />Qq|",
    'video ending "Zq", then "<br>Qq"': "Zq<br /><br />Qq|",
    'video ending "Zq", then "<div>Qq</div>"': "Zq<br />Qq|",
    'video ending "Zq", then "Qq"': "Zq<br />Qq|",
    '"", then div starting "<br>Aq"': "|<br />Aq",
    '"", then div starting "Aq"': "|Aq",
    '"", then section starting "<br>Aq"': "|<br />Aq",
    '"", then section starting "Aq"': "|Aq",
    '"<b>Pq</b>", then div starting "<br>Aq"': "|Pq<br /><br />Aq",
    '"<b>Pq</b>", then div starting "Aq"': "|Pq<br />Aq",
    '"<b>Pq</b>", then section starting "<br>Aq"': "|Pq<br /><br />Aq",
    '"<b>Pq</b>", then section starting "Aq"': "|Pq<br />Aq",
    '"<div>Pq</div>", then div starting "<br>Aq"': "|Pq<br /><br />Aq",
    '"<div>Pq</div>", then div starting "Aq"': "|Pq<br />Aq",
    '"<div>Pq</div>", then section starting "<br>Aq"': "|Pq<br /><br />Aq",
    '"<div>Pq</div>", then section starting "Aq"': "|Pq<br />Aq",
    '"<p>Pq</p>", then div starting "<br>Aq"': "|Pq<br /><br />Aq",
    '"<p>Pq</p>", then div starting "Aq"': "|Pq<br />Aq",
    '"<p>Pq</p>", then section starting "<br>Aq"': "|Pq<br /><br />Aq",
    '"<p>Pq</p>", then section starting "Aq"': "|Pq<br />Aq",
    '"Pq <!--c--> ", then div starting "<br>Aq"': "|Pq<br /><br />Aq",
    '"Pq <!--c--> ", then div starting "Aq"': "|Pq<br />Aq",
    '"Pq <!--c--> ", then section starting "<br>Aq"': "|Pq<br /><br />Aq",
    '"Pq <!--c--> ", then section starting "Aq"': "|Pq<br />Aq",
    '"Pq", then div starting "<br>Aq"': "|Pq<br /><br />Aq",
    '"Pq", then div starting "Aq"': "|Pq<br />Aq",
    '"Pq", then section starting "<br>Aq"': "|Pq<br /><br />Aq",
    '"Pq", then section starting "Aq"': "|Pq<br />Aq",
    '"Pq<br>", then div starting "<br>Aq"': "|Pq<br /><br /><br />Aq",
    '"Pq<br>", then div starting "Aq"': "|Pq<br /><br />Aq",
    '"Pq<br>", then section starting "<br>Aq"': "|Pq<br /><br /><br />Aq",
    '"Pq<br>", then section starting "Aq"': "|Pq<br /><br />Aq",
    '"Pq<br><br>", then div starting "<br>Aq"': "|Pq<br /><br /><br /><br />Aq",
    '"Pq<br><br>", then div starting "Aq"': "|Pq<br /><br /><br />Aq",
    '"Pq<br><br>", then section starting "<br>Aq"':
      "|Pq<br /><br /><br /><br />Aq",
    '"Pq<br><br>", then section starting "Aq"': "|Pq<br /><br /><br />Aq",
    'div ending "Zq ", then " <br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq ", then ""': "Zq|",
    'div ending "Zq ", then "<!--c--><br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq ", then "<b>Qq</b>"': "Zq<br />Qq|",
    'div ending "Zq ", then "<br><br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq ", then "<br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq ", then "<div>Qq</div>"': "Zq<br />Qq|",
    'div ending "Zq ", then "<p>Qq</p>"': "Zq<br />Qq|",
    'div ending "Zq ", then "Qq"': "Zq<br />Qq|",
    'div ending "Zq", then " <br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq", then ""': "Zq|",
    'div ending "Zq", then "<!--c--><br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq", then "<b>Qq</b>"': "Zq<br />Qq|",
    'div ending "Zq", then "<br><br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq", then "<br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq", then "<div>Qq</div>"': "Zq<br />Qq|",
    'div ending "Zq", then "<p>Qq</p>"': "Zq<br />Qq|",
    'div ending "Zq", then "Qq"': "Zq<br />Qq|",
    'div ending "Zq<!--c-->", then " <br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<!--c-->", then ""': "Zq|",
    'div ending "Zq<!--c-->", then "<!--c--><br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<!--c-->", then "<b>Qq</b>"': "Zq<br />Qq|",
    'div ending "Zq<!--c-->", then "<br><br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq<!--c-->", then "<br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<!--c-->", then "<div>Qq</div>"': "Zq<br />Qq|",
    'div ending "Zq<!--c-->", then "<p>Qq</p>"': "Zq<br />Qq|",
    'div ending "Zq<!--c-->", then "Qq"': "Zq<br />Qq|",
    'div ending "Zq<br> ", then " <br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<br> ", then ""': "Zq|",
    'div ending "Zq<br> ", then "<!--c--><br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<br> ", then "<b>Qq</b>"': "Zq<br />Qq|",
    'div ending "Zq<br> ", then "<br><br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br> ", then "<br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<br> ", then "<div>Qq</div>"': "Zq<br />Qq|",
    'div ending "Zq<br> ", then "<p>Qq</p>"': "Zq<br />Qq|",
    'div ending "Zq<br> ", then "Qq"': "Zq<br />Qq|",
    'div ending "Zq<br>", then " <br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<br>", then ""': "Zq|",
    'div ending "Zq<br>", then "<!--c--><br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<br>", then "<b>Qq</b>"': "Zq<br />Qq|",
    'div ending "Zq<br>", then "<br><br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br>", then "<br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<br>", then "<div>Qq</div>"': "Zq<br />Qq|",
    'div ending "Zq<br>", then "<p>Qq</p>"': "Zq<br />Qq|",
    'div ending "Zq<br>", then "Qq"': "Zq<br />Qq|",
    'div ending "Zq<br><!--c-->", then " <br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><!--c-->", then ""': "Zq<br />|",
    'div ending "Zq<br><!--c-->", then "<!--c--><br>Qq"':
      "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><!--c-->", then "<b>Qq</b>"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><!--c-->", then "<br><br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'div ending "Zq<br><!--c-->", then "<br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><!--c-->", then "<div>Qq</div>"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><!--c-->", then "<p>Qq</p>"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><!--c-->", then "Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><br> ", then " <br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><br> ", then ""': "Zq<br />|",
    'div ending "Zq<br><br> ", then "<!--c--><br>Qq"':
      "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><br> ", then "<b>Qq</b>"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><br> ", then "<br><br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'div ending "Zq<br><br> ", then "<br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><br> ", then "<div>Qq</div>"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><br> ", then "<p>Qq</p>"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><br> ", then "Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><br>", then " <br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><br>", then ""': "Zq<br />|",
    'div ending "Zq<br><br>", then "<!--c--><br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><br>", then "<b>Qq</b>"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><br>", then "<br><br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'div ending "Zq<br><br>", then "<br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><br>", then "<div>Qq</div>"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><br>", then "<p>Qq</p>"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><br>", then "Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then " <br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then ""': "Zq<br /><br />|",
    'div ending "Zq<br><br><!--c-->", then "<!--c--><br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then "<b>Qq</b>"':
      "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then "<br><br>Qq"':
      "Zq<br /><br /><br /><br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then "<br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then "<div>Qq</div>"':
      "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then "<p>Qq</p>"':
      "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then "Qq"': "Zq<br /><br /><br />Qq|",
    'section ending "Zq ", then " <br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq ", then ""': "Zq|",
    'section ending "Zq ", then "<!--c--><br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq ", then "<b>Qq</b>"': "Zq<br />Qq|",
    'section ending "Zq ", then "<br><br>Qq"': "Zq<br /><br /><br />Qq|",
    'section ending "Zq ", then "<br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq ", then "<div>Qq</div>"': "Zq<br />Qq|",
    'section ending "Zq ", then "<p>Qq</p>"': "Zq<br />Qq|",
    'section ending "Zq ", then "Qq"': "Zq<br />Qq|",
    'section ending "Zq", then " <br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq", then ""': "Zq|",
    'section ending "Zq", then "<!--c--><br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq", then "<b>Qq</b>"': "Zq<br />Qq|",
    'section ending "Zq", then "<br><br>Qq"': "Zq<br /><br /><br />Qq|",
    'section ending "Zq", then "<br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq", then "<div>Qq</div>"': "Zq<br />Qq|",
    'section ending "Zq", then "<p>Qq</p>"': "Zq<br />Qq|",
    'section ending "Zq", then "Qq"': "Zq<br />Qq|",
    'section ending "Zq<!--c-->", then " <br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<!--c-->", then ""': "Zq|",
    'section ending "Zq<!--c-->", then "<!--c--><br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<!--c-->", then "<b>Qq</b>"': "Zq<br />Qq|",
    'section ending "Zq<!--c-->", then "<br><br>Qq"': "Zq<br /><br /><br />Qq|",
    'section ending "Zq<!--c-->", then "<br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<!--c-->", then "<div>Qq</div>"': "Zq<br />Qq|",
    'section ending "Zq<!--c-->", then "<p>Qq</p>"': "Zq<br />Qq|",
    'section ending "Zq<!--c-->", then "Qq"': "Zq<br />Qq|",
    'section ending "Zq<br> ", then " <br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<br> ", then ""': "Zq|",
    'section ending "Zq<br> ", then "<!--c--><br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<br> ", then "<b>Qq</b>"': "Zq<br />Qq|",
    'section ending "Zq<br> ", then "<br><br>Qq"': "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br> ", then "<br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<br> ", then "<div>Qq</div>"': "Zq<br />Qq|",
    'section ending "Zq<br> ", then "<p>Qq</p>"': "Zq<br />Qq|",
    'section ending "Zq<br> ", then "Qq"': "Zq<br />Qq|",
    'section ending "Zq<br>", then " <br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<br>", then ""': "Zq|",
    'section ending "Zq<br>", then "<!--c--><br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<br>", then "<b>Qq</b>"': "Zq<br />Qq|",
    'section ending "Zq<br>", then "<br><br>Qq"': "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br>", then "<br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<br>", then "<div>Qq</div>"': "Zq<br />Qq|",
    'section ending "Zq<br>", then "<p>Qq</p>"': "Zq<br />Qq|",
    'section ending "Zq<br>", then "Qq"': "Zq<br />Qq|",
    'section ending "Zq<br><!--c-->", then " <br>Qq"':
      "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><!--c-->", then ""': "Zq<br />|",
    'section ending "Zq<br><!--c-->", then "<!--c--><br>Qq"':
      "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><!--c-->", then "<b>Qq</b>"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><!--c-->", then "<br><br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'section ending "Zq<br><!--c-->", then "<br>Qq"': "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><!--c-->", then "<div>Qq</div>"':
      "Zq<br /><br />Qq|",
    'section ending "Zq<br><!--c-->", then "<p>Qq</p>"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><!--c-->", then "Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><br> ", then " <br>Qq"': "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><br> ", then ""': "Zq<br />|",
    'section ending "Zq<br><br> ", then "<!--c--><br>Qq"':
      "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><br> ", then "<b>Qq</b>"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><br> ", then "<br><br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'section ending "Zq<br><br> ", then "<br>Qq"': "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><br> ", then "<div>Qq</div>"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><br> ", then "<p>Qq</p>"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><br> ", then "Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><br>", then " <br>Qq"': "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><br>", then ""': "Zq<br />|",
    'section ending "Zq<br><br>", then "<!--c--><br>Qq"':
      "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><br>", then "<b>Qq</b>"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><br>", then "<br><br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'section ending "Zq<br><br>", then "<br>Qq"': "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><br>", then "<div>Qq</div>"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><br>", then "<p>Qq</p>"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><br>", then "Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then " <br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then ""': "Zq<br /><br />|",
    'section ending "Zq<br><br><!--c-->", then "<!--c--><br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then "<b>Qq</b>"':
      "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then "<br><br>Qq"':
      "Zq<br /><br /><br /><br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then "<br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then "<div>Qq</div>"':
      "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then "<p>Qq</p>"':
      "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then "Qq"': "Zq<br /><br /><br />Qq|",
  };
  /** Where a comment follows a wrapper's last line break, or line breaks end the item, the edit's own rules hold. */
  const CHOSEN: Record<string, string> = {
    'div ending "Zq<br><!--c-->", then " <br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><!--c-->", then ""': "Zq|",
    'div ending "Zq<br><!--c-->", then "<!--c--><br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><!--c-->", then "<b>Qq</b>"': "Zq<br />Qq|",
    'div ending "Zq<br><!--c-->", then "<br><br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><!--c-->", then "<br>Qq"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><!--c-->", then "<div>Qq</div>"': "Zq<br />Qq|",
    'div ending "Zq<br><!--c-->", then "<p>Qq</p>"': "Zq<br />Qq|",
    'div ending "Zq<br><!--c-->", then "Qq"': "Zq<br />Qq|",
    'div ending "Zq<br><br> ", then ""': "Zq|",
    'div ending "Zq<br><br>", then ""': "Zq|",
    'div ending "Zq<br><br><!--c-->", then " <br>Qq"':
      "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then ""': "Zq<br />|",
    'div ending "Zq<br><br><!--c-->", then "<!--c--><br>Qq"':
      "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then "<b>Qq</b>"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then "<br><br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then "<br>Qq"': "Zq<br /><br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then "<div>Qq</div>"':
      "Zq<br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then "<p>Qq</p>"': "Zq<br /><br />Qq|",
    'div ending "Zq<br><br><!--c-->", then "Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><!--c-->", then " <br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><!--c-->", then ""': "Zq|",
    'section ending "Zq<br><!--c-->", then "<!--c--><br>Qq"':
      "Zq<br /><br />Qq|",
    'section ending "Zq<br><!--c-->", then "<b>Qq</b>"': "Zq<br />Qq|",
    'section ending "Zq<br><!--c-->", then "<br><br>Qq"':
      "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><!--c-->", then "<br>Qq"': "Zq<br /><br />Qq|",
    'section ending "Zq<br><!--c-->", then "<div>Qq</div>"': "Zq<br />Qq|",
    'section ending "Zq<br><!--c-->", then "<p>Qq</p>"': "Zq<br />Qq|",
    'section ending "Zq<br><!--c-->", then "Qq"': "Zq<br />Qq|",
    'section ending "Zq<br><br> ", then ""': "Zq|",
    'section ending "Zq<br><br>", then ""': "Zq|",
    'section ending "Zq<br><br><!--c-->", then " <br>Qq"':
      "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then ""': "Zq<br />|",
    'section ending "Zq<br><br><!--c-->", then "<!--c--><br>Qq"':
      "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then "<b>Qq</b>"':
      "Zq<br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then "<br><br>Qq"':
      "Zq<br /><br /><br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then "<br>Qq"':
      "Zq<br /><br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then "<div>Qq</div>"':
      "Zq<br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then "<p>Qq</p>"':
      "Zq<br /><br />Qq|",
    'section ending "Zq<br><br><!--c-->", then "Qq"': "Zq<br /><br />Qq|",
  };
  const written = async (html: string) => {
    const onChange = await field.fresh();
    paste({ "text/html": html, "text/plain": "x" });
    await settle();
    return linesOf(lastHtml(onChange));
  };
  test.each(OTHER_END_CASES)("$name", async ({ name, html }) => {
    const lines = atEnd(await written(html));
    expect(lines).toBe(CHOSEN[name] ?? BASE[name]);
  });
  test.each(OTHER_START_CASES)("$name", async ({ name, html }) => {
    const lines = atStart(await written(html));
    expect(lines).toBe(CHOSEN[name] ?? BASE[name]);
  });
  test.each(END_CASES)("$name", async ({ name, html }) => {
    const lines = atEnd(await written(html));
    expect(lines).toBe(CHOSEN[name] ?? BASE[name]);
  });
  test.each(START_CASES)("$name", async ({ name, html }) => {
    const lines = atStart(await written(html));
    expect(lines).toBe(CHOSEN[name] ?? BASE[name]);
  });
});
