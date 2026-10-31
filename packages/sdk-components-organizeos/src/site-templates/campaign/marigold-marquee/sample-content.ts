import type { Issue, Opportunity, Quote } from "./sections";

// The sample items more than one page lists, or that a page lists at length:
// the issues (Home shows three, the Issues page each with its steps), the
// ways to volunteer (Home shows three, the Volunteer page all six) and the
// endorsements. Neutral for any party or none: an issue is a bracket to
// fill, never a position.

const ISSUE_LINES = [
  "Say in one line what you will do about it, in the words a neighbor would use.",
  "Say what changes for people if you win, and how soon they will see it.",
  "Say what you have already done about it, and what comes next.",
  "Say who it matters to most, and what you will ask of them.",
] as const;

const STEPS = [
  "Name the first thing you will do.",
  "Say who it helps, and where.",
  "Say how people will know it worked.",
];

export const HOME_ISSUES: Issue[] = [
  ["01", "[Issue one]", ISSUE_LINES[0]],
  ["02", "[Issue two]", ISSUE_LINES[1]],
  ["03", "[Issue three]", ISSUE_LINES[2]],
];

export const ISSUES: Issue[] = [
  ["01", "[Issue one]", ISSUE_LINES[0], STEPS],
  ["02", "[Issue two]", ISSUE_LINES[1], STEPS],
  ["03", "[Issue three]", ISSUE_LINES[2], STEPS],
  ["04", "[Issue four]", ISSUE_LINES[3], STEPS],
];

export const HOME_OPPORTUNITIES: Opportunity[] = [
  [
    "[2 hours], weekends",
    "Knock on doors",
    "Talk with voters about the campaign, in pairs, with a short guide.",
  ],
  [
    "[1 hour], evenings",
    "Make calls",
    "Call voters from home or with the team, with a script and a list.",
  ],
  [
    "[3 hours], once",
    "Host a house meeting",
    "Invite a few neighbors over to meet [Candidate name] and ask questions.",
  ],
];

export const OPPORTUNITIES: Opportunity[] = [
  ...HOME_OPPORTUNITIES,
  [
    "[Half a day]",
    "Help at events",
    "Set up, greet people at the door and sign up new volunteers.",
  ],
  [
    "[1 hour], at home",
    "Write postcards",
    "Write short notes to voters with the cards and addresses we send you.",
  ],
  [
    "[Election day]",
    "Give voters a ride",
    "Drive voters who need a lift to their polling place and back.",
  ],
];

export const QUOTES: Quote[] = [
  [
    "Why they back [Candidate name], in their own words, in a sentence or two.",
    "[Full name]",
    "[Neighbor], [Place]",
  ],
  [
    "What they have seen [Candidate name] do, and why it matters to them.",
    "[Full name]",
    "[Role], [Organization]",
  ],
  [
    "A line from a local leader on what this race means for [Place].",
    "[Full name]",
    "[Title], [Place]",
  ],
  [
    "Why their group backs the campaign, and what its members will do.",
    "[Group name]",
    "[Members] members",
  ],
  [
    "What a volunteer would tell a friend who is still deciding.",
    "[Full name]",
    "Volunteer, [Place]",
  ],
  [
    "One sentence from someone who has worked beside [Candidate name].",
    "[Full name]",
    "[Role], [Year] to [Year]",
  ],
];
