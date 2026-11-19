// Quote, Heading 2, Code and Paragraph over editable corpus values reopen editable.
import { describe, test } from "vitest";
import { blockActions, checkOverCorpus } from "./rich-text-toolbar-corpus";

describe("every toolbar command over a corpus value reopens editable", () => {
  test.each(blockActions)("%s", (_name, run) => checkOverCorpus(run), 600_000);
});
