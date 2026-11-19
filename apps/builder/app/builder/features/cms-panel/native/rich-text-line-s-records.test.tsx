// SPIKE: the hazard map's S records and the element points of Q1, by real
// input, written as JSON lines so a run with VITE_LINES_OFF (the head's
// behaviour) and one without can be compared record by record.
import { describe, test, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  type LexicalNode,
} from "lexical";
import { $isListItemNode } from "@lexical/list";
import { $isQuoteNode } from "@lexical/rich-text";
import {
  byLabel,
  click,
  clickInWord,
  editable,
  editorOf,
  lastHtml,
  mountAt,
  paste,
  renderField,
  settle,
  undo,
} from "./rich-text-test-harness";
import {
  clearRichTextReadOnlyMemo,
  getRichTextReadOnlyReason,
} from "./rich-text-html";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";

type Step = () => Promise<void>;
type Place = Step | [string, number, string, number];
type Rec = [id: string, html: string, place: Place, action: Step];

const keys = (k: string): Step => async () => {
  await userEvent.keyboard(k);
  await settle();
};
const at = (word: string, offset?: number): Step => () =>
  clickInWord(word, offset);
const pasteHtml = (html: string, text = "Aq"): Step => async () => {
  paste({ "text/html": html, "text/plain": text });
  await settle();
};
const pasteText = (text: string): Step => async () => {
  paste({ "text/plain": text });
  await settle();
};
const blockType = (name: string): Step => async () => {
  await click(byLabel("Block type"));
  await click(
    [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (option) => option.textContent === name
    )
  );
};

/** A click at the end of `word`, then ArrowRight until a node is selected. */
const nodeSelectAfter = (word: string): Step => async () => {
  await clickInWord(word);
  for (let press = 0; press < 3; press += 1) {
    await userEvent.keyboard("{ArrowRight}");
    await settle();
    const isNode = editorOf()!
      .getEditorState()
      .read(() => $isNodeSelection($getSelection()));
    if (isNode) {
      return;
    }
  }
};

/** An element point on the `nth` list item or quote holding `word`. */
const elementPoint = (word: string, offset: number): Step => async () => {
  await clickInWord(word);
  await act(async () => {
    editorOf()!.update(() => {
      const text = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent() === word)!;
      let container: LexicalNode | null = text;
      while (
        container !== null &&
        $isListItemNode(container) === false &&
        $isQuoteNode(container) === false
      ) {
        container = container.getParent();
      }
      const selection = $createRangeSelection();
      selection.anchor.set(container!.getKey(), offset, "element");
      selection.focus.set(container!.getKey(), offset, "element");
      $setSelection(selection);
    });
  });
  await settle();
};

let clip: DataTransfer | undefined;
const clipboardEvent = async (type: "copy" | "cut") => {
  clip = new DataTransfer();
  await act(async () => {
    editable()!.dispatchEvent(
      new ClipboardEvent(type, {
        bubbles: true,
        cancelable: true,
        clipboardData: clip,
      })
    );
  });
  await settle();
};
const pasteClip: Step = async () => {
  const data: Record<string, string> = {};
  for (const format of clip!.types) {
    data[format] = clip!.getData(format);
  }
  paste(data);
  await settle();
};

const TRT = "<ul><li>Pw</li><li>T0w<hr>T2w</li><li>Nw</li></ul>";
const TR = "<ul><li>Pw</li><li>T0w<hr></li><li>Nw</li></ul>";
const XRY = "<ul><li>xq<hr>yq</li></ul>";
const XQY = "<ul><li>xq<blockquote><p>qq</p></blockquote>yq</li><li>nq</li></ul>";

const RECORDS: Rec[] = [
  ["KS0 Aw@0 Enter", "<ul><li>Aw</li><li>Bw</li></ul>", at("Aw", 0), keys("{Enter}")],
  ["KS0 Bw@0 Enter", "<ul><li>Aw</li><li>Bw</li></ul>", at("Bw", 0), keys("{Enter}")],
  ["KS0 ol Bw@0 Enter", "<ol><li>Aw</li><li>Bw</li></ol>", at("Bw", 0), keys("{Enter}")],
  ["KS0 quote list X1w@0 Enter", "<blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote>", at("X1w", 0), keys("{Enter}")],
  ["KS0 d2 Aw@0 Enter", "<ul><li>Zw<ul><li>Aw</li><li>Bw</li></ul></li></ul>", at("Aw", 0), keys("{Enter}")],
  ["KS0 after mixed Nw@0 Enter", "<ul><li>Pw</li><li><blockquote>Q0w</blockquote>T1w</li><li>Nw</li></ul>", at("Nw", 0), keys("{Enter}")],
  ["KS0 triple-click Enter", "<ul><li>Aw</li><li>Bw</li></ul>", async () => {
    await clickInWord("Aw", 1);
    await userEvent.tripleClick(editable()!.querySelector("li")!);
    await settle();
  }, keys("{Enter}")],
  ["KS1 TRT Ctrl+Backspace", TRT, at("T2w", 0), keys("{Control>}{Backspace}{/Control}")],
  ["KS1 QRT Ctrl+Backspace", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr>T2w</li><li>Nw</li></ul>", at("T2w", 0), keys("{Control>}{Backspace}{/Control}")],
  ["KS2 BRT Backspace", "<ul><li>Pw</li><li><br><hr>T2w</li><li>Nw</li></ul>", at("T2w", 0), keys("{Backspace}")],
  ["KS2 TRT Backspace", TRT, at("T2w", 0), keys("{Backspace}")],
  ["KS2 TRT Delete", TRT, at("T0w"), keys("{Delete}")],
  ["KS3 TR Nw@0 Backspace", TR, at("Nw", 0), keys("{Backspace}")],
  ["KS3 TQR Nw@0 Backspace", "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr></li><li>Nw</li></ul>", at("Nw", 0), keys("{Backspace}")],
  ["KS3 ol TR Nw@0 Backspace", "<ol><li>Pw</li><li>T0w<hr></li><li>Nw</li></ol>", at("Nw", 0), keys("{Backspace}")],
  ["KS3 range Pw@1-T0w@2 Backspace", TR, ["Pw", 1, "T0w", 2], keys("{Backspace}")],
  ["KS4 d2 RT T1w@0 Backspace", "<ul><li>Aw<ul><li>Pw</li><li><hr>T1w</li><li>Nw</li></ul></li><li>Zw</li></ul>", at("T1w", 0), keys("{Backspace}")],
  ["KS4 d2 TRT T2w@0 Backspace", "<ul><li>Aw<ul><li>Pw</li><li>T0w<hr>T2w</li><li>Nw</li></ul></li><li>Zw</li></ul>", at("T2w", 0), keys("{Backspace}")],
  ["KS4 d2 ordinary Nw@0 Backspace", "<ul><li>Aw<ul><li>Pw</li><li>Nw</li></ul></li></ul>", at("Nw", 0), keys("{Backspace}")],
  ["KS5 TR whole Enter", TR, ["T0w", 0, "T0w", 3], keys("{Enter}")],
  ["KS5 TQR whole Enter", "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr></li><li>Nw</li></ul>", ["T0w", 0, "Q1w", 3], keys("{Enter}")],
  ...["<hr>", "<hr><p>Aq</p>", "<blockquote><p>Aq</p></blockquote>", "<ul><li>Aq</li><li>Bq</li></ul>", "<p>Aq</p><p>Bq</p>", "<h2>Aq</h2>", "<pre><code>Aq</code></pre>"].map(
    (html): Rec => [`FS0 rule node-selected paste ${html}`, XRY, nodeSelectAfter("xq"), pasteHtml(html)]
  ),
  ["FS0 d1 between items paste <p>Aq</p><p>Bq</p>", "<ul><li>Pw</li><li>xq<hr>yq</li><li>Nw</li></ul>", nodeSelectAfter("xq"), pasteHtml("<p>Aq</p><p>Bq</p>")],
  ["FS0 root reference paste <hr>", "<p>xq</p><hr><p>yq</p>", nodeSelectAfter("xq"), pasteHtml("<hr>")],
  ["FS0 rule node-selected plain paste", XRY, nodeSelectAfter("xq"), pasteText("Aq")],
  ["FS0 rule node-selected letter", XRY, nodeSelectAfter("xq"), keys("k")],
  ["FS0 rule node-selected Enter", XRY, nodeSelectAfter("xq"), keys("{Enter}")],
  ["CS1 list at xq@1", XQY, at("xq", 1), pasteHtml("<ul><li>Aq</li><li>Bq</li></ul>")],
  ["CS1 list at xq end", XQY, at("xq"), pasteHtml("<ul><li>Aq</li><li>Bq</li></ul>")],
  ["CS1 list at yq end", XQY, at("yq"), pasteHtml("<ul><li>Aq</li><li>Bq</li></ul>")],
  ["CS1 list in TR at xq end", XRY, at("xq"), pasteHtml("<ul><li>Aq</li><li>Bq</li></ul>")],
  ["CS2 one paragraph at xxq@1", "<ul><li>xxq<blockquote><p>qq</p></blockquote>yyq</li><li>nq</li></ul><p>sepq</p>", at("xxq", 1), pasteHtml("<p>Aq</p>")],
  ["CS2 one paragraph at yq@0", XQY, at("yq", 0), pasteHtml("<p>Aq</p>")],
  ["CS3 two paragraphs d1 nested", "<ul><li>a1q<ul><li>xqyq</li></ul></li></ul>", at("xqyq", 2), pasteHtml("<p>Aq</p><p>Bq</p>")],
  ["CS3 two paragraphs at n1q end", "<ul><li>a1q<ul><li>n1q</li><li>n2q</li></ul></li><li>t1q</li></ul>", at("n1q"), pasteHtml("<p>Aq</p><p>Bq</p>")],
  ["CS3 list then paragraph d1 nested", "<ul><li>a1q<ul><li>xqyq</li></ul></li></ul>", at("xqyq", 2), pasteHtml("<ul><li>Aq</li></ul><p>Bq</p>")],
  ["FS2 d2 flat two paragraphs", "<ul><li>Zw<ul><li>xqyq</li></ul></li></ul>", at("xqyq", 2), pasteHtml("<p>Aq</p><p>Bq</p>")],
  ["CS4 code at yq@0", XQY, at("yq", 0), pasteHtml("<pre><code>Aq</code></pre>")],
  ["CS5 range hq@0-yyq@1 paragraph", "<ul><li>xq<h3>hq</h3>yyq</li><li>nq</li></ul><p>sepq</p>", ["hq", 0, "yyq", 1], pasteHtml("<p>Aq</p>")],
  ["CS6 rule cut then paste", XRY, nodeSelectAfter("xq"), async () => {
    await clipboardEvent("cut");
    await pasteClip();
  }],
  ["TS0 item@2 after rule Heading 2", TR, elementPoint("T0w", 2), blockType("Heading 2")],
  ["TS0 item@2 after rule Quote", TR, elementPoint("T0w", 2), blockType("Quote")],
  ["TS2/FS7 range Pw@1-T0w@2 letter", TR, ["Pw", 1, "T0w", 2], keys("k")],
  ["FS7 range Pw@0-T1w@1 letter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<hr></li><li>Nw</li></ul>", ["Pw", 0, "T1w", 1], keys("a")],
  ["FS4 range Pw@1-X0w@2 Quote", "<p>Pw</p><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>", ["Pw", 1, "X0w", 2], blockType("Quote")],
  ["FS4 Ctrl+A Quote", "<p>Pw</p><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>", async () => {
    await clickInWord("Pw");
    await userEvent.keyboard("{Control>}a{/Control}");
    await settle();
  }, blockType("Quote")],
  ["FS5 quote paste at xq end", "<blockquote>xq<ul><li>l1q</li></ul>yq</blockquote>", at("xq"), pasteHtml("<blockquote><p>Aq</p></blockquote>")],
  ["FS5 rule paste at xq end", "<blockquote>xq<ul><li>l1q</li></ul>yq</blockquote>", at("xq"), pasteHtml("<hr>")],
  ["FS5 list paste at xq end", "<blockquote>xq<ul><li>l1q</li></ul>yq</blockquote>", at("xq"), pasteHtml("<ul><li>Aq</li><li>Bq</li></ul>")],
  ["C14 copy mixed item into ordinary item", XQY, ["xq", 0, "yq", 2], async () => {
    await clipboardEvent("copy");
    await clickInWord("nq");
    await pasteClip();
  }],
  ["FS6 copy block-only item, paste at root end", "<ul><li>Aw</li><li><blockquote><p>bbq</p></blockquote></li></ul><p>sq</p>", ["Aw", 2, "bbq", 3], async () => {
    await clipboardEvent("copy");
    await clickInWord("sq");
    await pasteClip();
  }],
];

// Q1: Enter and Block type at every element point of these item shapes.
const Q1_SHAPES: Array<[string, string, string, number]> = [
  ["TR", "<ul><li>Pw</li><li>T0w<hr></li><li>Nw</li></ul>", "Pw", 2],
  ["RT", "<ul><li>Pw</li><li><hr>T1w</li><li>Nw</li></ul>", "Pw", 2],
  ["QR", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr></li><li>Nw</li></ul>", "Pw", 2],
  ["RQ", "<ul><li>Pw</li><li><hr><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>", "Pw", 2],
  ["TRT", TRT, "Pw", 3],
  ["QRQ", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>", "Pw", 3],
  ["RR", "<ul><li>Pw</li><li><hr><hr></li><li>Nw</li></ul>", "Pw", 2],
];
for (const [name, html, , size] of Q1_SHAPES) {
  for (let offset = 0; offset <= size; offset += 1) {
    const place: Step = async () => {
      await clickInWord("Pw");
      await act(async () => {
        editorOf()!.update(() => {
          const items = $getRoot()
            .getFirstChildOrThrow<import("lexical").ElementNode>()
            .getChildren();
          const item = items[1];
          if ($isElementNode(item) === false) return;
          // lines count as children: find the element point before the
          // stored child at `offset`
          const selection = $createRangeSelection();
          const index = Math.min(offset, item.getChildrenSize());
          selection.anchor.set(item.getKey(), index, "element");
          selection.focus.set(item.getKey(), index, "element");
          $setSelection(selection);
        });
      });
      await settle();
    };
    RECORDS.push([`Q1 ${name} item@${offset} Enter`, html, place, keys("{Enter}")]);
    RECORDS.push([`Q1 ${name} item@${offset} Heading 2`, html, place, blockType("Heading 2")]);
    RECORDS.push([`Q1 ${name} item@${offset} letter`, html, place, keys("k")]);
  }
}

const caretOf = () =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      if ($isNodeSelection(selection)) return "node";
      if ($isRangeSelection(selection) === false) return "none";
      const describe = (point: typeof selection.anchor) => {
        const node = point.getNode();
        return point.type === "text"
          ? `${node.getTextContent()}@${point.offset}`
          : `${node.getType()}@${point.offset}`;
      };
      return `${describe(selection.anchor)}|${describe(selection.focus)}`;
    });

const stateOf = () =>
  JSON.stringify(editorOf()!.getEditorState().toJSON().root);

describe("S records", () => {
  for (const [id, html, place, action] of RECORDS) {
    test(id, async () => {
      clearRichTextReadOnlyMemo();
      const stored = sanitizeRichTextHtml(html);
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args) => {
        const text = String(args[0]);
        if (text.startsWith("Warning: An update") === false) {
          errors.push(text.slice(0, 200));
        }
      });
      let onChange;
      if (Array.isArray(place)) {
        onChange = await mountAt(stored, place[0], place[1], place[2], place[3]);
      } else {
        onChange = await renderField(stored);
        await place();
      }
      const mountCalls = onChange.mock.calls.length;
      onChange.mockClear();
      const t0 = performance.now();
      let thrown = "";
      try {
        await action();
      } catch (error) {
        thrown = String(error).slice(0, 200);
      }
      const ms = Math.round(performance.now() - t0);
      const calls = onChange.mock.calls.length;
      const after = calls > 0 ? sanitizeRichTextHtml(lastHtml(onChange)) : stored;
      const caret = caretOf();
      const written = stateOf();
      clearRichTextReadOnlyMemo();
      const reopens = after === "" || getRichTextReadOnlyReason(after) === undefined;
      // undo, then redo, from the editor itself (Block type leaves the focus
      // outside the field)
      editable()!.focus();
      await undo();
      const undone = sanitizeRichTextHtml(lastHtml(onChange));
      await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
      await settle();
      const redoState = stateOf() === written;
      console.log(
        `REC ${JSON.stringify({
          id,
          ms,
          thrown,
          errors,
          mountCalls,
          calls,
          after,
          caret,
          reopens,
          undoRestores: calls === 0 || undone === stored,
          redoState,
          clipHtml: clip?.getData("text/html"),
          clipHasLine: (clip?.getData("application/x-lexical-editor") ?? "").includes("cms-line"),
        })}`
      );
      clip = undefined;
    }, 30_000);
  }
});
