/**
 * The rich text control (4.3.3.1): a `LexicalComposer` in the builder
 * document, never the canvas's text editor. Its node set and HTML are
 * `rich-text-html.ts`'s; `field-controls.tsx` loads this module lazily, so
 * Lexical stays out of the builder's first load.
 *
 * A value the editor would not keep whole (a block shape its export does
 * not reproduce) opens read-only, so nothing is lost silently.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  $createParagraphNode,
  $getRoot,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  $isElementNode,
  COMMAND_PRIORITY_CRITICAL,
  DRAGSTART_COMMAND,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  COPY_COMMAND,
  CUT_COMMAND,
  FORMAT_TEXT_COMMAND,
  PASTE_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
  type TextFormatType,
} from "lexical";
import {
  $createLinkNode,
  $isLinkNode,
  $toggleLink,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from "@lexical/link";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  type ListNode,
} from "@lexical/list";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from "@lexical/rich-text";
import { $getLexicalContent } from "@lexical/clipboard";
import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { $setBlocksType } from "@lexical/selection";
import {
  $findMatchingParent,
  mergeRegister,
  objectKlassEquals,
} from "@lexical/utils";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import {
  Button,
  css,
  cssVar,
  Flex,
  Grid,
  IconButton,
  InputField,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  Switch,
  Text,
  textVariants,
  theme,
  toast,
  Tooltip,
} from "@webstudio-is/design-system";
import {
  BoldIcon,
  ImageIcon,
  LinkIcon,
  ListIcon,
  MinusIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
} from "@webstudio-is/icons";
import type { CmsRichTextValue, CmsSource } from "./cms-source";
import { getToastText, type CmsRefusal } from "./cms-logic";
import {
  CMS_IMAGE_ACCEPT,
  checkCmsImageFile,
  uploadCmsImage,
} from "./cms-image-upload";
import {
  $createCmsImageNode,
  $isCmsFigureNode,
  $isCmsImageNode,
  type CmsImageAttributes,
} from "./rich-text-image-node";
import {
  exportRichTextHtml,
  getRichTextReadOnlyReason,
  importRichTextHtml,
  markRichTextCopy,
  readRichTextValue,
  richTextHasImage,
  richTextHref,
  richTextHtmlConfig,
  pushMarksIntoBlocks,
  registerRichTextTransforms,
  richTextNodes,
} from "./rich-text-html";

const blockSpacing = { margin: 0, marginBottom: theme.spacing[5] };

/** Lexical takes class name strings; stitches gives each from `.className`. */
const editorTheme = {
  paragraph: css(blockSpacing)().className,
  heading: {
    h2: css(textVariants.bigTitle, blockSpacing, { userSelect: "text" })()
      .className,
    h3: css(textVariants.titles, blockSpacing, { userSelect: "text" })()
      .className,
    h4: css(textVariants.labels, blockSpacing, { userSelect: "text" })()
      .className,
  },
  quote: css(blockSpacing, {
    paddingLeft: theme.spacing[5],
    borderLeft: `2px solid ${cssVar("--border-default")}`,
  })().className,
  list: {
    ul: css(blockSpacing, { paddingLeft: theme.spacing[9] })().className,
    ol: css(blockSpacing, { paddingLeft: theme.spacing[9] })().className,
  },
  code: css(textVariants.mono, blockSpacing, {
    display: "block",
    padding: theme.spacing[3],
    background: cssVar("--background-primary"),
    borderRadius: theme.borderRadius[3],
    whiteSpace: "pre-wrap",
    userSelect: "text",
  })().className,
  link: css({
    color: cssVar("--foreground-accent"),
    textDecoration: "underline",
  })().className,
  text: {
    underline: css({ textDecoration: "underline" })().className,
    strikethrough: css({ textDecoration: "line-through" })().className,
    underlineStrikethrough: css({ textDecoration: "underline line-through" })()
      .className,
    code: css(textVariants.mono, {
      background: cssVar("--background-primary"),
      borderRadius: theme.borderRadius[2],
      userSelect: "text",
    })().className,
  },
};

/** The TextArea's frame: secondary background, a border on hover and focus. */
const frameStyle = css({
  borderRadius: theme.borderRadius[4],
  border: "1px solid transparent",
  background: cssVar("--background-secondary"),
  color: cssVar("--foreground-primary"),
  "&:hover": {
    borderColor: cssVar("--border-default"),
  },
  "&:focus-within": {
    borderColor: cssVar("--border-focus"),
  },
  "&[data-invalid]": {
    borderColor: cssVar("--border-negative"),
  },
  "&[data-disabled]": {
    background: cssVar("--background-disabled"),
    color: cssVar("--foreground-disabled"),
  },
});

const toolbarStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing[1],
  padding: theme.spacing[2],
  minWidth: 0,
  borderBottom: `1px solid ${cssVar("--border-default")}`,
});

const contentStyle = css(textVariants.regular, {
  minHeight: theme.spacing[23],
  padding: theme.spacing[5],
  outline: "none",
  userSelect: "text",
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  "& hr": {
    border: "none",
    borderTop: `1px solid ${cssVar("--border-default")}`,
    marginBlock: theme.spacing[5],
  },
});

const NumberedListIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M6.5 4h7.5M6.5 8h7.5M6.5 12h7.5" />
    <path d="M2.5 3l1-.5v3" />
    <path d="M2.25 10.25c0-.6.5-.9 1-.9s1 .3 1 .85c0 .7-2 1.3-2 2.3h2" />
  </svg>
);

const ToolbarButton = ({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) => (
  <Tooltip content={label}>
    <IconButton
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // keeps the editor's selection
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </IconButton>
  </Tooltip>
);

type BlockType = "paragraph" | "h2" | "h3" | "h4" | "quote" | "code";

const blockTypes: BlockType[] = [
  "paragraph",
  "h2",
  "h3",
  "h4",
  "quote",
  "code",
];

const blockLabels: Record<BlockType, string> = {
  paragraph: "Paragraph",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  quote: "Quote",
  code: "Code",
};

type ToolbarState = {
  block: BlockType;
  list: "bullet" | "number" | undefined;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  link: boolean;
};

const initialToolbarState: ToolbarState = {
  block: "paragraph",
  list: undefined,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  link: false,
};

const blockTypeOf = (node: LexicalNode): BlockType => {
  const block = $findMatchingParent(
    node,
    (parent) =>
      $isHeadingNode(parent) || $isQuoteNode(parent) || $isCodeNode(parent)
  );
  if ($isHeadingNode(block)) {
    const tag = block.getTag();
    return tag === "h2" || tag === "h3" || tag === "h4" ? tag : "paragraph";
  }
  if ($isQuoteNode(block)) {
    return "quote";
  }
  if ($isCodeNode(block)) {
    return "code";
  }
  return "paragraph";
};

const findLink = (node: LexicalNode) =>
  $findMatchingParent(node, $isLinkNode) as LinkNode | null;

const useToolbarState = (editor: LexicalEditor) => {
  const [state, setState] = useState<ToolbarState>(initialToolbarState);
  useEffect(() => {
    const read = () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) === false) {
        return;
      }
      const anchor = selection.anchor.getNode();
      const list = $findMatchingParent(anchor, $isListNode) as ListNode | null;
      const listType = list?.getListType();
      setState({
        block: blockTypeOf(anchor),
        list:
          listType === "bullet" || listType === "number" ? listType : undefined,
        bold: selection.hasFormat("bold"),
        italic: selection.hasFormat("italic"),
        underline: selection.hasFormat("underline"),
        strikethrough: selection.hasFormat("strikethrough"),
        link: findLink(anchor) !== null,
      });
    };
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(read);
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          read();
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor]);
  return state;
};

/**
 * A code block keeps text only: an image in a block made code moves to a
 * paragraph right after it, so the value keeps what the editor shows.
 */
const $moveImagesOutOfCode = () => {
  const visit = (node: LexicalNode) => {
    if ($isCodeNode(node)) {
      const images = node.getChildren().filter($isCmsImageNode);
      if (images.length > 0) {
        const paragraph = $createParagraphNode();
        paragraph.append(...images);
        node.insertAfter(paragraph);
        // the caret's offset counted the images: it goes to the block's end
        node.selectEnd();
      }
      return;
    }
    if ($isElementNode(node)) {
      node.getChildren().forEach(visit);
    }
  };
  visit($getRoot());
};

const setBlockType = (editor: LexicalEditor, block: BlockType) => {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection) === false) {
      return;
    }
    // a caret at the root (before a first figure or rule) is in no block
    if (selection.anchor.key === "root" || selection.focus.key === "root") {
      return;
    }
    $setBlocksType(selection, () => {
      switch (block) {
        case "paragraph":
          return $createParagraphNode();
        case "quote":
          return $createQuoteNode();
        case "code":
          return $createCodeNode();
        default:
          return $createHeadingNode(block);
      }
    });
    if (block === "code") {
      $moveImagesOutOfCode();
    }
  });
  editor.focus();
};

/** The node rules the read-only check runs too (`registerRichTextTransforms`). */
const TransformsPlugin = () => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => registerRichTextTransforms(editor), [editor]);
  return null;
};

const LinkButton = ({
  id,
  active,
  disabled,
}: {
  id: string;
  active: boolean;
  disabled: boolean;
}) => {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [newTab, setNewTab] = useState(false);
  const [error, setError] = useState<string>();
  const newTabId = `${id}-link-new-tab`;

  const readLink = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      const link = $isRangeSelection(selection)
        ? findLink(selection.anchor.getNode())
        : null;
      setUrl(link?.getURL() ?? "");
      setNewTab(link?.getTarget() === "_blank");
    });
  };

  const apply = () => {
    // only an address the site shows as a link
    const href = richTextHref(url);
    if (href === null) {
      setError("Not a link");
      return;
    }
    editor.dispatchCommand(
      TOGGLE_LINK_COMMAND,
      newTab
        ? { url: href, target: "_blank", rel: "noopener noreferrer" }
        : { url: href, target: null, rel: null }
    );
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          readLink();
          setError(undefined);
        }
        setOpen(next);
      }}
    >
      <Tooltip content="Link">
        <PopoverTrigger asChild>
          <IconButton
            type="button"
            aria-label="Link"
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
          >
            <LinkIcon />
          </IconButton>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="start"
        css={{ width: theme.spacing[33], padding: theme.panel.padding }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.focus();
        }}
      >
        <Grid gap="2">
          <InputField
            type="url"
            aria-label="URL"
            placeholder="https://"
            autoFocus
            value={url}
            color={error === undefined ? undefined : "error"}
            aria-invalid={error === undefined ? undefined : true}
            onChange={(event) => {
              setUrl(event.currentTarget.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                apply();
              }
            }}
          />
          {error !== undefined && (
            <Text role="alert" color="destructive">
              {error}
            </Text>
          )}
          <Flex align="center" justify="between" gap="2" wrap="wrap">
            <Flex align="center" gap="2">
              <Switch
                id={newTabId}
                checked={newTab}
                onCheckedChange={setNewTab}
              />
              <Label htmlFor={newTabId}>New tab</Label>
            </Flex>
            <Flex gap="1">
              {active && (
                <Button
                  color="ghost"
                  onClick={() => {
                    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
                    setOpen(false);
                  }}
                >
                  Remove
                </Button>
              )}
              <Button color="primary" onClick={apply}>
                Apply
              </Button>
            </Flex>
          </Flex>
        </Grid>
      </PopoverContent>
    </Popover>
  );
};

/** What the toolbar's Image needs: E9, and where its failures go. */
type ImageUpload = {
  source: Pick<CmsSource, "uploadImage">;
  /** "Not an image", "Over 4 MB" or "Not uploaded", under the field. */
  onError?: (error: string | undefined) => void;
  /** True while E9 is in flight: Save and Publish wait for it. */
  onBusyChange?: (busy: boolean) => void;
  /** E9 answered `unauthorized` or `mfa_required`: the screen's line. */
  onRefusal?: (refusal: CmsRefusal) => void;
};

/**
 * Inserts the image where the caret was when Image was chosen, or in a new
 * paragraph at the end when that place is gone or is a code block.
 */
const insertImage = (
  editor: LexicalEditor,
  caret: RangeSelection | null,
  attributes: CmsImageAttributes
) => {
  editor.update(() => {
    const image = $createCmsImageNode(attributes);
    const isAttached =
      caret !== null &&
      $getNodeByKey(caret.anchor.key) !== null &&
      $getNodeByKey(caret.focus.key) !== null;
    if (
      caret !== null &&
      isAttached &&
      $findMatchingParent(caret.anchor.getNode(), $isCodeNode) === null &&
      $findMatchingParent(caret.focus.getNode(), $isCodeNode) === null
    ) {
      const selection = caret.clone();
      $setSelection(selection);
      selection.insertNodes([image]);
      return;
    }
    const paragraph = $createParagraphNode();
    paragraph.append(image);
    $getRoot().append(paragraph);
  });
};

const ImageButton = ({
  disabled,
  upload,
}: {
  disabled: boolean;
  upload: ImageUpload;
}) => {
  const [editor] = useLexicalComposerContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<RangeSelection | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const choose = async (file: File) => {
    const refused = checkCmsImageFile(file);
    if (refused !== undefined) {
      upload.onError?.(refused);
      return;
    }
    upload.onError?.(undefined);
    setIsUploading(true);
    upload.onBusyChange?.(true);
    const uploaded = await uploadCmsImage(upload.source, file);
    setIsUploading(false);
    upload.onBusyChange?.(false);
    if (uploaded.ok === false) {
      if ("refusal" in uploaded) {
        if (upload.onRefusal !== undefined) {
          upload.onRefusal(uploaded.refusal);
          return;
        }
        upload.onError?.("Not uploaded");
        return;
      }
      if ("toast" in uploaded) {
        toast.error(getToastText(uploaded.toast));
        return;
      }
      upload.onError?.(uploaded.error);
      return;
    }
    insertImage(editor, caretRef.current, {
      src: uploaded.url,
      alt: "",
      width: uploaded.width === null ? null : String(uploaded.width),
      height: uploaded.height === null ? null : String(uploaded.height),
      title: null,
    });
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={CMS_IMAGE_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file !== undefined) {
            void choose(file);
          }
        }}
      />
      <ToolbarButton
        label="Image"
        disabled={disabled || isUploading}
        onClick={() => {
          caretRef.current = editor.getEditorState().read(() => {
            const selection = $getSelection();
            return $isRangeSelection(selection) ? selection.clone() : null;
          });
          fileRef.current?.click();
        }}
      >
        <ImageIcon />
      </ToolbarButton>
    </>
  );
};

/** One `role="toolbar"` row, on upstream's `MarkdownToolbar` pattern. */
const Toolbar = ({
  id,
  disabled,
  upload,
}: {
  id: string;
  disabled: boolean;
  upload?: ImageUpload;
}) => {
  const [editor] = useLexicalComposerContext();
  const state = useToolbarState(editor);
  const format = (type: TextFormatType) =>
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  const toggleList = (type: "bullet" | "number") => {
    if (state.list === type) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      return;
    }
    editor.dispatchCommand(
      type === "bullet"
        ? INSERT_UNORDERED_LIST_COMMAND
        : INSERT_ORDERED_LIST_COMMAND,
      undefined
    );
  };
  return (
    <div className={toolbarStyle()} role="toolbar" aria-label="Formatting">
      <Select
        aria-label="Block type"
        options={blockTypes}
        value={state.block}
        getLabel={(block: BlockType) => blockLabels[block]}
        disabled={disabled}
        onChange={(block) => setBlockType(editor, block)}
      />
      <ToolbarButton
        label="Bold"
        active={state.bold}
        disabled={disabled}
        onClick={() => format("bold")}
      >
        <BoldIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={state.italic}
        disabled={disabled}
        onClick={() => format("italic")}
      >
        <TextItalicIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={state.underline}
        disabled={disabled}
        onClick={() => format("underline")}
      >
        <TextUnderlineIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={state.strikethrough}
        disabled={disabled}
        onClick={() => format("strikethrough")}
      >
        <TextStrikethroughIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Bulleted list"
        active={state.list === "bullet"}
        disabled={disabled}
        onClick={() => toggleList("bullet")}
      >
        <ListIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={state.list === "number"}
        disabled={disabled}
        onClick={() => toggleList("number")}
      >
        <NumberedListIcon />
      </ToolbarButton>
      <LinkButton id={id} active={state.link} disabled={disabled} />
      {upload !== undefined && (
        <ImageButton disabled={disabled} upload={upload} />
      )}
      <ToolbarButton
        label="Divider"
        disabled={disabled}
        onClick={() =>
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)
        }
      >
        <MinusIcon />
      </ToolbarButton>
    </div>
  );
};

/** The clipboard type of Lexical's own copy, whose nodes carry their links. */
const LEXICAL_CLIPBOARD_TYPE = "application/x-lexical-editor";

/**
 * Whether copied Lexical nodes hold a link the Link control's rule refuses.
 * Lexical reads copied nodes only from its own namespace, one per field, so
 * an image in them came from this field's own copy, cut or drag.
 */
const hasRefusedNode = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some(hasRefusedNode);
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const node = value as {
    type?: unknown;
    url?: unknown;
    children?: unknown;
    nodes?: unknown;
  };
  if (
    (node.type === "link" || node.type === "autolink") &&
    richTextHref(typeof node.url === "string" ? node.url : undefined) === null
  ) {
    return true;
  }
  return hasRefusedNode(node.children) || hasRefusedNode(node.nodes);
};

/**
 * The pasted data with each link the Link control's rule (`richTextHref`)
 * refuses unwrapped to its text, and links and marks moved inside the
 * blocks they wrap; undefined when it needs neither.
 */
const withoutRefusedLinks = (data: DataTransfer): DataTransfer | undefined => {
  const html = data.getData("text/html");
  let cleanHtml: string | undefined;
  if (html !== "") {
    const dom = new DOMParser().parseFromString(html, "text/html");
    const movedMarks = pushMarksIntoBlocks(dom.body);
    // an image enters a value only from stored HTML or an upload: dropped
    // here, before the import, so the words around it keep their space
    const images = Array.from(dom.querySelectorAll("img")).filter(
      (image) => image.parentElement?.tagName !== "FIGURE"
    );
    for (const image of images) {
      image.remove();
    }
    const refused = Array.from(dom.querySelectorAll("a")).filter(
      (anchor) =>
        richTextHref(anchor.getAttribute("href") ?? undefined) === null
    );
    for (const anchor of refused) {
      anchor.replaceWith(...Array.from(anchor.childNodes));
    }
    // a link that held only an image is left with nothing to link
    const emptied = Array.from(dom.querySelectorAll("a")).filter(
      (anchor) => (anchor.textContent ?? "").trim() === ""
    );
    for (const anchor of emptied) {
      anchor.replaceWith(...Array.from(anchor.childNodes));
    }
    if (
      movedMarks ||
      images.length > 0 ||
      refused.length > 0 ||
      emptied.length > 0
    ) {
      cleanHtml = dom.body.innerHTML;
    }
  }
  let dropsLexical = false;
  const copied = data.getData(LEXICAL_CLIPBOARD_TYPE);
  if (copied !== "") {
    try {
      dropsLexical = hasRefusedNode(JSON.parse(copied));
    } catch {
      // not Lexical's data: the paste never reads it
    }
  }
  if (cleanHtml === undefined && dropsLexical === false) {
    return;
  }
  const next = new DataTransfer();
  for (const type of data.types) {
    if (type === "Files" || (type === LEXICAL_CLIPBOARD_TYPE && dropsLexical)) {
      continue;
    }
    next.setData(
      type,
      type === "text/html" && cleanHtml !== undefined
        ? cleanHtml
        : data.getData(type)
    );
  }
  return next;
};

/**
 * A pasted or dropped link takes the Link control's rule: one it refuses is
 * inserted as its text. A stored value's links take the import's rule
 * instead, so this applies to paste and drop only. Any link, however it was
 * made, whose address the import's rule refuses becomes its text.
 */
/** A link's attributes, for the links a split makes. */
const linkAttributes = (link: LinkNode) => ({
  target: link.getTarget(),
  rel: link.getRel(),
  title: link.getTitle(),
});

/**
 * The site never shows an image inside a link, so a link the Link control
 * makes or extends never holds one: a link at the root (around a figure) is
 * unwrapped, and a link is split around each image it holds.
 */
const $keepImagesOutOfLinks = (links: Set<LinkNode>) => {
  for (const link of links) {
    if (link.isAttached() === false) {
      continue;
    }
    if (link.getParent()?.getKey() === "root") {
      for (const child of link.getChildren()) {
        link.insertBefore(child);
      }
      link.remove();
      continue;
    }
    const children = link.getChildren();
    if (children.some($isCmsImageNode) === false) {
      continue;
    }
    let run: LinkNode | null = null;
    for (const child of children) {
      if ($isCmsImageNode(child)) {
        link.insertBefore(child);
        run = null;
        continue;
      }
      if (run === null) {
        run = $createLinkNode(link.getURL(), linkAttributes(link));
        link.insertBefore(run);
      }
      run.append(child);
    }
    link.remove();
  }
};

const ImageEditingPlugin = () => {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      mergeRegister(
        // above LinkPlugin's own handler, for a selection holding an image
        editor.registerCommand(
          TOGGLE_LINK_COMMAND,
          (payload) => {
            const selection = $getSelection();
            if ($isRangeSelection(selection) === false) {
              return false;
            }
            // the images the selection reaches, found before the toggle
            // moves the selection's offsets past a link it inserts
            const images = selection
              .getNodes()
              .flatMap((node) =>
                $isCmsImageNode(node) || $isCmsFigureNode(node)
                  ? [node]
                  : $isElementNode(node)
                    ? node
                        .getChildren()
                        .filter(
                          (child) =>
                            $isCmsImageNode(child) || $isCmsFigureNode(child)
                        )
                    : []
              );
            if (payload === null) {
              $toggleLink(null);
              return true;
            }
            const { url, ...attributes } =
              typeof payload === "string" ? { url: payload } : payload;
            $toggleLink(url, attributes);
            const links = new Set<LinkNode>();
            // a link at the root (around a figure or a rule) is unwrapped
            for (const node of $getRoot().getChildren()) {
              if ($isLinkNode(node)) {
                links.add(node);
              }
            }
            for (const image of images) {
              const link = $findMatchingParent(image, $isLinkNode);
              if ($isLinkNode(link)) {
                links.add(link);
              }
            }
            $keepImagesOutOfLinks(links);
            return true;
          },
          COMMAND_PRIORITY_NORMAL
        ),
        // a copy or cut marks its selection, for the code block's export
        editor.registerCommand(
          COPY_COMMAND,
          () => {
            markRichTextCopy($getSelection());
            return false;
          },
          COMMAND_PRIORITY_CRITICAL
        ),
        editor.registerCommand(
          CUT_COMMAND,
          () => {
            markRichTextCopy($getSelection());
            return false;
          },
          COMMAND_PRIORITY_CRITICAL
        )
      ),
    [editor]
  );
  return null;
};

const LinkRulePlugin = () => {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          CONTROLLED_TEXT_INSERTION_COMMAND,
          (payload) => {
            if (typeof payload === "string" || payload.dataTransfer === null) {
              return false;
            }
            const clean = withoutRefusedLinks(payload.dataTransfer);
            if (clean === undefined) {
              return false;
            }
            payload.preventDefault();
            editor.dispatchCommand(
              CONTROLLED_TEXT_INSERTION_COMMAND,
              new InputEvent(payload.type, {
                inputType: payload.inputType,
                dataTransfer: clean,
              })
            );
            return true;
          },
          COMMAND_PRIORITY_LOW
        ),
        // a drag inside the editor carries its nodes, as a copy does
        editor.registerCommand(
          DRAGSTART_COMMAND,
          (event) => {
            const selection = $getSelection();
            if (event.dataTransfer !== null && selection !== null) {
              const content = $getLexicalContent(editor, selection);
              if (content !== null) {
                event.dataTransfer.setData(LEXICAL_CLIPBOARD_TYPE, content);
              }
            }
            return false;
          },
          COMMAND_PRIORITY_CRITICAL
        ),
        editor.registerCommand(
          PASTE_COMMAND,
          (event) => {
            if (
              objectKlassEquals(event, ClipboardEvent) === false ||
              (event as ClipboardEvent).clipboardData === null
            ) {
              return false;
            }
            const clean = withoutRefusedLinks(
              (event as ClipboardEvent).clipboardData as DataTransfer
            );
            if (clean === undefined) {
              return false;
            }
            event.preventDefault();
            editor.dispatchCommand(
              PASTE_COMMAND,
              new ClipboardEvent("paste", { clipboardData: clean })
            );
            return true;
          },
          COMMAND_PRIORITY_LOW
        )
      ),
    [editor]
  );
  return null;
};

/** A save in flight turns editing off. */
const EditablePlugin = ({ editable }: { editable: boolean }) => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  return null;
};

export type RichTextFieldProps = {
  id: string;
  /** The field's label: a contenteditable takes its name from it. */
  labelId: string;
  describedBy?: string;
  value: unknown;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: CmsRichTextValue | null) => void;
  onOpenClassic?: () => void;
  /** E9, for the toolbar's Image; without it the toolbar has no Image. */
  source?: Pick<CmsSource, "uploadImage">;
  onError?: (error: string | undefined) => void;
  onBusyChange?: (busy: boolean) => void;
  onRefusal?: (refusal: CmsRefusal) => void;
};

/**
 * The live editor's nodes: the value's, and the code block's line indent,
 * which Enter in a code block can create.
 */
const editorNodes = [...richTextNodes];

export const RichTextField = ({
  id,
  labelId,
  describedBy,
  value,
  disabled = false,
  invalid,
  onChange,
  onOpenClassic,
  source,
  onError,
  onBusyChange,
  onRefusal,
}: RichTextFieldProps) => {
  // read once: a new value remounts the field (FieldControl's remountKey)
  const [initial] = useState(() => readRichTextValue(value));
  const [namespace] = useState(() => `cms-rich-text-${crypto.randomUUID()}`);
  const [readOnlyReason] = useState(() =>
    getRichTextReadOnlyReason(initial?.html ?? "")
  );
  // Classic CMS opens a value with images read-only too: no button
  const [hasImage] = useState(() => richTextHasImage(initial?.html ?? ""));
  // the load is the composer's first update; once mounted, editing follows
  const isLoading = useRef(true);
  useEffect(() => {
    isLoading.current = false;
  }, []);

  if (readOnlyReason !== undefined) {
    return (
      <Grid gap="1" data-cms-rich-text-read-only={readOnlyReason}>
        <div className={frameStyle()} data-disabled>
          <Text
            id={id}
            aria-labelledby={labelId}
            css={{ padding: theme.spacing[5], whiteSpace: "pre-wrap" }}
          >
            {initial?.text ?? ""}
          </Text>
        </div>
        <Flex align="center" gap="2" css={{ flexWrap: "wrap" }}>
          <Text color="destructive">
            {hasImage ? "Read only" : "Edit in Classic CMS"}
          </Text>
          {hasImage === false && onOpenClassic !== undefined && (
            <Button color="neutral" onClick={onOpenClassic}>
              Classic CMS
            </Button>
          )}
        </Flex>
      </Grid>
    );
  }

  return (
    <LexicalComposer
      initialConfig={{
        // one per field: Lexical reads copied nodes, images included, only
        // from this field's own copy, cut or drag
        namespace,
        theme: editorTheme,
        nodes: editorNodes,
        html: richTextHtmlConfig,
        editable: disabled === false,
        // while the value loads, a failure reaches the load boundary; after
        // it, one is reported, not rethrown, so Lexical keeps the state
        // before the failed update and nothing half-applied is saved
        onError: (error) => {
          if (isLoading.current) {
            throw error;
          }
          console.error(error);
        },
        // The composer tags this update "history-merge", which the change
        // plugin skips: loading writes nothing.
        editorState: (editor) =>
          importRichTextHtml(editor, initial?.html ?? ""),
      }}
    >
      <div
        className={frameStyle()}
        data-invalid={invalid || undefined}
        data-disabled={disabled || undefined}
        data-cms-rich-text
      >
        <Toolbar
          id={id}
          disabled={disabled}
          upload={
            source === undefined
              ? undefined
              : { source, onError, onBusyChange, onRefusal }
          }
        />
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              id={id}
              className={contentStyle()}
              ariaLabelledBy={labelId}
              ariaDescribedBy={describedBy}
              ariaInvalid={invalid || undefined}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <EditablePlugin editable={disabled === false} />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <LinkRulePlugin />
        <ImageEditingPlugin />
        <HorizontalRulePlugin />
        <TransformsPlugin />
        <OnChangePlugin
          ignoreSelectionChange
          ignoreHistoryMergeTagChange
          onChange={(editorState, editor) => {
            const html = exportRichTextHtml(editor);
            editorState.read(() => {
              const text = $getRoot().getTextContent();
              // no value only with neither text nor an image
              onChange(
                text.trim() === "" && /<img\b/i.test(html) === false
                  ? null
                  : { html, text }
              );
            });
          }}
        />
      </div>
    </LexicalComposer>
  );
};
