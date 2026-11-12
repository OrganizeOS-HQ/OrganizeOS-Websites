/**
 * The rich text control (4.3.3.1): a `LexicalComposer` in the builder
 * document, never the canvas's text editor. Its node set and HTML are
 * `rich-text-html.ts`'s; `field-controls.tsx` loads this module lazily, so
 * Lexical stays out of the builder's first load.
 *
 * A value the editor would not keep whole (images, or a block shape its
 * export does not reproduce) opens read-only, so nothing is lost silently.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type TextFormatType,
} from "lexical";
import { $isLinkNode, TOGGLE_LINK_COMMAND, type LinkNode } from "@lexical/link";
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
  HeadingNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import { $createCodeNode, $isCodeNode, CodeHighlightNode } from "@lexical/code";
import { $setBlocksType } from "@lexical/selection";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
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
  Tooltip,
} from "@webstudio-is/design-system";
import {
  BoldIcon,
  LinkIcon,
  ListIcon,
  MinusIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
} from "@webstudio-is/icons";
import type { CmsRichTextValue } from "./cms-source";
import {
  exportRichTextHtml,
  getRichTextReadOnlyReason,
  importRichTextHtml,
  readRichTextValue,
  richTextHref,
  richTextHtmlConfig,
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

const setBlockType = (editor: LexicalEditor, block: BlockType) => {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection) === false) {
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
  });
  editor.focus();
};

/** The heading tags the site keeps: h1 becomes h2, h5 and h6 become h4. */
const allowedHeadingTag = (tag: HeadingTagType): HeadingTagType =>
  tag === "h1" ? "h2" : tag === "h5" || tag === "h6" ? "h4" : tag;

const HeadingTagPlugin = () => {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      editor.registerNodeTransform(HeadingNode, (node) => {
        const tag = allowedHeadingTag(node.getTag());
        if (tag === node.getTag()) {
          return;
        }
        const heading = $createHeadingNode(tag);
        heading.setFormat(node.getFormatType());
        heading.setIndent(node.getIndent());
        heading.setDirection(node.getDirection());
        node.replace(heading, true);
      }),
    [editor]
  );
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

/** One `role="toolbar"` row, on upstream's `MarkdownToolbar` pattern. */
const Toolbar = ({ id, disabled }: { id: string; disabled: boolean }) => {
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
};

/**
 * The live editor's nodes: the value's, and the code block's line indent,
 * which Enter in a code block can create.
 */
const editorNodes = [...richTextNodes, CodeHighlightNode];

export const RichTextField = ({
  id,
  labelId,
  describedBy,
  value,
  disabled = false,
  invalid,
  onChange,
  onOpenClassic,
}: RichTextFieldProps) => {
  // read once: a new value remounts the field (FieldControl's remountKey)
  const [initial] = useState(() => readRichTextValue(value));
  const [readOnlyReason] = useState(() =>
    getRichTextReadOnlyReason(initial?.html ?? "")
  );

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
            {readOnlyReason === "images"
              ? "Has images; edit in Classic CMS"
              : "Edit in Classic CMS"}
          </Text>
          {onOpenClassic !== undefined && (
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
        namespace: "cms-rich-text",
        theme: editorTheme,
        nodes: editorNodes,
        html: richTextHtmlConfig,
        editable: disabled === false,
        onError: (error) => {
          throw error;
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
        <Toolbar id={id} disabled={disabled} />
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
        <HorizontalRulePlugin />
        <HeadingTagPlugin />
        <OnChangePlugin
          ignoreSelectionChange
          ignoreHistoryMergeTagChange
          onChange={(editorState, editor) => {
            const html = exportRichTextHtml(editor);
            editorState.read(() => {
              const text = $getRoot().getTextContent();
              // an editable value holds no image: blank text is no value
              onChange(text.trim() === "" ? null : { html, text });
            });
          }}
        />
      </div>
    </LexicalComposer>
  );
};
