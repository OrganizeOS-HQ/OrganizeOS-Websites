import { describe, test } from "vitest";
import {
  at,
  backspace,
  del,
  expectEdit,
  itemPoint,
  LI,
  W,
} from "./rich-text-line-test-kit";

describe("the delete precedence (5.8)", () => {
  test("the empty line's rule runs before Lexical's join", async () => {
    await expectEdit({
      stored: LI("T0w<hr>"),
      place: itemPoint(1, 2),
      action: backspace,
      write: W("<li>T0w</li>"),
      source: "spec 5.3",
    });
  });

  test("the line break at a block's edge runs before Lexical's merge", async () => {
    await expectEdit({
      stored: LI("<blockquote><p>Q0w</p></blockquote><br>"),
      place: at("Q0w"),
      action: del,
      write: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
      source: "D3, check V6",
    });
  });

  test("the item-start join runs before Lexical's delete", async () => {
    await expectEdit({
      stored:
        "<ul><li>X0w<blockquote><p>X1w</p><hr></blockquote></li><li>Nw</li></ul>",
      place: at("Nw", 0),
      action: backspace,
      write: "<ul><li>X0w<blockquote><p>X1w</p></blockquote>Nw</li></ul>",
      source: "check V12",
    });
  });
});
