// The three programs Home's cards and the Programs page's rows share, and the
// item a new one starts from: the photo file (none for the builder's
// placeholder), the area, the name and a two-line summary.

/** [photo file, area, name, summary] */
export type Program = [string | undefined, string, string, string];

export const PROGRAMS: Program[] = [
  [
    "program-one.jpg",
    "[Program area]",
    "[First program]",
    "Two lines on who it serves and what it does, in plain words a neighbor would use.",
  ],
  [
    "program-two.jpg",
    "[Program area]",
    "[Second program]",
    "Two lines on who it serves and what it does, in plain words a neighbor would use.",
  ],
  [
    "program-three.jpg",
    "[Program area]",
    "[Third program]",
    "Two lines on who it serves and what it does, in plain words a neighbor would use.",
  ],
];

/** A Content Block's new program: a photo slot and placeholders. */
export const PROGRAM_TEMPLATE: Program = [
  undefined,
  "[Program area]",
  "[Program name]",
  "[Two lines on what it does.]",
];
