// The three programs Home's cards and the Programs page's rows share: the
// photo file, the area, the name and a two-line summary.

/** [photo file, area, name, summary] */
export type Program = [string, string, string, string];

export const PROGRAMS: Program[] = [
  [
    "program-one.jpg",
    "[Program area]",
    "[Name of your first program]",
    "Two lines on who it serves and what it does, in plain words a neighbor would use.",
  ],
  [
    "program-two.jpg",
    "[Program area]",
    "[Name of your second program]",
    "Two lines on who it serves and what it does, in plain words a neighbor would use.",
  ],
  [
    "program-three.jpg",
    "[Program area]",
    "[Name of your third program]",
    "Two lines on who it serves and what it does, in plain words a neighbor would use.",
  ],
];
