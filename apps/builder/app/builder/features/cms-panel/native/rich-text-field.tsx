/**
 * The rich text control (4.3.3.1): a `LexicalComposer` in the builder
 * document, never the canvas's text editor.
 *
 * W2 adds `@lexical/rich-text`, `@lexical/list`, `@lexical/html` and
 * `@lexical/code` as direct dependencies (spec 4.3.3.1). Until then this
 * control registers only what already resolves from `apps/builder`
 * (`lexical`, `@lexical/link`, `@lexical/react`): paragraphs, the text
 * formats, links, line breaks and the divider, and its toolbar offers only
 * those. W2 then
 * - registers `HeadingNode` (h2 to h4), `QuoteNode`, `ListNode`,
 *   `ListItemNode` and the code block, and adds the block-type `Select` and
 *   the two list buttons to the toolbar;
 * - swaps `importRichTextHtml` and `exportRichTextHtml`
 *   (`rich-text-html.ts`) for `$generateNodesFromDOM` and
 *   `$generateHtmlFromNodes`.
 * A value holding a tag this node set cannot keep opens read-only, so
 * nothing is lost silently.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type LexicalEditor,
  type TextFormatType,
} from "lexical";
import { $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
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
  Switch,
  Text,
  textVariants,
  theme,
  Tooltip,
} from "@webstudio-is/design-system";
import {
  BoldIcon,
  LinkIcon,
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
} from "./rich-text-html";

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
    color: cssVar("--foreground-disabled"),
  },
});

const toolbarStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing[1],
  padding: theme.spacing[2],
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

/**
 * One `role="toolbar"` row, on upstream's `MarkdownToolbar` pattern: only
 * the controls this node set can apply (the module comment says what W2
 * adds).
 */
const Toolbar = ({ disabled }: { disabled: boolean }) => {
  const [editor] = useLexicalComposerContext();
  const active = useActiveFormats(editor);
  const format = (type: TextFormatType) =>
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  return (
    <div className={toolbarStyle()} role="toolbar" aria-label="Formatting">
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

/** `editable` is read once at mount; a save in flight turns it off. */
const EditablePlugin = ({ editable }: { editable: boolean }) => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  return null;
};

export const RichTextField = ({
  id,
  labelId,
  describedBy,
  value,
  disabled = false,
  invalid,
  onChange,
  onOpenClassic,
}: {
  id: string;
  /** The field's label: a contenteditable takes its name from it. */
  labelId: string;
  describedBy?: string;
  value: unknown;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: CmsRichTextValue | null) => void;
  onOpenClassic?: () => void;
}) => {
  const initial = readRichTextValue(value);
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
              ariaLabelledBy={labelId}
              ariaDescribedBy={describedBy}
              ariaInvalid={invalid || undefined}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <EditablePlugin editable={disabled === false} />
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
