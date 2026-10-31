import { ws } from "@webstudio-is/template";
import type { SiteTemplatePage } from "../../types";
import {
  faq,
  hero,
  shareBand,
  signUp,
  siteFooter,
  siteNav,
  statsProgress,
  whyItMatters,
} from "./sections";
import { bodyStyles } from "./styles";

// Home, the only page (directions 2.5; spec 5.1, template 5): Nav: Centered,
// with in-page links and one "Add your name" button; Hero: Full-bleed image;
// Stats: Inline row; Mission and values: Three columns; Sign-up: Side by
// side; FAQ: Accordion; Call to action band: Centered (share); Footer:
// Simple. The figures are samples in brackets, which staff type in.

/** The sample count, and its share of the sample goal: 1,240 of 2,000. */
const COUNT = "[1,240]";
const SHARE = "62%";

export const home: SiteTemplatePage = {
  key: "home",
  name: "Home",
  path: "",
  title: "[Organization name]",
  description:
    "Add your name: [say what you are asking for, and of whom], by [date].",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {hero({
        context,
        // one bracketed ask, wrapping as a sentence does
        ask: "[Say what you are asking for, and of whom]",
        sentence:
          "Say in one sentence why it matters now, and what changes if enough people sign.",
        position: "50% 30%",
        phonePosition: "48% 50%",
      })}
      {statsProgress({
        count: COUNT,
        line: "of [2,000] names by [date]",
        share: SHARE,
      })}
      {whyItMatters({
        heading: "Say why this cannot wait",
        intro:
          "Then give the three reasons people sign, each in a line they would say themselves.",
        values: [
          [
            "1",
            "[First reason]",
            "One sentence on what is at stake, and for whom.",
          ],
          [
            "2",
            "[Second reason]",
            "One sentence on what changes if the ask is met.",
          ],
          [
            "3",
            "[Third reason]",
            "One sentence on why now, and not next year.",
          ],
        ],
      })}
      {signUp({
        placeBlock: context.placeBlock,
        label: "Every name counts",
        heading: "Join the [1,240] already on the list",
        intro: "Say who the names go to, and when.",
        reasons: [
          "Say what the names will be used for, and who will see the list.",
          "Say how you will deliver them to [decision maker], and on what date.",
          "Say how you will keep people posted after they sign.",
        ],
      })}
      {faq({
        heading: "Questions before you sign",
        intro: "Answer what people ask most, in a sentence or two each.",
        questions: [
          [
            "What happens to my details?",
            "[Say who sees the names and emails, what they are used for, and how someone can ask to be removed.]",
          ],
          [
            "Who is this addressed to?",
            "Say who will receive the names, and why they can act on it.",
          ],
          [
            "Will my name be shown publicly?",
            "Say whether names are shared, and in what form.",
          ],
          [
            "What happens after [date]?",
            "Say what you will do with the result, and how you will tell people.",
          ],
        ],
      })}
      {shareBand({
        pageIds: context.pageIds,
        count: COUNT,
        counted: "Names so far",
        heading: "Send this page to three people you know",
        body: "Say who most needs to hear about it, and by when.",
      })}
      {siteFooter(context.pageIds, "Say who is behind the ask.")}
    </ws.element>
  ),
};
