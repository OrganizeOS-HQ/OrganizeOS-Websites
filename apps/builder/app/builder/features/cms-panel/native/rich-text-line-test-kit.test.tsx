import { describe, expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import {
  $createRangeSelection,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  DELETE_LINE_COMMAND,
  KEY_DOWN_COMMAND,
  SELECTION_CHANGE_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
  createEditor,
  type ElementNode,
  type LexicalEditor,
  type NodeKey,
  type RangeSelection,
  type TextNode,
} from "lexical";
import {
  importRichTextHtml,
  registerRichTextTransforms,
  richTextHtmlConfig,
  richTextNodes,
} from "./rich-text-html";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import {
  editable,
  editorOf,
  lastHtml,
  plain,
  renderField,
  settle,
} from "./rich-text-test-harness";
import {
  $baselinePoint,
  $rangeOracle,
  $wherePoint,
  IMG,
  LI,
  at,
  baselineChildCount,
  blockType,
  caretKey,
  clickItemCorner,
  clipboard,
  containerPoint,
  copy,
  expectEdit,
  forceOrder,
  htmlLines,
  hold,
  imageButton,
  itemEnd,
  itemPoint,
  keys,
  letter,
  lineBack,
  mount,
  mountExtraField,
  pasteOwn,
  pasteText,
  quiet,
  range,
  recordEdit,
  selectAll,
  setUpload,
  shiftPress,
  short,
  then,
  twinOf,
  backspace,
} from "./rich-text-line-test-kit";
import { forcedFailure, net } from "./rich-text-line-test-kit-branch";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A headless editor in the head's form: no line transforms. */
const headless = (html: string) => {
  const editor = createEditor({
    namespace: "kit-test",
    nodes: [...richTextNodes],
    html: richTextHtmlConfig,
    onError: (error) => {
      throw error;
    },
  });
  registerRichTextTransforms(editor);
  editor.update(() => importRichTextHtml(editor, sanitizeRichTextHtml(html)), {
    discrete: true,
  });
  return editor;
};

const $middleItem = () =>
  $getRoot()
    .getFirstChildOrThrow<ElementNode>()
    .getChildAtIndex(1) as ElementNode;
const $named = (point: { key: NodeKey; offset: number }) =>
  `${$getNodeByKey(point.key)!.getType()}@${point.offset}`;
const holdsLines = (editor: LexicalEditor) =>
  editor.getEditorState().read(() =>
    $middleItem()
      .getChildren()
      .some((child) => child.getType() === "cms-line")
  );

const BASELINE_CASES: Array<{
  name: string;
  html: string;
  offset: number;
  head: string;
  lined: string;
  count?: number;
}> = [
  {
    name: "(a) TQT at 1",
    html: LI("T0w<blockquote><p>Q1w</p></blockquote>T2w"),
    offset: 1,
    head: "listitem@1",
    lined: "listitem@1",
  },
  {
    name: "(b) TBQ at 2, directly before the quote",
    html: LI("T0w<br><blockquote><p>Q2w</p></blockquote>"),
    offset: 2,
    head: "listitem@2",
    lined: "listitem@1",
  },
  {
    name: "(c) TBQ at 1, between the text and the line break",
    html: LI("T0w<br><blockquote><p>Q2w</p></blockquote>"),
    offset: 1,
    head: "listitem@1",
    lined: "cms-line@1",
  },
  {
    name: "(d) QTB at 3, the item's end after the line's last break",
    html: LI("<blockquote><p>Q0w</p></blockquote>T1w<br>"),
    offset: 3,
    head: "listitem@3",
    lined: "listitem@2",
    count: 3,
  },
];

describe("the line tests' kit", () => {
  test("caretKey writes a text point", async () => {
    await mount("<p>T0w</p>");
    await at("T0w", 1)();
    expect(caretKey()).toBe("text:T0w@1");
  });

  test("caretKey writes an element point on a container that is not lined", async () => {
    await mount("<blockquote><p>a</p><hr></blockquote>");
    await containerPoint("a", 2)();
    expect(caretKey()).toBe("element:quote@2");
  });

  test("caretKey writes a point in an empty line as the container's point", async () => {
    await mount(LI("T0w<hr>"));
    await itemPoint(1, 2)();
    expect(caretKey()).toBe("element:listitem@2");
  });

  test("caretKey writes a point after a line's line break as the item's point", async () => {
    await mount(LI("<br><blockquote><p>Q1w</p></blockquote>"));
    await at("Pw")();
    await act(async () => {
      editorOf()!.update(() => {
        const brk = $middleItem()
          .getChildren()
          .flatMap((child) =>
            child.getType() === "cms-line"
              ? (child as ElementNode).getChildren()
              : [child]
          )
          .find((node) => node.getType() === "linebreak")!;
        const parent = brk.getParentOrThrow();
        const selection = $createRangeSelection();
        const offset = brk.getIndexWithinParent() + 1;
        selection.anchor.set(parent.getKey(), offset, "element");
        selection.focus.set(parent.getKey(), offset, "element");
        $setSelection(selection);
      });
    });
    await settle();
    expect(caretKey()).toBe("element:listitem@1");
  });

  test("caretKey counts a line's children one by one", async () => {
    await mount(LI("T0w<br><hr>"));
    await itemEnd(1)();
    expect(caretKey()).toBe("element:listitem@3");
  });

  for (const { name, html, offset, head, lined, count } of BASELINE_CASES) {
    test(`a baseline offset resolves to the same place in both forms: ${name}`, async () => {
      const base = headless(html);
      base.getEditorState().read(() => {
        expect($named($baselinePoint($middleItem(), offset))).toBe(head);
        if (count !== undefined) {
          expect(baselineChildCount($middleItem())).toBe(count);
        }
      });
      await mount(html);
      const editor = editorOf()!;
      expect(holdsLines(editor), "the mounted item holds lines").toBe(true);
      editor.getEditorState().read(() => {
        expect($named($baselinePoint($middleItem(), offset))).toBe(lined);
        if (count !== undefined) {
          expect(baselineChildCount($middleItem())).toBe(count);
        }
      });
    });
  }

  test("short abbreviates images and links", () => {
    expect(
      short('<p><a href="https://e.org/" target="_blank">x</a>' + IMG + "</p>")
    ).toBe("<p><a>x</a><img /></p>");
  });

  test("pasteOwn carries the editor's own data in the field's namespace", async () => {
    await mount("<p>Zw</p>");
    await at("Zw")();
    const editor = editorOf()!;
    const pasted: Array<Record<string, string>> = [];
    const onPaste = (event: ClipboardEvent) => {
      const data: Record<string, string> = {};
      for (const format of event.clipboardData?.types ?? []) {
        data[format] = event.clipboardData!.getData(format);
      }
      pasted.push(data);
    };
    document.addEventListener("paste", onPaste, { capture: true });
    let inserted = 0;
    const unregister = editor.registerCommand(
      SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
      () => {
        inserted += 1;
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
    try {
      // a copy of one whole paragraph carries its text only (Lexical's
      // copy); two paragraphs carry a paragraph node
      await pasteOwn("<p>Aq</p><p>Bq</p>")();
    } finally {
      document.removeEventListener("paste", onPaste, { capture: true });
      unregister();
    }
    await selectAll();
    await copy();
    const own = JSON.parse(clipboard()["application/x-lexical-editor"]) as {
      namespace: string;
    };
    expect(pasted).toHaveLength(1);
    const payload = JSON.parse(pasted[0]["application/x-lexical-editor"]) as {
      namespace: string;
      nodes: Array<{ type: string }>;
    };
    expect(payload.namespace).toBe(own.namespace);
    expect(payload.nodes.some((node) => node.type === "paragraph")).toBe(true);
    expect(inserted).toBe(1);
  });

  test("two fields mount side by side", async () => {
    const first = await renderField("<p>Aw</p>");
    const extra = await mountExtraField("<p>Bw</p>");
    await at("Bw", 1, undefined, { in: extra.element })();
    await letter();
    expect(plain(lastHtml(extra.onChange))).toBe("<p>Bkw</p>");
    expect(first).not.toHaveBeenCalled();
  });

  test("clickItemCorner reaches the point after a rule", async () => {
    await mount(LI("T0w<hr>"));
    await then(at("Pw"), clickItemCorner(1))();
    expect(caretKey()).toBe("element:listitem@2");
  });

  test("blockType hands the keys back to the editor", async () => {
    const onChange = await mount("<p>Aw</p><p>Bw</p>");
    await at("Aw", 1)();
    await blockType("Heading 2")();
    expect(document.activeElement).toBe(editable());
    expect(caretKey()).toBe("text:Aw@1");
    await keys("{Control>}z{/Control}")();
    expect(plain(lastHtml(onChange))).toBe("<p>Aw</p><p>Bw</p>");
    const record = await recordEdit(
      {
        stored: "<p>Aw</p>",
        place: at("Aw", 1),
        action: blockType("Heading 2"),
      },
      { typeAfter: true }
    );
    expect(record.write).toBe("<h2>Aw</h2>");
    expect(record.typed).toBe("<h2>Akw</h2>");
    expect(record.undoRestores).toBe(true);
    expect(record.redoEquals).toBe(true);
  });

  test("the short form records no undo", async () => {
    const record = await recordEdit(
      { stored: "<p>Aw</p>", place: at("Aw", 1), action: letter },
      { short: true }
    );
    expect(record.write).toBe("<p>Akw</p>");
    expect(record.typed).toBe("<p>Akkw</p>");
    expect(record.undoRestores).toBeUndefined();
  });

  test("lineBack reaches DELETE_LINE_COMMAND", async () => {
    await mount("<p>Aw Bw</p>");
    const payloads: boolean[] = [];
    const unregister = editorOf()!.registerCommand(
      DELETE_LINE_COMMAND,
      (payload) => {
        payloads.push(payload);
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
    await at("Aw Bw")();
    await lineBack();
    unregister();
    expect(payloads).toEqual([true]);
  });

  test("itemPoint by structure (T8)", async () => {
    const html = LI("T0w<br><blockquote><p>Q2w</p></blockquote>");
    headless(html)
      .getEditorState()
      .read(() => {
        expect($wherePoint($middleItem(), { before: 0 })).toEqual(
          $wherePoint($middleItem(), 2)
        );
      });
    await mount(html);
    await itemPoint(1, { before: 0 })();
    const byStructure = caretKey();
    await itemPoint(1, 2)();
    expect(caretKey()).toBe(byStructure);
  });

  test("the range oracle reads what a range holds, ends in document order", async () => {
    await mount("<p>A0w</p><hr><p>B2w</p>");
    await range("B2w", 1, "A0w", 1)();
    const held = editorOf()!
      .getEditorState()
      .read(() => $rangeOracle($getSelection() as RangeSelection));
    expect(held).toEqual({
      text: "0wB",
      images: 0,
      rules: 1,
      breaks: 0,
      order: "backward",
    });
  });

  test("twinOf puts a word in place of the edge child", () => {
    expect(
      twinOf("<blockquote><p>Q0w" + IMG + "</p></blockquote>", "img")
    ).toBe("<blockquote><p>Q0wEw</p></blockquote>");
  });

  test("twinOf names the edge child by its occurrence", () => {
    const stored = LI("T0w<br><blockquote><p>Q2w</p></blockquote>T3w<br>");
    expect(twinOf(stored, "br", 0)).toBe(
      LI("T0wEw<blockquote><p>Q2w</p></blockquote>T3w<br>")
    );
    expect(twinOf(stored, "br", 1)).toBe(
      LI("T0w<br><blockquote><p>Q2w</p></blockquote>T3wEw")
    );
    expect(() => twinOf(stored, "br")).toThrow(stored);
  });

  test("quiet waits past 30 ms", async () => {
    await mount("<p>Aw</p>");
    await at("Aw")();
    await letter();
    expect(await quiet()).toBeGreaterThan(30);
  });

  test("forceOrder delivers the page's step first", async () => {
    await mount("<p>Abcw</p>");
    await at("Abcw", 1)();
    const seen: string[] = [];
    const editor = editorOf()!;
    const unregister = [
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          seen.push("selectionchange");
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      ),
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        () => {
          seen.push("keydown");
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      ),
    ];
    await forceOrder("selectionchange-first", keys("{ArrowRight}"))();
    unregister.forEach((remove) => remove());
    expect(seen.indexOf("selectionchange")).toBeGreaterThanOrEqual(0);
    expect(seen.indexOf("selectionchange")).toBeLessThan(
      seen.indexOf("keydown")
    );
  });

  test("forceOrder orders a pointer event", async () => {
    await mount("<p>Abcw</p>");
    await at("Abcw", 1)();
    const text = editable()!.querySelector("[data-lexical-text]")!;
    const orderOf = async (
      order: "selectionchange-first" | "key-first",
      on: "pointerdown" | "pointerup",
      step: () => Promise<void>
    ) => {
      const seen: string[] = [];
      const onSelection = () => seen.push("selectionchange");
      const onPointer = () => seen.push(on);
      document.addEventListener("selectionchange", onSelection);
      document.addEventListener(on, onPointer);
      try {
        await forceOrder(order, step, on)();
      } finally {
        document.removeEventListener("selectionchange", onSelection);
        document.removeEventListener(on, onPointer);
      }
      expect(
        seen.indexOf(on),
        `${order} ${on}: ${seen}`
      ).toBeGreaterThanOrEqual(0);
      expect(
        seen.indexOf("selectionchange"),
        `${order} ${on}: ${seen}`
      ).toBeGreaterThanOrEqual(0);
      return seen.indexOf("selectionchange") < seen.indexOf(on)
        ? "selectionchange-first"
        : "key-first";
    };
    expect(
      await orderOf("selectionchange-first", "pointerup", hold(text, 50))
    ).toBe("selectionchange-first");
    expect(await orderOf("key-first", "pointerup", hold(text, 50))).toBe(
      "key-first"
    );
    expect(
      await orderOf("selectionchange-first", "pointerdown", shiftPress(text))
    ).toBe("selectionchange-first");
    expect(await orderOf("key-first", "pointerdown", shiftPress(text))).toBe(
      "key-first"
    );
  });

  test("hold keeps the pointer down", async () => {
    await mount("<p>Aw</p>");
    const times: Record<string, number> = {};
    const onDown = () => {
      times.down = performance.now();
    };
    const onUp = () => {
      times.up = performance.now();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);
    try {
      await hold(editable()!, 200)();
    } finally {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
    }
    expect(times.down).toBeDefined();
    expect(times.up - times.down).toBeGreaterThanOrEqual(190);
  });

  test("expectEdit fails a write it was not given", async () => {
    await expect(
      expectEdit({
        stored: "<p>Aw</p>",
        place: at("Aw"),
        action: letter,
        write: "<p>Aw</p>",
      })
    ).rejects.toThrow();
  });

  test("the unchanged-value check reads the value after place", async () => {
    const record = await recordEdit({
      stored: "<p>Aw</p><p>Bw</p>",
      place: then(at("Bw"), selectAll, backspace),
      action: letter,
    });
    expect(record.htmlBefore).toBe("<p></p>");
    expect(record.write).toBe("<p>k</p>");
  });

  test("imageButton waits for the upload and the insert", async () => {
    setUpload(async () => {
      await wait(40);
      return { url: "https://cdn.example.org/x.png", path: "org/x.png" };
    });
    const onChange = await mount("<p>Aw</p>");
    await at("Aw")();
    await imageButton();
    expect(lastHtml(onChange).split("<img").length - 1).toBe(1);
  });

  test("imageButton returns when the insert writes nothing", async () => {
    setUpload(async () => {
      await wait(40);
      return { url: "https://cdn.example.org/x.png", path: "org/x.png" };
    });
    const onChange = await mount("<p>Aw</p>");
    await at("Aw")();
    // the insert commits, and a transform takes its image out again
    const editor = editorOf()!;
    const image = richTextNodes.find(
      (klass) => klass.getType() === "cms-image"
    )!;
    let commits = 0;
    const unregister = [
      editor.registerNodeTransform(image, (node) => {
        node.remove();
      }),
      editor.registerUpdateListener(({ dirtyElements }) => {
        if (dirtyElements.size > 0) {
          commits += 1;
        }
      }),
    ];
    onChange.mockClear();
    const start = performance.now();
    try {
      await imageButton();
    } finally {
      unregister.forEach((remove) => remove());
    }
    expect(performance.now() - start).toBeLessThan(1000);
    expect(commits).toBeGreaterThan(0);
    // the first value after mount is handed out even where it equals the
    // stored one (T42.1): the value as it stood
    expect(lastHtml(onChange)).not.toContain("<img");
    expect(plain(lastHtml(onChange))).toBe("<p>Aw</p>");
  });
});

test("htmlLines: a block that holds no block, an inline run and <br> (T65)", () => {
  expect(
    htmlLines("<p></p><ul><li><blockquote><p>bbq</p></blockquote></li></ul>")
  ).toEqual(["", "bbq"]);
  expect(htmlLines("<blockquote><p></p></blockquote><br>")).toEqual([
    "",
    "",
    "",
  ]);
  expect(
    htmlLines("<ul><li>T0w<blockquote><p>Q1w</p></blockquote></li></ul>")
  ).toEqual(["T0w", "Q1w"]);
  expect(htmlLines("<p>A0w</p><hr><p>B<br>w</p>")).toEqual([
    "A0w",
    "",
    "B",
    "w",
  ]);
  expect(htmlLines("<span>Aw</span>")).toEqual(["Aw"]);
});

describe("the net (kit-branch)", () => {
  const $firstText = () =>
    $getRoot()
      .getFirstChildOrThrow<ElementNode>()
      .getFirstChildOrThrow<TextNode>();

  test("the net fails a test whose last onChange is not the editor's export", async () => {
    const onChange = await mount("<p>Aw</p>");
    await at("Aw")();
    await letter();
    const last = lastHtml(onChange);
    expect(plain(last)).toBe("<p>Awk</p>");
    const editor = editorOf()!;
    await act(async () => {
      editor.update(() => $firstText().setTextContent("Awkx"), {
        tag: "history-merge",
      });
    });
    await settle();
    const failures = net();
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(JSON.stringify(last));
  });

  test("the net passes a test with no onChange whose state is the mounted one", async () => {
    const onChange = await mount("<p>Aw</p>");
    await at("Aw", 1)();
    expect(onChange).not.toHaveBeenCalled();
    expect(net()).toEqual([]);
  });

  test("the net fails on a composition-start character a composition left", async () => {
    // the field removes the character a composition left (Task 20): its
    // removal is held from the test's side
    forcedFailure("start-char-kept");
    await mount("<p>Aw</p>");
    await at("Aw", 1)();
    const editor = editorOf()!;
    const target = editable()!;
    await act(async () => {
      target.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true, data: "" })
      );
    });
    await settle();
    expect(editor.isComposing()).toBe(true);
    await act(async () => {
      editor.update(() => $firstText().setTextContent("A\u200Bw"), {
        tag: "history-merge",
      });
    });
    await settle();
    await act(async () => {
      target.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true, data: "" })
      );
    });
    await settle();
    expect(editor.isComposing()).toBe(false);
    const failures = net();
    expect(
      failures.filter((failure) => failure.includes("composition-start"))
    ).toHaveLength(1);
    // the field hands out no value that holds the character (16.21), and
    // the composition's start, which left the document as it was, handed
    // out nothing (T67.2): nothing handed out, while the document changed
    expect(
      failures.filter(
        (failure) => failure.includes("composition-start") === false
      )
    ).toEqual([
      expect.stringContaining(
        "no onChange, but the document changed since mount"
      ),
    ]);
  });

  test("the net does not flag a U+200B an edit brings", async () => {
    const onChange = await mount("<p>Aw</p>");
    await at("Aw")();
    await pasteText("a\u200Bb")();
    expect(lastHtml(onChange)).toContain("\u200B");
    expect(net()).toEqual([]);
  });
});
