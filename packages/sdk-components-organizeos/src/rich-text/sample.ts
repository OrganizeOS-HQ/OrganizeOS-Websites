/**
 * What a Rich Text shows on the canvas before it has a value: one of every
 * element a designer styles, taken node for node from cases of the shared
 * fixture (`__fixtures__/rich-text.json`; `rich-text.test.tsx` holds the two
 * equal). Its links and image point at example.org, so the image shows its
 * alt text and caption on the canvas.
 */
export const richTextSample = {
  v: 1,
  children: [
    // "headings, entities and collapsed whitespace"
    { t: "h", level: 2, c: [{ t: "text", text: "Two & more" }] },
    { t: "h", level: 3, c: [{ t: "text", text: "Three" }] },
    { t: "h", level: 4, c: [{ t: "text", text: "Four four" }] },
    // "every mark"
    {
      t: "p",
      c: [
        { t: "text", text: "Plain " },
        { t: "text", text: "strong", marks: ["b"] },
        { t: "text", text: " " },
        { t: "text", text: "b", marks: ["b"] },
        { t: "text", text: " " },
        { t: "text", text: "em", marks: ["i"] },
        { t: "text", text: " " },
        { t: "text", text: "i", marks: ["i"] },
        { t: "text", text: " " },
        { t: "text", text: "u", marks: ["u"] },
        { t: "text", text: " " },
        { t: "text", text: "s", marks: ["s"] },
        { t: "text", text: " " },
        { t: "text", text: "code", marks: ["code"] },
        { t: "text", text: " " },
        { t: "text", text: "both", marks: ["b", "i"] },
      ],
    },
    // "every allowed link target"
    {
      t: "p",
      c: [
        {
          t: "a",
          href: "https://example.org",
          newTab: true,
          c: [{ t: "text", text: "new tab" }],
        },
        { t: "text", text: " " },
        {
          t: "a",
          href: "http://example.org/a",
          c: [{ t: "text", text: "bold link", marks: ["b"] }],
        },
        { t: "text", text: " " },
        { t: "a", href: "/about", c: [{ t: "text", text: "root path" }] },
        { t: "text", text: " " },
        { t: "a", href: "#top", c: [{ t: "text", text: "fragment" }] },
        { t: "text", text: " " },
        {
          t: "a",
          href: "mailto:press@example.org",
          c: [{ t: "text", text: "mail" }],
        },
        { t: "text", text: " " },
        { t: "a", href: "tel:+15550100100", c: [{ t: "text", text: "call" }] },
      ],
    },
    // "line break"
    {
      t: "p",
      c: [
        { t: "text", text: "Line one" },
        { t: "br" },
        { t: "text", text: "line two" },
      ],
    },
    // "lists, nested"
    {
      t: "ul",
      items: [
        [{ t: "p", c: [{ t: "text", text: "One" }] }],
        [
          { t: "p", c: [{ t: "text", text: "Two" }] },
          {
            t: "ul",
            items: [[{ t: "p", c: [{ t: "text", text: "Nested" }] }]],
          },
        ],
      ],
    },
    {
      t: "ol",
      items: [
        [
          { t: "p", c: [{ t: "text", text: "First" }] },
          { t: "p", c: [{ t: "text", text: "Second paragraph" }] },
        ],
      ],
    },
    // "quote, code block and rule"
    {
      t: "quote",
      children: [
        {
          t: "p",
          c: [
            { t: "text", text: "Quoted " },
            { t: "text", text: "words", marks: ["i"] },
          ],
        },
      ],
    },
    { t: "code", text: "const a = 1;\n  if (a < 2) go();\n" },
    { t: "hr" },
    // "figure with a caption"
    {
      t: "img",
      src: "https://cdn.example.org/b.jpg",
      alt: "",
      caption: [
        { t: "text", text: "Photo by " },
        { t: "text", text: "Ada", marks: ["i"] },
      ],
    },
  ],
};
