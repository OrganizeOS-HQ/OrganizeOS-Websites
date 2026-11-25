// The cells of `base-key-changes-nothing` (Task 5 Step 6; T11.6, T15.8): the
// keys probe's items 3 and 4 (check 5, `item3Cells` of the keys probe's
// cells3.ts) restricted to a root-level rule beside the edge child: a
// quote, a heading and a paragraph; Backspace and Delete with their word
// and line forms; each child and the twin, the word Zw in the child's place.
import {
  backspace,
  beside,
  del,
  IMG,
  lineBack,
  lineForward,
  range,
  type Step,
  wordBack,
  wordForward,
} from "./rich-text-line-test-kit";

const LINK = (inner: string) => `<a href="https://example.org/l">${inner}</a>`;

type Child = { html: string; fwd: Step; bwd: Step };

const inZw = (offset: number): Step => range("Zw", offset, "Zw", offset);

const CHILDREN: Record<string, Child> = {
  img: {
    html: IMG,
    fwd: beside("cms-image", "after"),
    bwd: beside("cms-image", "before"),
  },
  br: {
    html: "<br>",
    fwd: beside("linebreak", "after", { last: true }),
    bwd: beside("linebreak", "before", { last: true }),
  },
  linkOut: {
    html: LINK("Zw"),
    fwd: beside("link", "after"),
    bwd: beside("link", "before"),
  },
  linkIn: { html: LINK("Zw"), fwd: inZw(2), bwd: inZw(0) },
  code: {
    html: "<code>Zw</code>",
    fwd: beside("text", "after", { text: "Zw" }),
    bwd: beside("text", "before", { text: "Zw" }),
  },
  linkBold: {
    html: LINK("<strong>Zw</strong>"),
    fwd: inZw(2),
    bwd: inZw(0),
  },
  boldLink: {
    html: `<strong>${LINK("Zw")}</strong>`,
    fwd: inZw(2),
    bwd: inZw(0),
  },
  codeIn: { html: "<code>Zw</code>", fwd: inZw(2), bwd: inZw(0) },
};

const FORWARD: Record<string, (x: string) => string> = {
  quote: (x) => `<p>A9w</p><blockquote><p>X0w${x}</p></blockquote><hr>`,
  heading: (x) => `<p>A9w</p><h3>X0w${x}</h3><hr>`,
  para: (x) => `<p>A9w</p><p>X0w${x}</p><hr>`,
};
const BACKWARD: Record<string, (x: string) => string> = {
  quote: (x) => `<hr><blockquote><p>${x}X0w</p></blockquote><p>E9w</p>`,
  heading: (x) => `<hr><h3>${x}X0w</h3><p>E9w</p>`,
  para: (x) => `<hr><p>${x}X0w</p><p>E9w</p>`,
};

const KEYS = {
  fwd: [
    ["del", del],
    ["wordF", wordForward],
    ["lineF", lineForward],
  ],
  bwd: [
    ["bs", backspace],
    ["wordB", wordBack],
    ["lineB", lineBack],
  ],
} as const;

export type KeyChangesNothingCell = {
  /** `<dir>|R|<container>|rule|<child or twin>|<key>`, the probe's id. */
  id: string;
  /** The twin's id: the same shape and key with the word Zw in place. */
  twin: string;
  /** The edge child, or `twin`. */
  child: string;
  stored: string;
  place: Step;
  action: Step;
};

export const keyChangesNothingCells: KeyChangesNothingCell[] = (
  ["fwd", "bwd"] as const
).flatMap((dir) =>
  Object.entries(dir === "fwd" ? FORWARD : BACKWARD).flatMap(
    ([container, shape]) =>
      KEYS[dir].flatMap(([key, action]) => {
        const id = (child: string) =>
          `${dir}|R|${container}|rule|${child}|${key}`;
        const twin: KeyChangesNothingCell = {
          id: id("twin"),
          twin: id("twin"),
          child: "twin",
          stored: shape("Zw"),
          place:
            dir === "fwd"
              ? range("X0wZw", 5, "X0wZw", 5)
              : range("ZwX0w", 0, "ZwX0w", 0),
          action,
        };
        return [
          twin,
          ...Object.entries(CHILDREN).map(([name, child]) => ({
            id: id(name),
            twin: id("twin"),
            child: name,
            stored: shape(child.html),
            place: child[dir],
            action,
          })),
        ];
      })
  )
);
