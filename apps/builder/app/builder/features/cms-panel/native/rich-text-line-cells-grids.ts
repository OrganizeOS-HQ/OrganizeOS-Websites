// The grids of spec 5.3 (Task 22): the shapes, places and commands of the
// point, meeting-point, node-selection and unreached grids, and the cell
// test they share. A cell is kept cheap (`recordEdit`'s short form): mount,
// place, action, the write, the onChange count and the caret, then one
// letter. Each file's last test writes every cell to its file snapshot.
// It imports only the kit, so the same file runs at fork main.
import { expect, test } from "vitest";
import {
  at,
  blockType,
  containerPoint,
  GRID_COMMANDS,
  IMG,
  imageNode,
  itemPoint,
  LI,
  nodeAfter,
  nodeSelect,
  pasteFiles,
  pasteHtml,
  recordEdit,
  type Step,
} from "./rich-text-line-test-kit";
import { expectFixedPoint, plain } from "./rich-text-test-harness";

export type GridCell = {
  /** `<point> <command>`. */
  name: string;
  point: string;
  stored: string;
  place: Step;
  action: Step;
  /** A write asserted by its own literal (D18 step 1). */
  write?: string;
};

type Point = { point: string; stored: string; place: Step };

const commandsBy = (
  points: Point[],
  commands: ReadonlyArray<readonly [string, Step]>
): GridCell[] =>
  points.flatMap(({ point, stored, place }) =>
    commands.map(([label, action]) => ({
      name: `${point} ${label}`,
      point,
      stored,
      place,
      action,
    }))
  );

// ---------------------------------------------------------------------------
// The points: 23 element points by the 30 commands

export const POINT_SHAPES: ReadonlyArray<readonly [string, string, number]> = [
  ["TR", LI("T0w<hr>"), 2],
  ["RT", LI("<hr>T1w"), 2],
  ["QR", LI("<blockquote><p>Q0w</p></blockquote><hr>"), 2],
  ["RQ", LI("<hr><blockquote><p>Q1w</p></blockquote>"), 2],
  ["TRT", LI("T0w<hr>T2w"), 3],
  [
    "QRQ",
    LI(
      "<blockquote><p>Q0w</p></blockquote><hr><blockquote><p>Q2w</p></blockquote>"
    ),
    3,
  ],
  ["RR", LI("<hr><hr>"), 2],
];

export const ELEMENT_POINTS: Point[] = POINT_SHAPES.flatMap(
  ([shape, stored, last]) =>
    Array.from({ length: last + 1 }, (_, offset) => ({
      point: `${shape}@${offset}`,
      stored,
      place: itemPoint(1, offset),
    }))
);

export const pointCells = () => commandsBy(ELEMENT_POINTS, GRID_COMMANDS);

// ---------------------------------------------------------------------------
// The meeting points: M31's 10 and BQ el1, by the 30 commands

export const MEETING_POINTS: Point[] = [
  {
    point: "TQ@1",
    stored: LI("T0w<blockquote><p>Q1w</p></blockquote>"),
    place: itemPoint(1, 1),
  },
  {
    point: "QT@1",
    stored: LI("<blockquote><p>Q0w</p></blockquote>T1w"),
    place: itemPoint(1, 1),
  },
  {
    point: "TQT el1",
    stored: LI("T0w<blockquote><p>Q1w</p></blockquote>T2w"),
    place: itemPoint(1, 1),
  },
  {
    point: "TQT el2",
    stored: LI("T0w<blockquote><p>Q1w</p></blockquote>T2w"),
    place: itemPoint(1, 2),
  },
  { point: "TH@1", stored: LI("T0w<h3>H1w</h3>"), place: itemPoint(1, 1) },
  {
    point: "TC@1",
    stored: LI("T0w<pre><code>C1w</code></pre>"),
    place: itemPoint(1, 1),
  },
  {
    point: "AQ el1",
    stored: LI(
      '<a href="https://example.org/a">Aw</a><blockquote><p>Q1w</p></blockquote>'
    ),
    place: itemPoint(1, 1),
  },
  {
    point: "QA el1",
    stored: LI(
      '<blockquote><p>Q0w</p></blockquote><a href="https://example.org/a">Lw</a>'
    ),
    place: itemPoint(1, 1),
  },
  {
    point: "QB el1",
    stored: LI("<blockquote><p>Q0w</p></blockquote><br>"),
    place: itemPoint(1, 1),
  },
  {
    point: "root el1",
    stored: "<blockquote>X1w<p>X2w</p></blockquote>",
    place: containerPoint("X1w", 1),
  },
  {
    point: "BQ el1",
    stored: LI("<br><blockquote><p>Q1w</p></blockquote>"),
    place: itemPoint(1, 1),
  },
];

/**
 * D18 step 1: at the start of a line that begins with a line break, directly
 * after a block, the letter lands in the line, not at the block's end.
 */
const D18_STEP_1: Record<string, string> = {
  "QB el1 letter":
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /></li><li>Nw</li></ul>",
};

export const meetingCells = () =>
  commandsBy(MEETING_POINTS, GRID_COMMANDS).map((cell) => ({
    ...cell,
    write: D18_STEP_1[cell.name],
  }));

// ---------------------------------------------------------------------------
// The node selections: four shapes, each selected by code and for real, by
// the 30 commands, a pasted rule and a pasted file

const NODE_SHAPES = [
  ["rule in TRT", LI("T0w<hr>T2w"), "horizontalrule"],
  ["rule in TR", LI("T0w<hr>"), "horizontalrule"],
  ["image in QI", LI(`<blockquote><p>Q0w</p></blockquote>${IMG}`), "cms-image"],
  [
    "image in TQI",
    LI(`T0w<blockquote><p>Q1w</p></blockquote>X2w${IMG}`),
    "cms-image",
  ],
] as const;

export const NODE_COMMANDS: ReadonlyArray<readonly [string, Step]> = [
  ...GRID_COMMANDS,
  ["paste <hr>", pasteHtml("<hr>")],
  ["pasteFiles", pasteFiles],
];

export const nodeCells = () =>
  commandsBy(
    NODE_SHAPES.flatMap(([shape, stored, type]) => [
      { point: `${shape} by code`, stored, place: nodeSelect(type) },
      {
        point: `${shape} for real`,
        stored,
        place: type === "horizontalrule" ? nodeAfter("T0w") : imageNode(),
      },
    ]),
    NODE_COMMANDS
  );

// ---------------------------------------------------------------------------
// The unreached inputs (Task 5's list of inputs outside every set): nine
// shapes, each at a text caret in the line and the element point beside
// the block, by the 30 commands and Heading 3 and Heading 4

/** Lists `depth` deep, `A1w` to `A<depth-1>w` above the innermost item. */
const deep = (depth: number, inner: string) => {
  let html = `<ul><li>${inner}</li></ul>`;
  for (let level = depth - 1; level >= 1; level -= 1) {
    html = `<ul><li>A${level}w${html}</li></ul>`;
  }
  return html;
};

export const UNREACHED_POINTS: Point[] = [
  ...(() => {
    const stored = "<ol><li>Pw</li><li>T0w<hr></li><li>Nw</li></ol>";
    return [
      { point: "ol TR T0w@1", stored, place: at("T0w", 1) },
      { point: "ol TR el2", stored, place: itemPoint(1, 2) },
    ];
  })(),
  ...(() => {
    const stored =
      "<ul><li>Aw<ul><li>Pw</li><li>T0w<hr></li><li>Nw</li></ul></li></ul>";
    return [
      { point: "d2 TR T0w@1", stored, place: at("T0w", 1) },
      { point: "d2 TR el2", stored, place: containerPoint("T0w", 2) },
    ];
  })(),
  ...(() => {
    const stored = deep(6, "T0w<blockquote><p>Q1w</p></blockquote>T2w");
    return [
      { point: "d6 TQT T0w@1", stored, place: at("T0w", 1) },
      { point: "d6 TQT el1", stored, place: containerPoint("T0w", 1) },
    ];
  })(),
  ...(() => {
    const stored = deep(7, "T0w<hr>");
    return [
      { point: "d7 TR T0w@1", stored, place: at("T0w", 1) },
      { point: "d7 TR el2", stored, place: containerPoint("T0w", 2) },
    ];
  })(),
  ...(() => {
    const stored = LI("T0w<blockquote>X1w<hr></blockquote>T2w");
    return [
      { point: "TQT in item X1w@1", stored, place: at("X1w", 1) },
      { point: "TQT in item el1", stored, place: containerPoint("X1w", 1) },
    ];
  })(),
  ...(() => {
    const stored =
      "<blockquote>X0w<ul><li>T1w<hr>T2w</li></ul>X3w</blockquote>";
    return [
      { point: "TRT in quote T1w@1", stored, place: at("T1w", 1) },
      { point: "TRT in quote el1", stored, place: containerPoint("T1w", 1) },
    ];
  })(),
  ...(() => {
    const stored = LI("<blockquote><h3>H0w</h3>X1w</blockquote>T2w");
    return [
      { point: "HQ in item H0w@1", stored, place: at("H0w", 1) },
      { point: "HQ in item el1", stored, place: containerPoint("H0w", 1) },
    ];
  })(),
  ...(() => {
    const stored = LI('<a href="https://example.org/a">Lw</a><hr>');
    return [
      { point: "AR Lw@1", stored, place: at("Lw", 1) },
      { point: "AR el2", stored, place: itemPoint(1, 2) },
    ];
  })(),
  ...(() => {
    const stored = LI(`${IMG}<hr>`);
    return [
      { point: "IR el1", stored, place: itemPoint(1, 1) },
      { point: "IR el2", stored, place: itemPoint(1, 2) },
    ];
  })(),
];

export const UNREACHED_COMMANDS: ReadonlyArray<readonly [string, Step]> = [
  ...GRID_COMMANDS,
  ["Heading 3", blockType("Heading 3")],
  ["Heading 4", blockType("Heading 4")],
];

export const unreachedCells = () =>
  commandsBy(UNREACHED_POINTS, UNREACHED_COMMANDS);

// ---------------------------------------------------------------------------
// The cell test and the file's snapshot

export type GridEntry = {
  write: string | null;
  calls: number;
  caret: string;
  typed?: string;
};

/**
 * One test per cell, then "the grid's writes": every cell's
 * `{ write, calls, caret, typed }`, and with `placed` the caret right after
 * each point's place (`<point> placed`), sorted by name, to `snapshot`.
 */
export const gridTests = (
  cells: GridCell[],
  snapshot: string,
  { placed = false }: { placed?: boolean } = {}
) => {
  const writes: Record<string, GridEntry | string> = {};
  const expected = new Set(cells.map((cell) => cell.name));
  const firsts = new Set<string>();
  for (const cell of cells) {
    if (placed && firsts.has(cell.point) === false) {
      firsts.add(cell.point);
      expected.add(`${cell.point} placed`);
      test(cell.name, () => runCell(cell, writes, `${cell.point} placed`));
    } else {
      test(cell.name, () => runCell(cell, writes));
    }
  }
  test("the grid's writes", async () => {
    const missing = [...expected].filter((name) => name in writes === false);
    expect(missing, "run the whole file").toEqual([]);
    const sorted = Object.fromEntries(
      Object.keys(writes)
        .sort()
        .map((name) => [name, writes[name]])
    );
    await expect(`${JSON.stringify(sorted, null, 2)}\n`).toMatchFileSnapshot(
      snapshot
    );
  });
};

const runCell = async (
  cell: GridCell,
  writes: Record<string, GridEntry | string>,
  placedName?: string
) => {
  const record = await recordEdit(
    { stored: cell.stored, place: cell.place, action: cell.action },
    { short: true }
  );
  const { write, calls, caret, typed } = record;
  writes[cell.name] = { write, calls, caret, typed };
  if (placedName !== undefined) {
    writes[placedName] = record.caretBefore;
  }
  expect(record.errors, "console errors").toEqual([]);
  expect(record.slowest, "slowest step in ms").toBeLessThan(2000);
  if (typeof write === "string") {
    expect(record.written, "D19: a write that changes the value").not.toBe(
      record.valueBefore
    );
  }
  if (cell.write !== undefined) {
    expect(write, "D18 step 1: the write in the line").toBe(cell.write);
  }
  if (cell.name.endsWith(" ime")) {
    // T46.3: no value handed out holds the composition-start character;
    // T67.2: a composition hands out its composed values and nothing else,
    // from a text caret too (its start's commit, which leaves the document
    // as it was, is not handed out): one call for the one composed value
    expect(
      record.values.filter((value) => value.includes("\u200b")),
      "T46.3: no value holds U+200B"
    ).toEqual([]);
    expect(calls, "T67.2: one call per composed value").toBe(1);
    expect(record.values, "T67.2: not the value as it stood").not.toContain(
      record.valueBefore
    );
  }
  const pinned = PINS[cell.name];
  if (pinned !== undefined) {
    expect({ write, calls, caret, typed }, pinned.ruling).toEqual(pinned.pin);
    if (pinned.written !== undefined) {
      expect(plain(record.written), "the value as written").toBe(
        pinned.written
      );
    }
    if (pinned.fixedPoint === true) {
      expectFixedPoint(record.written);
    }
    const full = await recordEdit({
      stored: cell.stored,
      place: cell.place,
      action: cell.action,
    });
    expect(full.write, "the full record's write").toBe(pinned.pin.write);
    expect(full.undoRestores, "undo restores the state before").toBe(true);
    expect(full.redoEquals, "redo equals the write").toBe(true);
  }
};

/**
 * Cells pinned by their literal (T46.2, T46.4, T46.7): the write, the
 * onChange count, the caret and the letter, with an exact undo and redo.
 */
export const PINS: Record<
  string,
  { ruling: string; pin: GridEntry; written?: string; fixedPoint?: boolean }
> = {
  "AQ el1 ime": {
    ruling: "T46.2, T67.2",
    pin: {
      write:
        "<ul><li>Pw</li><li><a>Awa</a><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:Awa@3",
      typed:
        "<ul><li>Pw</li><li><a>Awa</a>k<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>",
    },
  },
  "image in TQI for real Code": {
    ruling: "T46.4 (M-e3)",
    pin: {
      write:
        "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><pre><code>X2w</code></pre><img /></li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:X2w@3",
      typed:
        "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><pre><code>X2wk</code></pre><img /></li><li>Nw</li></ul>",
    },
  },
  "image in QI for real Ctrl+Backspace": {
    ruling: "T46.4 (M-e4)",
    pin: {
      write:
        "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>",
      calls: 1,
      caret: "element:listitem@1",
      typed:
        "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k</li><li>Nw</li></ul>",
    },
  },
  "HQ in item el1 Backspace": {
    ruling: "T46.4 (M-e5)",
    pin: {
      write:
        "<ul><li>Pw</li><li><blockquote><h3>H0wX1w</h3></blockquote>T2w</li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:H0wX1w@3",
      typed:
        "<ul><li>Pw</li><li><blockquote><h3>H0wkX1w</h3></blockquote>T2w</li><li>Nw</li></ul>",
    },
  },
  "HQ in item el1 Ctrl+Backspace": {
    ruling: "T46.4 (M-e5)",
    pin: {
      write:
        "<ul><li>Pw</li><li><blockquote><h3>H0wX1w</h3></blockquote>T2w</li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:H0wX1w@3",
      typed:
        "<ul><li>Pw</li><li><blockquote><h3>H0wkX1w</h3></blockquote>T2w</li><li>Nw</li></ul>",
    },
  },
  "HQ in item el1 lineBack": {
    ruling: "T46.4 (M-e5)",
    pin: {
      write:
        "<ul><li>Pw</li><li><blockquote><h3>H0wX1w</h3></blockquote>T2w</li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:H0wX1w@3",
      typed:
        "<ul><li>Pw</li><li><blockquote><h3>H0wkX1w</h3></blockquote>T2w</li><li>Nw</li></ul>",
    },
  },
  "d6 TQT el1 paste HTML": {
    ruling: "T46.4 (M-e6)",
    pin: {
      write:
        "<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAq</li></ul></li><li>Bq</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote><p>Q1w</p></blockquote><p>T2w</p>",
      calls: 1,
      caret: "text:Bq@2",
      typed:
        "<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAq</li></ul></li><li>Bqk</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote><p>Q1w</p></blockquote><p>T2w</p>",
    },
  },
  "d6 TQT el1 paste own": {
    ruling: "T46.4 (M-e6)",
    pin: {
      write:
        "<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAq</li></ul></li><li>Bq</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote><p>Q1w</p></blockquote><p>T2w</p>",
      calls: 1,
      caret: "text:Bq@2",
      typed:
        "<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAq</li></ul></li><li>Bqk</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote><p>Q1w</p></blockquote><p>T2w</p>",
    },
  },
  "d6 TQT el1 paste text": {
    ruling: "T46.4 (M-e6)",
    pin: {
      write:
        "<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAq<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>",
      calls: 1,
      caret: "text:T0wAq@5",
      typed:
        "<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAqk<blockquote><p>Q1w</p></blockquote>T2w</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>",
    },
  },
  "AQ el1 Code": {
    ruling: "T46.4 (M-e7)",
    pin: {
      write:
        "<ul><li>Pw</li><li><pre><code>Aw</code></pre><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:Aw@2",
      typed:
        "<ul><li>Pw</li><li><pre><code>Awk</code></pre><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>",
    },
  },
  "QA el1 Code": {
    ruling: "T46.4 (M-e7)",
    pin: {
      write:
        "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><pre><code>Lw</code></pre></li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:Lw@0",
      typed:
        "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><pre><code>kLw</code></pre></li><li>Nw</li></ul>",
    },
  },
  "AR Lw@1 Code": {
    ruling: "T46.4 (M-e7)",
    pin: {
      write:
        "<ul><li>Pw</li><li><pre><code>Lw</code></pre><hr /></li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:Lw@1",
      typed:
        "<ul><li>Pw</li><li><pre><code>Lkw</code></pre><hr /></li><li>Nw</li></ul>",
    },
  },
  "AQ el1 Link": {
    ruling: "T46.4 (M-e8)",
    pin: {
      write:
        "<ul><li>Pw</li><li><a>Aw</a><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:Aw@2",
      typed:
        "<ul><li>Pw</li><li><a>Aw</a>k<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>",
    },
    written:
      '<ul><li>Pw</li><li><a href="https://example.org/">Aw</a><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>',
  },
  "QA el1 Link": {
    ruling: "T46.4 (M-e8)",
    pin: {
      write:
        "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><a>Lw</a></li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:Lw@0",
      typed:
        "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<a>Lw</a></li><li>Nw</li></ul>",
    },
    written:
      '<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><a href="https://example.org/">Lw</a></li><li>Nw</li></ul>',
  },
  "HQ in item el1 Enter": {
    ruling: "T46.7",
    pin: {
      write:
        "<ul><li>Pw</li><li><blockquote><h3>H0w</h3><br />X1w</blockquote>T2w</li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:X1w@0",
      typed:
        "<ul><li>Pw</li><li><blockquote><h3>H0w</h3><br />kX1w</blockquote>T2w</li><li>Nw</li></ul>",
    },
  },
  "TQT in item el1 Enter": {
    ruling: "T46.7",
    pin: {
      write:
        "<ul><li>Pw</li><li>T0w<blockquote>X1w<p></p><hr /></blockquote>T2w</li><li>Nw</li></ul>",
      calls: 1,
      caret: "element:paragraph@0",
      typed:
        "<ul><li>Pw</li><li>T0w<blockquote>X1w<p>k</p><hr /></blockquote>T2w</li><li>Nw</li></ul>",
    },
  },
  "TQT in item X1w@1 Enter": {
    ruling: "T46.7",
    pin: {
      write:
        "<ul><li>Pw</li><li>T0w<blockquote>X<p>1w</p><hr /></blockquote>T2w</li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:1w@0",
      typed:
        "<ul><li>Pw</li><li>T0w<blockquote>X<p>k1w</p><hr /></blockquote>T2w</li><li>Nw</li></ul>",
    },
  },
  "HQ in item el1 paste HTML": {
    ruling: "T46.7",
    pin: {
      write:
        "<ul><li>Pw</li><li><blockquote><h3>H0w</h3>Aq</blockquote>BqX1w<br />T2w</li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:BqX1w@2",
      typed:
        "<ul><li>Pw</li><li><blockquote><h3>H0w</h3>Aq</blockquote>BqkX1w<br />T2w</li><li>Nw</li></ul>",
    },
    fixedPoint: true,
  },
  "HQ in item el1 paste own": {
    ruling: "T46.7",
    pin: {
      write:
        "<ul><li>Pw</li><li><blockquote><h3>H0w</h3>Aq</blockquote>BqX1w<br />T2w</li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:BqX1w@2",
      typed:
        "<ul><li>Pw</li><li><blockquote><h3>H0w</h3>Aq</blockquote>BqkX1w<br />T2w</li><li>Nw</li></ul>",
    },
    fixedPoint: true,
  },
  "TQT in item el1 paste HTML": {
    ruling: "T46.7",
    pin: {
      write:
        "<ul><li>Pw</li><li>T0w<blockquote>X1wAq</blockquote>Bq<hr />T2w</li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:Bq@2",
      typed:
        "<ul><li>Pw</li><li>T0w<blockquote>X1wAq</blockquote>Bqk<hr />T2w</li><li>Nw</li></ul>",
    },
    fixedPoint: true,
  },
  "TQT in item el1 paste own": {
    ruling: "T46.7",
    pin: {
      write:
        "<ul><li>Pw</li><li>T0w<blockquote>X1wAq</blockquote>Bq<hr />T2w</li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:Bq@2",
      typed:
        "<ul><li>Pw</li><li>T0w<blockquote>X1wAq</blockquote>Bqk<hr />T2w</li><li>Nw</li></ul>",
    },
    fixedPoint: true,
  },
  "TQT in item X1w@1 paste HTML": {
    ruling: "T46.7",
    pin: {
      write:
        "<ul><li>Pw</li><li>T0w<blockquote>XAq</blockquote>Bq1w<hr />T2w</li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:Bq1w@2",
      typed:
        "<ul><li>Pw</li><li>T0w<blockquote>XAq</blockquote>Bqk1w<hr />T2w</li><li>Nw</li></ul>",
    },
    fixedPoint: true,
  },
  "TQT in item X1w@1 paste own": {
    ruling: "T46.7",
    pin: {
      write:
        "<ul><li>Pw</li><li>T0w<blockquote>XAq</blockquote>Bq1w<hr />T2w</li><li>Nw</li></ul>",
      calls: 1,
      caret: "text:Bq1w@2",
      typed:
        "<ul><li>Pw</li><li>T0w<blockquote>XAq</blockquote>Bqk1w<hr />T2w</li><li>Nw</li></ul>",
    },
    fixedPoint: true,
  },
  "AR el2 Ctrl+Backspace": {
    ruling: "T46.7",
    pin: {
      write: "<ul><li>Pw</li><li><a>Lw</a></li><li>Nw</li></ul>",
      calls: 1,
      caret: "element:listitem@1",
      typed: "<ul><li>Pw</li><li><a>Lw</a>k</li><li>Nw</li></ul>",
    },
  },
  "AR el2 lineBack": {
    ruling: "T46.7",
    pin: {
      write: "<ul><li>Pw</li><li><a>Lw</a></li><li>Nw</li></ul>",
      calls: 1,
      caret: "element:listitem@1",
      typed: "<ul><li>Pw</li><li><a>Lw</a>k</li><li>Nw</li></ul>",
    },
  },
  "TQT in item el1 Bulleted list": {
    ruling: "T46.7",
    pin: {
      write:
        "<p>Pw</p><p>T0w</p><blockquote>X1w<hr /></blockquote><p>T2w</p><p>Nw</p>",
      calls: 1,
      caret: "text:X1w@3",
      typed:
        "<p>Pw</p><p>T0w</p><blockquote>X1wk<hr /></blockquote><p>T2w</p><p>Nw</p>",
    },
  },
  "TQT el1 paste HTML": {
    ruling: "T46.7",
    pin: {
      write:
        "<ul><li>Pw</li><li>T0wAq</li></ul><p>Bq</p><blockquote><p>Q1w</p></blockquote><p>T2w</p><ul><li>Nw</li></ul>",
      calls: 1,
      caret: "text:Bq@2",
      typed:
        "<ul><li>Pw</li><li>T0wAq</li></ul><p>Bqk</p><blockquote><p>Q1w</p></blockquote><p>T2w</p><ul><li>Nw</li></ul>",
    },
  },
  "TQT el1 paste own": {
    ruling: "T46.7",
    pin: {
      write:
        "<ul><li>Pw</li><li>T0wAq</li></ul><p>Bq</p><blockquote><p>Q1w</p></blockquote><p>T2w</p><ul><li>Nw</li></ul>",
      calls: 1,
      caret: "text:Bq@2",
      typed:
        "<ul><li>Pw</li><li>T0wAq</li></ul><p>Bqk</p><blockquote><p>Q1w</p></blockquote><p>T2w</p><ul><li>Nw</li></ul>",
    },
  },
};
