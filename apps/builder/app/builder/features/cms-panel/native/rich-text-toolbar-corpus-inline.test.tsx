// Bold, Italic, the lists and Link over editable corpus values reopen editable.
import { describe, test } from "vitest";
import { inlineActions, checkOverCorpus } from "./rich-text-toolbar-corpus";

describe("every toolbar command over a corpus value reopens editable", () => {
  test.each(inlineActions)("%s", (_name, run) => checkOverCorpus(run), 600_000);
});
