// Spec section 12: the Lexical 0.21.0 behaviours the line rules lean on,
// each pinned in a fresh editor through public API, so an upgrade that
// changes one fails here first. The history's two (redo, history-merge)
// and the page's five are in rich-text-line-lexical.test.tsx.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";
import {
  $addUpdateTag,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getAdjacentNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isLineBreakNode,
  $isParagraphNode,
  $selectAll,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  createEditor,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type TextNode,
} from "lexical";
import { $generateJSONFromSelectedNodes } from "@lexical/clipboard";
import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  ListItemNode,
} from "@lexical/list";
import { $createQuoteNode } from "@lexical/rich-text";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { richTextNodes } from "./rich-text-html";
import { $createCmsLineNode, $isCmsLineNode } from "./rich-text-line-node";
import { $createCmsImageNode } from "./rich-text-image-node";

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

const here = dirname(fileURLToPath(import.meta.url));

/**
 * A package is looked up in the node_modules folders above a directory, as
 * Node does (as rich-text-pins.node.test.ts resolves packages).
 */
const resolveFrom = (from: string, name: string) => {
  for (
    let directory = from;
    directory !== dirname(directory);
    directory = dirname(directory)
  ) {
    const path = join(directory, "node_modules", name, "package.json");
    if (existsSync(path)) {
      return dirname(realpathSync(path));
    }
  }
  throw new Error(`${name} does not resolve from ${from}`);
};

/** An update with no `discrete` (a registration's) commits in a microtask. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const fresh = () =>
  createEditor({
    nodes: richTextNodes,
    onError: (error) => {
      throw error;
    },
  });

const write = (editor: LexicalEditor, fn: () => void, tag?: string) =>
  editor.update(fn, { discrete: true, ...(tag === undefined ? {} : { tag }) });

type Update = {
  tags: Set<string>;
  dirtyElements: Map<NodeKey, boolean>;
  editorState: EditorState;
};

/** Every update listener call from now on, its sets copied. */
const recordUpdates = (editor: LexicalEditor) => {
  const updates: Update[] = [];
  editor.registerUpdateListener(({ tags, dirtyElements, editorState }) => {
    updates.push({
      tags: new Set(tags),
      dirtyElements: new Map(dirtyElements),
      editorState,
    });
  });
  return updates;
};

/** A list of one item per entry, each item's children made by `make`. */
const $list = (...items: Array<() => LexicalNode[]>) => {
  const list = $createListNode("bullet");
  for (const make of items) {
    list.append($createListItemNode().append(...make()));
  }
  $getRoot().clear().append(list);
  return list;
};

const $caret = (node: TextNode, offset: number) => {
  const selection = $createRangeSelection();
  selection.anchor.set(node.getKey(), offset, "text");
  selection.focus.set(node.getKey(), offset, "text");
  $setSelection(selection);
  return selection;
};

describe("Lexical 0.21.0 as the line rules read it (spec section 12)", () => {
  // Section 2, 5.1: a line is a block, the item holding it is not
  test("an element is a block only when its first child is inline", () => {
    const editor = fresh();
    write(editor, () => {
      const plain = $createTextNode("Aw");
      const quoted = $createTextNode("Q0w");
      const list = $list(
        () => [plain],
        () => [$createQuoteNode().append(quoted)]
      );
      const [first, mixed] = list.getChildren();
      const quote = quoted.getParentOrThrow();

      const fromPlain = $caret(plain, 1).insertParagraph();
      expect($isListItemNode(fromPlain)).toBe(true);
      expect(fromPlain?.getParent()?.is(list)).toBe(true);
      expect(first.getNextSibling()?.is(fromPlain)).toBe(true);

      // the search stops at the quote, below the mixed item; a caret in a
      // text child of the mixed item itself has no block above it, and
      // $removeTextAndSplitBlock would split up to the root and not end
      const fromMixed = $caret(quoted, 1).insertParagraph();
      expect($isParagraphNode(fromMixed)).toBe(true);
      expect(fromMixed?.getParent()?.is(mixed)).toBe(true);
      expect(quote.getNextSibling()?.is(fromMixed)).toBe(true);
    });

    const source = readFileSync(
      join(resolveFrom(here, "lexical"), "Lexical.dev.js"),
      "utf8"
    );
    const start = source.indexOf("function INTERNAL_$isBlock(");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("\n}\n", start));
    expect(body).toContain(
      "const isLeafElement = firstChild === null || $isLineBreakNode(firstChild) || $isTextNode(firstChild) || firstChild.isInline();"
    );
    expect(body).toContain(
      "return !node.isInline() && node.canBeEmpty() !== false && isLeafElement;"
    );
  });

  // D6: a copy carries the line's children, never the line
  test("an excluded element's children are promoted in copied JSON", () => {
    const editor = fresh();
    write(editor, () => {
      $list(
        () => [
          $createQuoteNode().append($createTextNode("Q0w")),
          $createCmsLineNode().append($createTextNode("Aw")),
        ],
        () => [$createTextNode("Bw")]
      );
    });
    let nodes: unknown[] = [];
    write(editor, () => {
      $selectAll();
      nodes = $generateJSONFromSelectedNodes(editor, $getSelection()).nodes;
    });
    const all: Array<{ type: string; text?: string; children?: unknown[] }> =
      [];
    const walk = (list: unknown[]) => {
      for (const node of list as typeof all) {
        all.push(node);
        walk(node.children ?? []);
      }
    };
    walk(nodes);
    expect(all.some((node) => node.type === "cms-line")).toBe(false);
    const item = all.find((node) => node.type === "listitem");
    expect(
      (item?.children as typeof all).some(
        (child) => child.type === "text" && child.text === "Aw"
      )
    ).toBe(true);
  });

  // 5.3, the caret-line tag: a transform's registration is a merged update
  test("registering a transform marks every node of its class dirty in an update tagged history-merge", async () => {
    const editor = fresh();
    let itemKey = "";
    write(editor, () => {
      const list = $list(() => [$createTextNode("Aw")]);
      itemKey = list.getFirstChildOrThrow().getKey();
    });
    const updates = recordUpdates(editor);
    editor.registerNodeTransform(ListItemNode, () => {});
    await flush();
    expect(updates).toHaveLength(1);
    expect(updates[0].tags.has("history-merge")).toBe(true);
    expect(updates[0].dirtyElements.has(itemKey)).toBe(true);
  });

  // 5.5: the transforms walk the dirty items in the order they were marked
  test("element transforms run for intentionally dirty nodes, in dirty order", async () => {
    const editor = fresh();
    const keys: NodeKey[] = [];
    write(editor, () => {
      const list = $list(
        () => [$createTextNode("Aw")],
        () => [$createTextNode("Bw")]
      );
      keys.push(...list.getChildren().map((item) => item.getKey()));
    });
    const recorded: NodeKey[] = [];
    editor.registerNodeTransform(ListItemNode, (node) => {
      recorded.push(node.getKey());
    });
    await flush();
    recorded.length = 0;
    write(editor, () => {
      $getNodeByKey(keys[1])?.markDirty();
      $getNodeByKey(keys[0])?.markDirty();
    });
    expect(recorded).toEqual([keys[1], keys[0]]);
  });

  // 5.3's tag
  test("an update's tags cover the whole update and end at a commit that changed a node", () => {
    const editor = fresh();
    const TAGGING = createCommand<void>("TAGGING");
    editor.registerCommand(
      TAGGING,
      () => {
        $addUpdateTag("t");
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
    let key = "";
    write(editor, () => {
      const node = $createTextNode("Aw");
      $getRoot().clear().append($createParagraphNode().append(node));
      key = node.getKey();
    });
    const updates = recordUpdates(editor);
    write(editor, () => {
      $getNodeByKey<TextNode>(key)?.setTextContent("Awk");
      editor.dispatchCommand(TAGGING, undefined);
    });
    write(editor, () => {
      $getNodeByKey<TextNode>(key)?.setTextContent("Awkk");
    });
    expect(updates).toHaveLength(2);
    expect(updates[0].tags.has("t")).toBe(true);
    expect(updates[1].tags.has("t")).toBe(false);
  });

  // 5.5
  test("transforms registered on one class run in registration order", async () => {
    const editor = fresh();
    let itemKey = "";
    write(editor, () => {
      itemKey = $list(() => [$createTextNode("Aw")])
        .getFirstChildOrThrow()
        .getKey();
    });
    const order: string[] = [];
    editor.registerNodeTransform(ListItemNode, () => {
      order.push("a");
    });
    editor.registerNodeTransform(ListItemNode, () => {
      order.push("b");
    });
    await flush();
    order.length = 0;
    write(editor, () => {
      $getNodeByKey(itemKey)?.markDirty();
    });
    expect(order).toEqual(["a", "b"]);
  });

  // 5.3, the check after every commit
  test("an update that changes only the selection runs no transform", async () => {
    const editor = fresh();
    let key = "";
    write(editor, () => {
      const node = $createTextNode("Aw");
      $list(() => [node]);
      key = node.getKey();
    });
    let runs = 0;
    editor.registerNodeTransform(ListItemNode, () => {
      runs += 1;
    });
    await flush();
    const before = runs;
    write(editor, () => {
      $caret($getNodeByKey<TextNode>(key)!, 1);
    });
    expect(runs).toBe(before);
  });

  // 5.3, deletes at a resolved point
  test("`$getAdjacentNode` climbs one level only", () => {
    const editor = fresh();
    write(editor, () => {
      const end = $createTextNode("Aw");
      const rule = $createHorizontalRuleNode();
      const next = $createTextNode("Bw");
      $list(
        () => [$createCmsLineNode().append(end), rule],
        () => [next]
      );
      const adjacent = $getAdjacentNode($caret(end, 2).focus, false);
      expect($isHorizontalRuleNode(adjacent)).toBe(true);
      expect(adjacent?.is(rule)).toBe(true);
      expect(adjacent?.getParent()?.is(end.getParent()?.getParent())).toBe(
        true
      );
      expect(adjacent?.is(next)).toBe(false);
    });
  });

  // D19, CI 3.4
  test("`insertParagraph` reads the nodes after the caret before it calls `insertNewAfter`", () => {
    const editor = fresh();
    write(editor, () => {
      const moved = $createTextNode("X2w");
      const old = $createCmsLineNode().append(moved);
      $getRoot()
        .clear()
        .append(
          $createQuoteNode().append(
            $createParagraphNode().append($createTextNode("X1w")),
            old
          )
        );
      const made = $caret(moved, 0).insertParagraph();
      expect($isCmsLineNode(made)).toBe(true);
      expect(moved.getParent()?.is(made)).toBe(true);
      const left = old.getChildren();
      expect(left).toHaveLength(1);
      expect($isLineBreakNode(left[0])).toBe(true);
    });
  });

  // 5.4: the removal call sites counted when R1 was planned (M45)
  test("the removal call sites are the ones counted when R1 was planned", () => {
    const counted = readFileSync(
      join(here, "__records__", "r1-removetext-count.txt"),
      "utf8"
    )
      .trim()
      .split("\n")
      .map((line) => {
        const [path, count] = line.split(":");
        return { path: path.replace(/^node_modules\//, ""), count };
      });
    expect(counted).toHaveLength(5);
    for (const { path, count } of counted) {
      const parts = path.split("/");
      const name = parts[0].startsWith("@") ? parts.slice(0, 2) : parts[0];
      const pkg = Array.isArray(name) ? name.join("/") : name;
      const file = path.slice(pkg.length + 1);
      const source = readFileSync(join(resolveFrom(here, pkg), file), "utf8");
      expect(source.split(".removeText()").length - 1, path).toBe(
        Number(count)
      );
    }
  });

  // 5.3: the field tags only a branch that changed a node
  test("tags and dirty maps are reset at commit only when the commit changed a node", () => {
    const editor = fresh();
    let key = "";
    write(editor, () => {
      const node = $createTextNode("Aw");
      $getRoot().clear().append($createParagraphNode().append(node));
      key = node.getKey();
    });
    const updates = recordUpdates(editor);
    write(editor, () => {
      $caret($getNodeByKey<TextNode>(key)!, 1);
      $addUpdateTag("x");
    });
    write(editor, () => {
      $getNodeByKey<TextNode>(key)?.setTextContent("Awk");
    });
    expect(updates).toHaveLength(2);
    expect(updates[1].tags.has("x")).toBe(true);
  });

  // section 12 (3)
  test("setEditorState adds its tag to a pending update and commits that update first", () => {
    const editor = fresh();
    let key = "";
    write(editor, () => {
      const node = $createTextNode("Aw");
      $getRoot().clear().append($createParagraphNode().append(node));
      key = node.getKey();
    });
    const other = editor.getEditorState();
    const updates = recordUpdates(editor);
    editor.update(() => {
      $getNodeByKey<TextNode>(key)?.setTextContent("Awk");
      editor.setEditorState(other, { tag: "historic" });
    });
    const committed = updates.find(({ editorState }) =>
      editorState.read(() => $getNodeByKey(key)?.getTextContent() === "Awk")
    );
    expect(committed).toBeDefined();
    expect(committed?.tags.has("historic")).toBe(true);
  });

  // 5.4, 5.8: the removal step and the writer give such ends a place in
  // text first
  test("an element-point end is resolved by getDescendantByIndex", () => {
    const editor = fresh();
    write(editor, () => {
      const image = $createCmsImageNode({
        src: "https://cdn.example.org/x.png",
        alt: "",
        width: "40",
        height: "20",
        title: null,
      });
      const first = $createParagraphNode().append($createTextNode("Pw"), image);
      const after = $createTextNode("Nw");
      $getRoot().clear().append(first, $createParagraphNode().append(after));
      const range = $createRangeSelection();
      range.anchor.set(first.getKey(), first.getChildrenSize(), "element");
      range.focus.set(after.getKey(), 1, "text");
      expect(range.getNodes().some((node) => node.is(image))).toBe(true);

      const quoted = $createTextNode("Q1w");
      const list = $list(() => [
        $createTextNode("T0w"),
        $createQuoteNode().append(quoted),
      ]);
      const item = list.getFirstChildOrThrow<ListItemNode>();
      expect(item.getDescendantByIndex(1)?.is(quoted)).toBe(true);
      const before = $createRangeSelection();
      before.anchor.set(item.getKey(), 1, "element");
      before.focus.set(quoted.getKey(), 0, "text");
      // the element offset 1 is compared with the text offset 0
      expect(before.anchor.isBefore(before.focus)).toBe(false);
      expect(before.focus.isBefore(before.anchor)).toBe(true);
    });
  });
});
