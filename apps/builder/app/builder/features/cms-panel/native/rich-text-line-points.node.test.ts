import { describe, expect, test, vi } from "vitest";
import { $isListItemNode } from "@lexical/list";
import { $dfs } from "@lexical/utils";
import { createHeadlessEditor } from "@lexical/headless";
import { $createRangeSelection, $setSelection } from "lexical";
import { richTextNodes } from "./rich-text-html";
import { registerPointCheck } from "./rich-text-line-points";

// the field's nodes reach the design system (the image node's popover),
// which needs a DOM on load; no test here renders it, so every name it
// exports stands in as an inert value
vi.mock("@webstudio-is/design-system", () => {
  const inert: unknown = new Proxy(() => inert, {
    get: (_target, key) =>
      key === "then"
        ? undefined
        : key === Symbol.toPrimitive
          ? () => ""
          : inert,
  });
  return Object.fromEntries(
    [
      "Button",
      "css",
      "cssVar",
      "Flex",
      "Grid",
      "InputField",
      "Label",
      "Popover",
      "PopoverAnchor",
      "PopoverContent",
      "Text",
      "theme",
    ].map((name) => [name, inert])
  );
});

const element = (type: string, children: unknown[], extra = {}) => ({
  type,
  children,
  direction: null,
  format: "",
  indent: 0,
  version: 1,
  ...extra,
});

describe("the point check after a commit", () => {
  test("a point the check cannot resolve is reported once and not retried", async () => {
    // headless: an editor with no page keeps its selection in an update
    const editor = createHeadlessEditor({
      nodes: richTextNodes,
      onError: (error) => {
        throw error;
      },
    });
    const resolve = vi.fn(() => false);
    const off = registerPointCheck(editor, resolve);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const tags: string[][] = [];
    const offTags = editor.registerUpdateListener(({ tags: set }) => {
      tags.push([...set]);
    });
    const json = {
      root: element("root", [
        element(
          "list",
          [
            element(
              "listitem",
              [
                {
                  type: "text",
                  text: "T0w",
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  version: 1,
                },
                { type: "horizontalrule", version: 1 },
              ],
              { value: 1 }
            ),
          ],
          { listType: "bullet", start: 1, tag: "ul" }
        ),
      ]),
    };
    editor.setEditorState(
      editor.parseEditorState(JSON.stringify(json), () => {
        const item = $dfs()
          .map(({ node }) => node)
          .find($isListItemNode)!;
        const selection = $createRangeSelection();
        selection.anchor.set(item.getKey(), 2, "element");
        selection.focus.set(item.getKey(), 2, "element");
        $setSelection(selection);
      })
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toMatch(
      /^cms-line point rule: a point on listitem@2/
    );
    expect(resolve).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(tags.length).toBeGreaterThan(0);
    offTags();
    off();
    error.mockRestore();
  });
});
