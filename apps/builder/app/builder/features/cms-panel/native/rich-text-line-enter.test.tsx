// SPIKE: Enter and Shift+Enter beside a non-text child (an image, a link, a
// line break) at a block's end or start, and Enter in a heading's middle
// (prototype round 14): each write pinned, each equal to its twin, the same
// child replaced by a word; and a heading's plain text, where the field's
// heading rule leaves Enter to Lexical.
import { describe, expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import { $createRangeSelection, $getRoot, $isElementNode, $isTextNode, $setSelection, type LexicalNode } from "lexical";
import { click, clickInWord, editable, editorOf, lastHtml, renderField, settle } from "./rich-text-test-harness";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
const IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;
const LINK = `<a href="https://example.org/l">Lw</a>`;
const CHILD: Record<string, string> = { image: IMG, link: LINK, br: "<br>" };
const all = (): LexicalNode[] => { const out: LexicalNode[] = []; const walk = (n: LexicalNode) => { out.push(n); if ($isElementNode(n)) n.getChildren().forEach(walk); }; walk($getRoot()); return out; };
const TYPE: Record<string, string> = { image: "cms-image", link: "link", br: "linebreak" };
const place = (child: string, atEnd: boolean, twin: boolean) => editorOf()!.update(() => {
  const r = $createRangeSelection();
  const set = (key: string, offset: number, type: "text" | "element") => { r.anchor.set(key, offset, type); r.focus.set(key, offset, type); };
  if (twin) {
    const t = all().find((n) => $isTextNode(n) && n.getTextContent().includes("Zw"))!;
    const i = t.getTextContent().indexOf("Zw");
    set(t.getKey(), atEnd ? i + 2 : i, "text");
  } else {
    const node = all().find((n) => n.getType() === TYPE[child])!;
    set(node.getParentOrThrow().getKey(), node.getIndexWithinParent() + (atEnd ? 1 : 0), "element");
  }
  $setSelection(r);
});
const LI = (x: string) => `<ul><li>Pw</li><li>${x}</li><li>Nw</li></ul>`;
const shape = (ctx: string, block: string, x: string) => {
  if (block === "heading-middle") {
    return ctx === "ordinary" ? `<p>T0w</p><h3>${x}</h3><p>T1w</p>` : LI(`${ctx === "lineLed" ? "T9w" : ""}<h3>${x}</h3>T1w`);
  }
  if (ctx === "ordinary") {
    const b = block === "heading" ? `<h3>${x}</h3>` : block === "quote" ? `<blockquote><p>${x}</p></blockquote>` : `<p>${x}</p>`;
    return `<p>T0w</p>${b}<p>T1w</p>`;
  }
  if (block === "line") {
    return LI(`${ctx === "lineLed" ? "T9w" : ""}<blockquote><p>Q0w</p></blockquote>${x}<blockquote><p>B1w</p></blockquote>`);
  }
  const b = block === "heading" ? `<h3>${x}</h3>` : `<blockquote><p>${x}</p></blockquote>`;
  return LI(`${ctx === "lineLed" ? "T9w" : ""}${b}T1w`);
};
const EDGE_WRITES: [string, string][] = [
  ["br end blockLed heading enter", "<ul><li>Pw</li><li><h3>X0w<br /></h3>k<br />T1w</li><li>Nw</li></ul>"],
  ["br end blockLed heading shiftEnter", "<ul><li>Pw</li><li><h3>X0w<br /><br />k</h3>T1w</li><li>Nw</li></ul>"],
  ["br end blockLed line enter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X0w<br /></li><li><blockquote><p>kB1w</p></blockquote></li><li>Nw</li></ul>"],
  ["br end blockLed line shiftEnter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X0w<br /><br />k<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["br end blockLed quote enter", "<ul><li>Pw</li><li><blockquote><p>X0w<br /></p><p>k</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["br end blockLed quote shiftEnter", "<ul><li>Pw</li><li><blockquote><p>X0w<br /><br />k</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["br end lineLed heading enter", "<ul><li>Pw</li><li>T9w<h3>X0w<br /></h3>k<br />T1w</li><li>Nw</li></ul>"],
  ["br end lineLed heading shiftEnter", "<ul><li>Pw</li><li>T9w<h3>X0w<br /><br />k</h3>T1w</li><li>Nw</li></ul>"],
  ["br end lineLed line enter", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X0w<br /></li><li><blockquote><p>kB1w</p></blockquote></li><li>Nw</li></ul>"],
  ["br end lineLed line shiftEnter", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X0w<br /><br />k<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["br end lineLed quote enter", "<ul><li>Pw</li><li>T9w<blockquote><p>X0w<br /></p><p>k</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["br end lineLed quote shiftEnter", "<ul><li>Pw</li><li>T9w<blockquote><p>X0w<br /><br />k</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["br end ordinary heading enter", "<p>T0w</p><h3>X0w<br /></h3><p>k</p><p>T1w</p>"],
  ["br end ordinary heading shiftEnter", "<p>T0w</p><h3>X0w<br /><br />k</h3><p>T1w</p>"],
  ["br end ordinary line enter", "<p>T0w</p><p>X0w<br /></p><p>k</p><p>T1w</p>"],
  ["br end ordinary line shiftEnter", "<p>T0w</p><p>X0w<br /><br />k</p><p>T1w</p>"],
  ["br end ordinary quote enter", "<p>T0w</p><blockquote><p>X0w<br /></p><p>k</p></blockquote><p>T1w</p>"],
  ["br end ordinary quote shiftEnter", "<p>T0w</p><blockquote><p>X0w<br /><br />k</p></blockquote><p>T1w</p>"],
  ["br start blockLed heading enter", "<ul><li>Pw</li><li><br /><h3>k<br />X0w</h3>T1w</li><li>Nw</li></ul>"],
  ["br start blockLed heading shiftEnter", "<ul><li>Pw</li><li><h3><br />k<br />X0w</h3>T1w</li><li>Nw</li></ul>"],
  ["br start blockLed line enter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li><li>k<br />X0w<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["br start blockLed line shiftEnter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br />k<br />X0w<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["br start blockLed quote enter", "<ul><li>Pw</li><li><blockquote><p></p><p>k<br />X0w</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["br start blockLed quote shiftEnter", "<ul><li>Pw</li><li><blockquote><p><br />k<br />X0w</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["br start lineLed heading enter", "<ul><li>Pw</li><li>T9w<br /><br /><h3>k<br />X0w</h3>T1w</li><li>Nw</li></ul>"],
  ["br start lineLed heading shiftEnter", "<ul><li>Pw</li><li>T9w<h3><br />k<br />X0w</h3>T1w</li><li>Nw</li></ul>"],
  ["br start lineLed line enter", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote></li><li>k<br />X0w<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["br start lineLed line shiftEnter", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote><br />k<br />X0w<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["br start lineLed quote enter", "<ul><li>Pw</li><li>T9w<blockquote><p></p><p>k<br />X0w</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["br start lineLed quote shiftEnter", "<ul><li>Pw</li><li>T9w<blockquote><p><br />k<br />X0w</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["br start ordinary heading enter", "<p>T0w</p><p></p><h3>k<br />X0w</h3><p>T1w</p>"],
  ["br start ordinary heading shiftEnter", "<p>T0w</p><h3><br />k<br />X0w</h3><p>T1w</p>"],
  ["br start ordinary line enter", "<p>T0w</p><p></p><p>k<br />X0w</p><p>T1w</p>"],
  ["br start ordinary line shiftEnter", "<p>T0w</p><p><br />k<br />X0w</p><p>T1w</p>"],
  ["br start ordinary quote enter", "<p>T0w</p><blockquote><p></p><p>k<br />X0w</p></blockquote><p>T1w</p>"],
  ["br start ordinary quote shiftEnter", "<p>T0w</p><blockquote><p><br />k<br />X0w</p></blockquote><p>T1w</p>"],
  ["image end blockLed heading enter", "<ul><li>Pw</li><li><h3>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></h3>k<br />T1w</li><li>Nw</li></ul>"],
  ["image end blockLed heading shiftEnter", "<ul><li>Pw</li><li><h3>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />k</h3>T1w</li><li>Nw</li></ul>"],
  ["image end blockLed line enter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></li><li><blockquote><p>kB1w</p></blockquote></li><li>Nw</li></ul>"],
  ["image end blockLed line shiftEnter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />k<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["image end blockLed quote enter", "<ul><li>Pw</li><li><blockquote><p>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p><p>k</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["image end blockLed quote shiftEnter", "<ul><li>Pw</li><li><blockquote><p>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />k</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["image end lineLed heading enter", "<ul><li>Pw</li><li>T9w<h3>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></h3>k<br />T1w</li><li>Nw</li></ul>"],
  ["image end lineLed heading shiftEnter", "<ul><li>Pw</li><li>T9w<h3>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />k</h3>T1w</li><li>Nw</li></ul>"],
  ["image end lineLed line enter", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></li><li><blockquote><p>kB1w</p></blockquote></li><li>Nw</li></ul>"],
  ["image end lineLed line shiftEnter", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />k<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["image end lineLed quote enter", "<ul><li>Pw</li><li>T9w<blockquote><p>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p><p>k</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["image end lineLed quote shiftEnter", "<ul><li>Pw</li><li>T9w<blockquote><p>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />k</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["image end ordinary heading enter", "<p>T0w</p><h3>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></h3><p>k</p><p>T1w</p>"],
  ["image end ordinary heading shiftEnter", "<p>T0w</p><h3>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />k</h3><p>T1w</p>"],
  ["image end ordinary line enter", "<p>T0w</p><p>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p><p>k</p><p>T1w</p>"],
  ["image end ordinary line shiftEnter", "<p>T0w</p><p>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />k</p><p>T1w</p>"],
  ["image end ordinary quote enter", "<p>T0w</p><blockquote><p>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p><p>k</p></blockquote><p>T1w</p>"],
  ["image end ordinary quote shiftEnter", "<p>T0w</p><blockquote><p>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />k</p></blockquote><p>T1w</p>"],
  ["image start blockLed heading enter", "<ul><li>Pw</li><li><br /><h3>k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</h3>T1w</li><li>Nw</li></ul>"],
  ["image start blockLed heading shiftEnter", "<ul><li>Pw</li><li><h3><br />k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</h3>T1w</li><li>Nw</li></ul>"],
  ["image start blockLed line enter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li><li>k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["image start blockLed line shiftEnter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br />k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["image start blockLed quote enter", "<ul><li>Pw</li><li><blockquote><p></p><p>k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["image start blockLed quote shiftEnter", "<ul><li>Pw</li><li><blockquote><p><br />k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["image start lineLed heading enter", "<ul><li>Pw</li><li>T9w<br /><br /><h3>k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</h3>T1w</li><li>Nw</li></ul>"],
  ["image start lineLed heading shiftEnter", "<ul><li>Pw</li><li>T9w<h3><br />k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</h3>T1w</li><li>Nw</li></ul>"],
  ["image start lineLed line enter", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote></li><li>k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["image start lineLed line shiftEnter", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote><br />k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["image start lineLed quote enter", "<ul><li>Pw</li><li>T9w<blockquote><p></p><p>k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["image start lineLed quote shiftEnter", "<ul><li>Pw</li><li>T9w<blockquote><p><br />k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["image start ordinary heading enter", "<p>T0w</p><p></p><h3>k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</h3><p>T1w</p>"],
  ["image start ordinary heading shiftEnter", "<p>T0w</p><h3><br />k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</h3><p>T1w</p>"],
  ["image start ordinary line enter", "<p>T0w</p><p></p><p>k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</p><p>T1w</p>"],
  ["image start ordinary line shiftEnter", "<p>T0w</p><p><br />k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</p><p>T1w</p>"],
  ["image start ordinary quote enter", "<p>T0w</p><blockquote><p></p><p>k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</p></blockquote><p>T1w</p>"],
  ["image start ordinary quote shiftEnter", "<p>T0w</p><blockquote><p><br />k<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />X0w</p></blockquote><p>T1w</p>"],
  ["link end blockLed heading enter", "<ul><li>Pw</li><li><h3>X0w<a href=\"https://example.org/l\">Lw</a></h3>k<br />T1w</li><li>Nw</li></ul>"],
  ["link end blockLed heading shiftEnter", "<ul><li>Pw</li><li><h3>X0w<a href=\"https://example.org/l\">Lw</a><br />k</h3>T1w</li><li>Nw</li></ul>"],
  ["link end blockLed line enter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X0w<a href=\"https://example.org/l\">Lw</a></li><li><blockquote><p>kB1w</p></blockquote></li><li>Nw</li></ul>"],
  ["link end blockLed line shiftEnter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X0w<a href=\"https://example.org/l\">Lw</a><br />k<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["link end blockLed quote enter", "<ul><li>Pw</li><li><blockquote><p>X0w<a href=\"https://example.org/l\">Lw</a></p><p>k</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["link end blockLed quote shiftEnter", "<ul><li>Pw</li><li><blockquote><p>X0w<a href=\"https://example.org/l\">Lw</a><br />k</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["link end lineLed heading enter", "<ul><li>Pw</li><li>T9w<h3>X0w<a href=\"https://example.org/l\">Lw</a></h3>k<br />T1w</li><li>Nw</li></ul>"],
  ["link end lineLed heading shiftEnter", "<ul><li>Pw</li><li>T9w<h3>X0w<a href=\"https://example.org/l\">Lw</a><br />k</h3>T1w</li><li>Nw</li></ul>"],
  ["link end lineLed line enter", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X0w<a href=\"https://example.org/l\">Lw</a></li><li><blockquote><p>kB1w</p></blockquote></li><li>Nw</li></ul>"],
  ["link end lineLed line shiftEnter", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X0w<a href=\"https://example.org/l\">Lw</a><br />k<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["link end lineLed quote enter", "<ul><li>Pw</li><li>T9w<blockquote><p>X0w<a href=\"https://example.org/l\">Lw</a></p><p>k</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["link end lineLed quote shiftEnter", "<ul><li>Pw</li><li>T9w<blockquote><p>X0w<a href=\"https://example.org/l\">Lw</a><br />k</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["link end ordinary heading enter", "<p>T0w</p><h3>X0w<a href=\"https://example.org/l\">Lw</a></h3><p>k</p><p>T1w</p>"],
  ["link end ordinary heading shiftEnter", "<p>T0w</p><h3>X0w<a href=\"https://example.org/l\">Lw</a><br />k</h3><p>T1w</p>"],
  ["link end ordinary line enter", "<p>T0w</p><p>X0w<a href=\"https://example.org/l\">Lw</a></p><p>k</p><p>T1w</p>"],
  ["link end ordinary line shiftEnter", "<p>T0w</p><p>X0w<a href=\"https://example.org/l\">Lw</a><br />k</p><p>T1w</p>"],
  ["link end ordinary quote enter", "<p>T0w</p><blockquote><p>X0w<a href=\"https://example.org/l\">Lw</a></p><p>k</p></blockquote><p>T1w</p>"],
  ["link end ordinary quote shiftEnter", "<p>T0w</p><blockquote><p>X0w<a href=\"https://example.org/l\">Lw</a><br />k</p></blockquote><p>T1w</p>"],
  ["link start blockLed heading enter", "<ul><li>Pw</li><li><br /><h3>k<a href=\"https://example.org/l\">Lw</a>X0w</h3>T1w</li><li>Nw</li></ul>"],
  ["link start blockLed heading shiftEnter", "<ul><li>Pw</li><li><h3><br />k<a href=\"https://example.org/l\">Lw</a>X0w</h3>T1w</li><li>Nw</li></ul>"],
  ["link start blockLed line enter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li><li>k<a href=\"https://example.org/l\">Lw</a>X0w<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["link start blockLed line shiftEnter", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br />k<a href=\"https://example.org/l\">Lw</a>X0w<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["link start blockLed quote enter", "<ul><li>Pw</li><li><blockquote><p></p><p>k<a href=\"https://example.org/l\">Lw</a>X0w</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["link start blockLed quote shiftEnter", "<ul><li>Pw</li><li><blockquote><p><br />k<a href=\"https://example.org/l\">Lw</a>X0w</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["link start lineLed heading enter", "<ul><li>Pw</li><li>T9w<br /><br /><h3>k<a href=\"https://example.org/l\">Lw</a>X0w</h3>T1w</li><li>Nw</li></ul>"],
  ["link start lineLed heading shiftEnter", "<ul><li>Pw</li><li>T9w<h3><br />k<a href=\"https://example.org/l\">Lw</a>X0w</h3>T1w</li><li>Nw</li></ul>"],
  ["link start lineLed line enter", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote></li><li>k<a href=\"https://example.org/l\">Lw</a>X0w<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["link start lineLed line shiftEnter", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote><br />k<a href=\"https://example.org/l\">Lw</a>X0w<blockquote><p>B1w</p></blockquote></li><li>Nw</li></ul>"],
  ["link start lineLed quote enter", "<ul><li>Pw</li><li>T9w<blockquote><p></p><p>k<a href=\"https://example.org/l\">Lw</a>X0w</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["link start lineLed quote shiftEnter", "<ul><li>Pw</li><li>T9w<blockquote><p><br />k<a href=\"https://example.org/l\">Lw</a>X0w</p></blockquote>T1w</li><li>Nw</li></ul>"],
  ["link start ordinary heading enter", "<p>T0w</p><p></p><h3>k<a href=\"https://example.org/l\">Lw</a>X0w</h3><p>T1w</p>"],
  ["link start ordinary heading shiftEnter", "<p>T0w</p><h3><br />k<a href=\"https://example.org/l\">Lw</a>X0w</h3><p>T1w</p>"],
  ["link start ordinary line enter", "<p>T0w</p><p></p><p>k<a href=\"https://example.org/l\">Lw</a>X0w</p><p>T1w</p>"],
  ["link start ordinary line shiftEnter", "<p>T0w</p><p><br />k<a href=\"https://example.org/l\">Lw</a>X0w</p><p>T1w</p>"],
  ["link start ordinary quote enter", "<p>T0w</p><blockquote><p></p><p>k<a href=\"https://example.org/l\">Lw</a>X0w</p></blockquote><p>T1w</p>"],
  ["link start ordinary quote shiftEnter", "<p>T0w</p><blockquote><p><br />k<a href=\"https://example.org/l\">Lw</a>X0w</p></blockquote><p>T1w</p>"],
];
const write = (onChange: Parameters<typeof lastHtml>[0]) =>
  onChange.mock.calls.length === 0 ? "NOOP" : sanitizeRichTextHtml(lastHtml(onChange));
describe("Enter and Shift+Enter beside a non-text child at a block's edge write as the twin", () => {
  for (const [cell, expected] of EDGE_WRITES) {
    const [child, pos, ctx, block, key] = cell.split(" ");
    test(cell, async () => {
      const atEnd = pos === "end";
      const html = shape(ctx, block, atEnd ? `X0w${CHILD[child]}` : `${CHILD[child]}X0w`);
      const onChange = await renderField(html);
      await click(editable());
      await act(async () => {
        place(child, atEnd, false);
      });
      await settle();
      await userEvent.keyboard(key === "enter" ? "{Enter}" : "{Shift>}{Enter}{/Shift}");
      await settle();
      await userEvent.keyboard("k");
      await settle();
      expect(write(onChange)).toBe(expected);
    }, 30_000);
  }
});
const MIDDLE_WRITES: [string, string][] = [
  ["image blockLed arrow", "<ul><li>Pw</li><li><h3>Aw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["image blockLed click", "<ul><li>Pw</li><li><h3>Aw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["image blockLed structure", "<ul><li>Pw</li><li><h3>Aw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["image lineLed arrow", "<ul><li>Pw</li><li>T9w<h3>Aw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["image lineLed click", "<ul><li>Pw</li><li>T9w<h3>Aw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["image lineLed structure", "<ul><li>Pw</li><li>T9w<h3>Aw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["image ordinary arrow", "<p>T0w</p><h3>Aw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></h3><h3>kBw</h3><p>T1w</p>"],
  ["image ordinary click", "<p>T0w</p><h3>Aw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></h3><h3>kBw</h3><p>T1w</p>"],
  ["image ordinary structure", "<p>T0w</p><h3>Aw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></h3><h3>kBw</h3><p>T1w</p>"],
  ["link blockLed arrow", "<ul><li>Pw</li><li><h3>Aw<a href=\"https://example.org/l\">Lw</a></h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["link blockLed click", "<ul><li>Pw</li><li><h3>Aw<a href=\"https://example.org/l\">Lw</a></h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["link blockLed structure", "<ul><li>Pw</li><li><h3>Aw<a href=\"https://example.org/l\">Lw</a></h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["link lineLed arrow", "<ul><li>Pw</li><li>T9w<h3>Aw<a href=\"https://example.org/l\">Lw</a></h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["link lineLed click", "<ul><li>Pw</li><li>T9w<h3>Aw<a href=\"https://example.org/l\">Lw</a></h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["link lineLed structure", "<ul><li>Pw</li><li>T9w<h3>Aw<a href=\"https://example.org/l\">Lw</a></h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["link ordinary arrow", "<p>T0w</p><h3>Aw<a href=\"https://example.org/l\">Lw</a></h3><h3>kBw</h3><p>T1w</p>"],
  ["link ordinary click", "<p>T0w</p><h3>Aw<a href=\"https://example.org/l\">Lw</a></h3><h3>kBw</h3><p>T1w</p>"],
  ["link ordinary structure", "<p>T0w</p><h3>Aw<a href=\"https://example.org/l\">Lw</a></h3><h3>kBw</h3><p>T1w</p>"],
];
const PLAIN_WRITES: [string, string][] = [
  ["plain middle blockLed click", "<ul><li>Pw</li><li><h3>Aw</h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["plain middle blockLed structure", "<ul><li>Pw</li><li><h3>Aw</h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["plain middle lineLed click", "<ul><li>Pw</li><li>T9w<h3>Aw</h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["plain middle lineLed structure", "<ul><li>Pw</li><li>T9w<h3>Aw</h3><h3>kBw</h3>T1w</li><li>Nw</li></ul>"],
  ["plain middle ordinary click", "<p>T0w</p><h3>Aw</h3><h3>kBw</h3><p>T1w</p>"],
  ["plain middle ordinary structure", "<p>T0w</p><h3>Aw</h3><h3>kBw</h3><p>T1w</p>"],
  ["text end blockLed click", "<ul><li>Pw</li><li><h3>AwBw</h3>k<br />T1w</li><li>Nw</li></ul>"],
  ["text end blockLed structure", "<ul><li>Pw</li><li><h3>AwBw</h3>k<br />T1w</li><li>Nw</li></ul>"],
  ["text end lineLed click", "<ul><li>Pw</li><li>T9w<h3>AwBw</h3>k<br />T1w</li><li>Nw</li></ul>"],
  ["text end lineLed structure", "<ul><li>Pw</li><li>T9w<h3>AwBw</h3>k<br />T1w</li><li>Nw</li></ul>"],
  ["text end ordinary click", "<p>T0w</p><h3>AwBw</h3><p>k</p><p>T1w</p>"],
  ["text end ordinary structure", "<p>T0w</p><h3>AwBw</h3><p>k</p><p>T1w</p>"],
];
const inText = async (word: string, at: number, how: string) => {
  if (how === "structure") {
    await act(async () => {
      editorOf()!.update(() => {
        const text = all().find((node) => $isTextNode(node) && node.getTextContent() === word);
        if ($isTextNode(text)) text.select(at, at);
      });
    });
    await settle();
  } else if (how === "click") {
    await clickInWord(word, at);
  } else {
    await clickInWord(word, at + 1);
    await userEvent.keyboard("{ArrowLeft}");
    await settle();
  }
};
const enterThenLetter = async () => {
  await userEvent.keyboard("{Enter}");
  await settle();
  await userEvent.keyboard("k");
  await settle();
};
describe("Enter in a heading's middle, after an image or a link, splits it as the twin", () => {
  for (const [cell, expected] of MIDDLE_WRITES) {
    const [child, ctx, how] = cell.split(" ");
    test(cell, async () => {
      const onChange = await renderField(shape(ctx, "heading-middle", `Aw${CHILD[child]}Bw`));
      await click(editable());
      await inText("Bw", 0, how);
      await enterThenLetter();
      expect(write(onChange)).toBe(expected);
    }, 30_000);
  }
});
describe("Enter in a heading's plain text stays Lexical's", () => {
  for (const [cell, expected] of PLAIN_WRITES) {
    const [where, , ctx, how] = cell.split(" ");
    test(cell, async () => {
      const onChange = await renderField(shape(ctx, "heading-middle", "AwBw"));
      await click(editable());
      await inText("AwBw", where === "plain" ? 2 : 4, how);
      await enterThenLetter();
      expect(write(onChange)).toBe(expected);
    }, 30_000);
  }
});
