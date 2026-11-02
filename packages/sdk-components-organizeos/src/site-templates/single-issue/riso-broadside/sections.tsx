import { css, ws, type TemplateStyleDecl } from "@webstudio-is/template";
import {
  BREAKPOINT,
  CONTAINER,
  SPACE,
  contentBlock,
  focusRing,
  keyed,
  sample,
  section,
  text,
} from "../../kit";
import type { PageContext } from "../../types";
import { ADD_YOUR_NAME, type PageIds, invertedButton } from "./parts";
import {
  RULE,
  answerStyles,
  countStyles,
  headingStyles,
  labelStyles,
  leadStyles,
  numeralStyles,
  outlineStyles,
  paragraphStyles,
  questionStyles,
  ruleAboveStyles,
  stackStyles,
  subheadingStyles,
} from "./styles";

// Riso Broadside's sections after the hero (./hero), in the order Home
// shows them, each a kit section named from the vocabulary (spec section
// 3). Home (./home) gives them their sample copy.

/** A section's heading block: a label, the h2 and a sentence. */
const sectionHeader = ({
  label,
  heading,
  intro,
}: {
  label: string;
  heading: string;
  intro: string;
}): JSX.Element => (
  <ws.element
    ws:tag="div"
    ws:label="Heading"
    ws:style={[
      ...stackStyles(SPACE[16]),
      ...css`
        max-width: ${CONTAINER.narrow};
      `,
    ]}
  >
    {text("p", labelStyles(), label, "Label")}
    {text("h2", headingStyles(), heading)}
    {text("p", paragraphStyles(), intro)}
  </ws.element>
);

/**
 * Stats: Inline row, the progress line: the count large in pink, and beside
 * it how far it has to go and by when over one thick bar, blue on a base
 * track in a 2px text outline, its fill as wide as the share of the goal
 * reached (a sample figure staff edit with the count). On phones the count
 * sits above the line and its bar. The bar repeats the figures, so
 * assistive technology skips it.
 */
export const statsProgress = ({
  count,
  line,
  share,
}: {
  count: string;
  line: string;
  /** The fill's width: the count over the goal, as a percentage. */
  share: string;
}): JSX.Element =>
  section({
    label: "Stats: Inline row",
    children: (
      <ws.element
        ws:tag="div"
        ws:label="Progress"
        ws:style={css`
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: end;
          column-gap: ${SPACE[48]};
          row-gap: ${SPACE[24]};
          ${BREAKPOINT.tablet} {
            column-gap: ${SPACE[32]};
          }
          ${BREAKPOINT.landscape} {
            grid-template-columns: minmax(0, 1fr);
            row-gap: ${SPACE[16]};
          }
        `}
      >
        {text(
          "p",
          countStyles("clamp(72px, 3vw + 64px, 112px)"),
          count,
          "Count"
        )}
        <ws.element
          ws:tag="div"
          ws:label="Goal and bar"
          ws:style={css`
            display: flex;
            flex-direction: column;
            row-gap: ${SPACE[16]};
            padding-bottom: 6px;
            ${BREAKPOINT.landscape} {
              row-gap: ${SPACE[12]};
              padding-bottom: 0;
            }
          `}
        >
          {text("p", subheadingStyles("36px", "30px"), line, "Goal")}
          <ws.element
            ws:tag="div"
            ws:label="Bar"
            aria-hidden="true"
            ws:style={[
              ...outlineStyles(),
              ...css`
                box-sizing: border-box;
                height: 40px;
                background-color: var(--base);
                ${BREAKPOINT.landscape} {
                  height: 32px;
                }
              `,
            ]}
          >
            <ws.element
              ws:tag="div"
              ws:label="Fill"
              ws:style={css`
                width: ${share};
                height: 100%;
                background-color: var(--accent-1);
              `}
            />
          </ws.element>
        </ws.element>
      </ws.element>
    ),
  });

/** [number, name, a sentence] */
export type Value = [string, string, string];

/** How a value's block is printed: a field of blue or ink, or an outline. */
type Print = "blue" | "ink" | "outline";

/**
 * Each print's colours. Every block has the 2px outline, in its own fill on
 * the solid ones, so the three blocks' text sits level.
 */
const printStyles: Record<Print, () => TemplateStyleDecl[]> = {
  blue: () => [
    ...outlineStyles("var(--accent-1)"),
    ...css`
      background-color: var(--accent-1);
      color: var(--base);
    `,
  ],
  ink: () => [
    ...outlineStyles("var(--text)"),
    ...css`
      background-color: var(--text);
      color: var(--base);
    `,
  ],
  outline: () => [
    ...outlineStyles(),
    ...css`
      color: var(--text);
    `,
  ],
};

/**
 * One value as a solid square block: its number large in the heading face
 * (in pink on the outlined one, which sits on the base), its name and a
 * sentence.
 */
const value =
  (print: Print) =>
  ([number, name, line]: Value): JSX.Element => (
    <ws.element
      ws:tag="div"
      ws:label="Value"
      ws:style={[
        ...stackStyles(SPACE[16]),
        ...css`
          box-sizing: border-box;
          min-width: 0;
          padding-top: ${SPACE[32]};
          padding-right: ${SPACE[32]};
          padding-bottom: ${SPACE[48]};
          padding-left: ${SPACE[32]};
          ${BREAKPOINT.landscape} {
            padding-top: ${SPACE[24]};
            padding-right: ${SPACE[24]};
            padding-bottom: ${SPACE[32]};
            padding-left: ${SPACE[24]};
          }
        `,
        ...printStyles[print](),
      ]}
    >
      {text(
        "p",
        [
          ...numeralStyles("88px", "72px"),
          ...(print === "outline"
            ? css`
                color: var(--accent-2);
              `
            : []),
        ],
        number,
        "Number"
      )}
      {text("h3", subheadingStyles(), name)}
      {text("p", paragraphStyles(), line)}
    </ws.element>
  );

/** The three blocks' prints, in order: blue, ink, outlined. */
const PRINTS: Print[] = ["blue", "ink", "outline"];

/**
 * Mission and values: Three columns (`#why`, the nav's Why): the heading
 * over three solid numbered blocks, blue, ink and outlined, square; one
 * column below 992px. A value added in Simple mode is outlined.
 */
export const whyItMatters = ({
  heading,
  intro,
  values,
}: {
  heading: string;
  intro: string;
  values: Value[];
}): JSX.Element =>
  section({
    label: "Mission and values: Three columns",
    id: "why",
    children: keyed([
      sectionHeader({ label: "Why it matters", heading, intro }),
      <ws.element
        ws:tag="div"
        ws:label="Values"
        ws:style={css`
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          column-gap: ${SPACE[24]};
          row-gap: ${SPACE[24]};
          margin-top: ${SPACE[48]};
          ${BREAKPOINT.tablet} {
            grid-template-columns: minmax(0, 1fr);
            row-gap: ${SPACE[16]};
          }
          ${BREAKPOINT.landscape} {
            margin-top: ${SPACE[32]};
          }
        `}
      >
        {contentBlock({
          label: "Values",
          template: value("outline")([
            "[0]",
            "[Reason]",
            "One sentence on why it matters.",
          ]),
          items: values.map((item, index) =>
            value(PRINTS[index % PRINTS.length])(item)
          ),
        })}
      </ws.element>,
    ]),
  });

/**
 * Sign-up: Side by side (`#sign-up`, where every button goes): the heading
 * and the reasons to sign on the left, the Signup Form in a 2px ink box on
 * the right. On phones one column, the form right after the heading and the
 * reasons under it: the order the elements come in, which the desktop grid
 * places in two columns.
 */
export const signUp = ({
  placeBlock,
  label,
  heading,
  intro,
  reasons,
}: Pick<PageContext, "placeBlock"> & {
  label: string;
  heading: string;
  intro: string;
  reasons: string[];
}): JSX.Element => {
  const reason = (line: string) => (
    <ws.element
      ws:tag="li"
      ws:label="Reason"
      ws:style={[
        ...ruleAboveStyles(),
        ...paragraphStyles(),
        ...css`
          padding-top: ${SPACE[16]};
          padding-bottom: ${SPACE[16]};
        `,
      ]}
    >
      {sample(line)}
    </ws.element>
  );
  return section({
    label: "Sign-up: Side by side",
    id: "sign-up",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          grid-template-rows: auto 1fr;
          align-items: start;
          column-gap: ${SPACE[64]};
          row-gap: ${SPACE[32]};
          ${BREAKPOINT.tablet} {
            column-gap: ${SPACE[48]};
          }
          ${BREAKPOINT.landscape} {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: none;
          }
        `}
      >
        {sectionHeader({ label, heading, intro })}
        {/*
          The form opens with its own h2 (its text the template's, its look
          "OS Form Heading" in index.tsx, with no margins), whose capitals
          sit about 8px into their line: the box gives up as much at the
          top, so the form sits evenly in it.
        */}
        <ws.element
          ws:tag="div"
          ws:label="Form box"
          ws:style={[
            ...outlineStyles(),
            ...css`
              grid-column-start: 2;
              grid-row-start: 1;
              grid-row-end: span 2;
              box-sizing: border-box;
              padding-top: ${SPACE[24]};
              padding-right: ${SPACE[32]};
              padding-bottom: ${SPACE[32]};
              padding-left: ${SPACE[32]};
              ${BREAKPOINT.landscape} {
                grid-column-start: auto;
                grid-row-start: auto;
                grid-row-end: auto;
                padding-top: ${SPACE[16]};
                padding-right: ${SPACE[24]};
                padding-bottom: ${SPACE[24]};
                padding-left: ${SPACE[24]};
              }
            `,
          ]}
        >
          {placeBlock("@organizeos/site-components:SignupForm", "signup", {
            heading: ADD_YOUR_NAME.label,
            submit: ADD_YOUR_NAME.label,
          })}
        </ws.element>
        <ws.element
          ws:tag="ul"
          ws:label="Reasons"
          ws:style={css`
            margin-top: 0;
            margin-bottom: 0;
            padding-left: 0;
            list-style-type: none;
            border-bottom-width: ${RULE};
            border-bottom-style: solid;
            border-bottom-color: currentcolor;
          `}
        >
          {contentBlock({
            label: "Reasons",
            template: reason("One more reason to sign, in a sentence."),
            items: reasons.map(reason),
          })}
        </ws.element>
      </ws.element>
    ),
  });
};

/** [question, answer] */
export type Question = [string, string];

/**
 * One question as a disclosure: the question in the heading face with a
 * pink marker, which opens its answer. A details element needs no script,
 * and its summary is reached and toggled from the keyboard. The answer is
 * prose: a bracketed answer wraps as a sentence does, so it does not go
 * through `sample`, which would keep the whole bracket on one line.
 */
const question =
  (open: boolean) =>
  ([asked, answer]: Question): JSX.Element => (
    <ws.element
      ws:tag="details"
      ws:label="Question"
      {...(open ? { open: true } : {})}
      ws:style={ruleAboveStyles()}
    >
      <ws.element
        ws:tag="summary"
        ws:style={[...questionStyles(), ...focusRing()]}
      >
        {asked}
      </ws.element>
      <ws.element ws:tag="p" ws:style={answerStyles()}>
        {answer}
      </ws.element>
    </ws.element>
  );

/**
 * FAQ: Accordion (`#faq`, the nav's FAQ): the heading on the left, the
 * questions on the right under 2px rules, the first open; one column below
 * 992px.
 */
export const faq = ({
  heading,
  intro,
  questions,
}: {
  heading: string;
  intro: string;
  questions: Question[];
}): JSX.Element =>
  section({
    label: "FAQ: Accordion",
    id: "faq",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
          align-items: start;
          column-gap: ${SPACE[64]};
          row-gap: ${SPACE[32]};
          ${BREAKPOINT.tablet} {
            grid-template-columns: minmax(0, 1fr);
          }
        `}
      >
        {sectionHeader({ label: "FAQ", heading, intro })}
        <ws.element
          ws:tag="div"
          ws:label="Questions"
          ws:style={css`
            border-bottom-width: ${RULE};
            border-bottom-style: solid;
            border-bottom-color: currentcolor;
          `}
        >
          {contentBlock({
            label: "Questions",
            template: question(false)([
              "[Question]",
              "Its answer, in a sentence or two.",
            ]),
            items: questions.map((item, index) => question(index === 0)(item)),
          })}
        </ws.element>
      </ws.element>
    ),
  });

/**
 * Call to action band: Centered, the share band: on blue, the count again
 * with what it counts, a heading asking the visitor to send the page on,
 * a sentence and the one button back to the form.
 */
export const shareBand = ({
  pageIds,
  count,
  counted,
  heading,
  body,
}: {
  pageIds: PageIds;
  count: string;
  counted: string;
  heading: string;
  body: string;
}): JSX.Element =>
  section({
    label: "Call to action band: Centered",
    background: "accent-1",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={[
          ...stackStyles(SPACE[24], "center"),
          ...css`
            text-align: center;
            ${BREAKPOINT.landscape} {
              row-gap: ${SPACE[16]};
            }
          `,
        ]}
      >
        <ws.element
          ws:tag="div"
          ws:label="Count"
          ws:style={[
            ...stackStyles(SPACE[12], "center"),
            ...css`
              margin-bottom: ${SPACE[16]};
              ${BREAKPOINT.landscape} {
                margin-bottom: ${SPACE[8]};
              }
            `,
          ]}
        >
          {text(
            "p",
            countStyles("clamp(64px, 2vw + 56px, 88px)", "inherit"),
            count,
            "Count"
          )}
          {text("p", labelStyles(), counted, "Label")}
        </ws.element>
        {text(
          "h2",
          [
            ...headingStyles(),
            ...css`
              max-width: 14em;
            `,
          ],
          heading
        )}
        {text("p", leadStyles({ wrap: "balance" }), body)}
        <ws.element
          ws:tag="div"
          ws:style={css`
            margin-top: ${SPACE[8]};
          `}
        >
          {invertedButton(pageIds)}
        </ws.element>
      </ws.element>
    ),
  });
