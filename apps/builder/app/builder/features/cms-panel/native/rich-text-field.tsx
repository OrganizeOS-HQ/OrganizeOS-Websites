/**
 * The rich text control (4.3.3.1): a `LexicalComposer` in the builder
 * document, never the canvas's text editor.
 *
 * W2 adds `@lexical/rich-text`, `@lexical/list`, `@lexical/html` and
 * `@lexical/code` as direct dependencies (spec 4.3.3.1). Until then this
 * control registers only what already resolves from `apps/builder`
 * (`lexical`, `@lexical/link`, `@lexical/react`): paragraphs, the text
 * formats, links, line breaks and the divider. W2 then
 * - registers `HeadingNode` (h2 to h4), `QuoteNode`, `ListNode`,
 *   `ListItemNode` and the code block, and turns on the block-type select
 *   and the list buttons, which stay disabled here;
 * - swaps `importRichTextHtml` and `exportRichTextHtml` for
 *   `$generateNodesFromDOM` and `$generateHtmlFromNodes`.
 * A value holding a tag this node set cannot keep opens read-only, so
 * nothing is lost silently.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type TextFormatType,
} from "lexical";
import {
  $createLinkNode,
  $isLinkNode,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from "@lexical/link";
import { mergeRegister } from "@lexical/utils";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
  INSERT_HORIZONTAL_RULE_COMMAND,
} from "@lexical/react/LexicalHorizontalRuleNode";
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
  Separator,
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

/** Lexical takes class name strings; stitches gives each from `.className`. */
const editorTheme = {
  paragraph: css({ margin: 0, marginBottom: theme.spacing[5] })().className,
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
      background: cssVar("--background-secondary"),
      borderRadius: theme.borderRadius[2],
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
  },
});

const toolbarStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing[1],
  padding: theme.spacing[2],
  borderBottom: `1px solid ${cssVar("--background-primary")}`,
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

const blockTypes = ["paragraph", "h2", "h3", "h4", "quote", "code"] as const;

const blockTypeLabels: Record<(typeof blockTypes)[number], string> = {
  paragraph: "Paragraph",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  quote: "Quote",
  code: "Code",
};

/** The tags this node set keeps; any other block opens read-only. */
const IMAGE_TAGS = "img, figure, figcaption";
const UNKEPT_TAGS = "h1, h2, h3, h4, h5, h6, blockquote, ul, ol, pre, table";

export type RichTextReadOnlyReason = "images" | "unsupported";

export const getRichTextReadOnlyReason = (
  html: string
): RichTextReadOnlyReason | undefined => {
  if (html === "" || typeof DOMParser === "undefined") {
    return;
  }
  // An inert document: never inserted into the live page.
  const body = new DOMParser().parseFromString(html, "text/html").body;
  if (body.querySelector(IMAGE_TAGS) !== null) {
    return "images";
  }
  if (body.querySelector(UNKEPT_TAGS) !== null) {
    return "unsupported";
  }
};

const formatTags: Array<[string, TextFormatType]> = [
  ["STRONG", "bold"],
  ["B", "bold"],
  ["EM", "italic"],
  ["I", "italic"],
  ["U", "underline"],
  ["S", "strikethrough"],
  ["DEL", "strikethrough"],
  ["STRIKE", "strikethrough"],
  ["CODE", "code"],
];

const importInline = (
  node: Node,
  formats: TextFormatType[],
  parent: ElementNode
) => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (text !== "") {
      const textNode = $createTextNode(text);
      for (const format of formats) {
        textNode.toggleFormat(format);
      }
      parent.append(textNode);
    }
    return;
  }
  if (node instanceof Element === false) {
    return;
  }
  if (node.tagName === "BR") {
    parent.append($createLineBreakNode());
    return;
  }
  if (node.tagName === "A") {
    const link = $createLinkNode(node.getAttribute("href") ?? "", {
      target: node.getAttribute("target"),
      rel: node.getAttribute("rel"),
      title: node.getAttribute("title"),
    });
    for (const child of node.childNodes) {
      importInline(child, formats, link);
    }
    parent.append(link);
    return;
  }
  const format = formatTags.find(([tag]) => tag === node.tagName)?.[1];
  const nextFormats = format === undefined ? formats : [...formats, format];
  for (const child of node.childNodes) {
    importInline(child, nextFormats, parent);
  }
};

/** W2: `$generateNodesFromDOM`. Runs inside an editor update. */
export const importRichTextHtml = (html: string) => {
  const root = $getRoot();
  root.clear();
  const body = new DOMParser().parseFromString(html, "text/html").body;
  let loose: ElementNode | undefined;
  for (const child of body.childNodes) {
    if (child instanceof Element && child.tagName === "P") {
      loose = undefined;
      const paragraph = $createParagraphNode();
      for (const inline of child.childNodes) {
        importInline(inline, [], paragraph);
      }
      root.append(paragraph);
    } else if (child instanceof Element && child.tagName === "HR") {
      loose = undefined;
      root.append($createHorizontalRuleNode());
    } else {
      if (loose === undefined) {
        loose = $createParagraphNode();
        root.append(loose);
      }
      importInline(child, [], loose);
    }
  }
  if (root.getChildrenSize() === 0) {
    root.append($createParagraphNode());
  }
};

const escapeText = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttribute = (text: string) =>
  escapeText(text).replace(/"/g, "&quot;");

const formatWrappers: Array<[TextFormatType, string]> = [
  ["code", "code"],
  ["strikethrough", "s"],
  ["underline", "u"],
  ["italic", "em"],
  ["bold", "strong"],
];

const exportInline = (node: LexicalNode): string => {
  if ($isLineBreakNode(node)) {
    return "<br>";
  }
  if ($isTextNode(node)) {
    let html = escapeText(node.getTextContent());
    for (const [format, tag] of formatWrappers) {
      if (node.hasFormat(format)) {
        html = `<${tag}>${html}</${tag}>`;
      }
    }
    return html;
  }
  if ($isLinkNode(node)) {
    const attributes = [
      `href="${escapeAttribute(node.getURL())}"`,
      node.getTarget()
        ? `target="${escapeAttribute(node.getTarget() ?? "")}"`
        : "",
      node.getRel() ? `rel="${escapeAttribute(node.getRel() ?? "")}"` : "",
      node.getTitle()
        ? `title="${escapeAttribute(node.getTitle() ?? "")}"`
        : "",
    ].filter(Boolean);
    return `<a ${attributes.join(" ")}>${node
      .getChildren()
      .map(exportInline)
      .join("")}</a>`;
  }
  if ($isElementNode(node)) {
    return node.getChildren().map(exportInline).join("");
  }
  return "";
};

/** W2: `$generateHtmlFromNodes`. Runs inside an editor read. */
export const exportRichTextHtml = () =>
  $getRoot()
    .getChildren()
    .map((node) => {
      if ($isHorizontalRuleNode(node)) {
        return "<hr>";
      }
      if ($isParagraphNode(node)) {
        return `<p>${node.getChildren().map(exportInline).join("")}</p>`;
      }
      return exportInline(node);
    })
    .join("");

const readValue = (value: unknown): CmsRichTextValue | undefined =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as CmsRichTextValue).html === "string"
    ? (value as CmsRichTextValue)
    : undefined;

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

type ActiveFormats = Record<
  "bold" | "italic" | "underline" | "strikethrough" | "link",
  boolean
>;

const useActiveFormats = (editor: LexicalEditor) => {
  const [active, setActive] = useState<ActiveFormats>({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    link: false,
  });
  useEffect(() => {
    const read = () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) === false) {
        return;
      }
      const anchor = selection.anchor.getNode();
      setActive({
        bold: selection.hasFormat("bold"),
        italic: selection.hasFormat("italic"),
        underline: selection.hasFormat("underline"),
        strikethrough: selection.hasFormat("strikethrough"),
        link: $isLinkNode(anchor) || $isLinkNode(anchor.getParent()),
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
  return active;
};

const LinkButton = ({
  active,
  disabled,
}: {
  active: boolean;
  disabled: boolean;
}) => {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [newTab, setNewTab] = useState(false);

  const readLink = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) === false) {
        return;
      }
      const anchor = selection.anchor.getNode();
      const link = $isLinkNode(anchor)
        ? anchor
        : $isLinkNode(anchor.getParent())
          ? (anchor.getParent() as LinkNode)
          : undefined;
      setUrl(link?.getURL() ?? "");
      setNewTab(link?.getTarget() === "_blank");
    });
  };

  const apply = () => {
    const href = url.trim();
    editor.dispatchCommand(
      TOGGLE_LINK_COMMAND,
      href === ""
        ? null
        : newTab
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
            aria-label="Address"
            placeholder="https://"
            autoFocus
            value={url}
            onChange={(event) => setUrl(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                apply();
              }
            }}
          />
          <Flex align="center" justify="between" gap="2">
            <Flex align="center" gap="2">
              <Switch
                id="cms-link-new-tab"
                checked={newTab}
                onCheckedChange={setNewTab}
              />
              <Label htmlFor="cms-link-new-tab">New tab</Label>
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
const Toolbar = ({ disabled }: { disabled: boolean }) => {
  const [editor] = useLexicalComposerContext();
  const active = useActiveFormats(editor);
  const format = (type: TextFormatType) =>
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  return (
    <div className={toolbarStyle()} role="toolbar" aria-label="Formatting">
      <Select
        aria-label="Block type"
        options={blockTypes}
        value="paragraph"
        getLabel={(option) =>
          blockTypeLabels[option as (typeof blockTypes)[number]]
        }
        // W2: on once the block nodes are registered
        disabled
        css={{ width: theme.spacing[25] }}
      />
      <Separator orientation="vertical" css={{ height: theme.spacing[9] }} />
      <ToolbarButton
        label="Bold"
        active={active.bold}
        disabled={disabled}
        onClick={() => format("bold")}
      >
        <BoldIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={active.italic}
        disabled={disabled}
        onClick={() => format("italic")}
      >
        <TextItalicIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={active.underline}
        disabled={disabled}
        onClick={() => format("underline")}
      >
        <TextUnderlineIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={active.strikethrough}
        disabled={disabled}
        onClick={() => format("strikethrough")}
      >
        <TextStrikethroughIcon />
      </ToolbarButton>
      <Separator orientation="vertical" css={{ height: theme.spacing[9] }} />
      {/* W2: on once ListNode and ListItemNode are registered */}
      <ToolbarButton label="Bulleted list" disabled>
        <ListIcon fill="currentColor" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" disabled>
        {/* as upstream's MarkdownToolbar draws it */}
        <Text as="span" variant="mono">
          1.
        </Text>
      </ToolbarButton>
      <Separator orientation="vertical" css={{ height: theme.spacing[9] }} />
      <LinkButton active={active.link} disabled={disabled} />
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

export const RichTextField = ({
  id,
  value,
  disabled = false,
  invalid,
  onChange,
  onOpenClassic,
}: {
  id: string;
  value: unknown;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: CmsRichTextValue | null) => void;
  onOpenClassic?: () => void;
}) => {
  const initial = readValue(value);
  const [readOnlyReason] = useState(() =>
    getRichTextReadOnlyReason(initial?.html ?? "")
  );

  if (readOnlyReason !== undefined) {
    return (
      <Grid gap="1" data-cms-rich-text-read-only={readOnlyReason}>
        <div className={frameStyle()} data-disabled>
          <Text css={{ padding: theme.spacing[5], whiteSpace: "pre-wrap" }}>
            {initial?.text ?? ""}
          </Text>
        </div>
        <Flex align="center" gap="2">
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
        nodes: [LinkNode, HorizontalRuleNode],
        editable: disabled === false,
        onError: (error) => {
          throw error;
        },
        editorState: () => importRichTextHtml(initial?.html ?? ""),
      }}
    >
      <div
        className={frameStyle()}
        data-invalid={invalid || undefined}
        data-disabled={disabled || undefined}
        data-cms-rich-text
      >
        <Toolbar disabled={disabled} />
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              id={id}
              className={contentStyle()}
              aria-invalid={invalid || undefined}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <LinkPlugin />
        <HorizontalRulePlugin />
        <OnChangePlugin
          ignoreSelectionChange
          onChange={(editorState) => {
            editorState.read(() => {
              const html = exportRichTextHtml();
              const text = $getRoot().getTextContent().trim();
              const hasDivider = $getRoot()
                .getChildren()
                .some((node) => $isHorizontalRuleNode(node));
              onChange(
                text === "" && hasDivider === false ? null : { html, text }
              );
            });
          }}
        />
      </div>
    </LexicalComposer>
  );
};
