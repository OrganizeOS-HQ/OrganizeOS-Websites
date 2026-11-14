/**
 * The rich text value's images (spec 4.6): an inline `CmsImageNode` for an
 * `img`, so an image in a paragraph, a link, a list item or a heading keeps
 * its place, and a block `CmsFigureNode` for a `figure` holding an `img` and,
 * when the value had one, a `figcaption` of plain text. Each writes exactly
 * the tags and attributes the platform's sanitiser keeps: `src`, `alt`,
 * `width`, `height` and `title` on the `img`.
 *
 * An image enters a value only from its stored HTML or an upload: the HTML
 * import keeps one only while a stored value loads (`importStoredImages`), so
 * pasted HTML keeps none.
 */
import { useEffect, useId, useState } from "react";
import {
  $applyNodeReplacement,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { mergeRegister } from "@lexical/utils";
import {
  Button,
  css,
  cssVar,
  Flex,
  Grid,
  InputField,
  Label,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Text,
  theme,
} from "@webstudio-is/design-system";

/** The `img` attributes the platform keeps, each as stored (null: absent). */
export type CmsImageAttributes = {
  src: string;
  alt: string | null;
  width: string | null;
  height: string | null;
  title: string | null;
};

const attributeNames = ["src", "alt", "width", "height", "title"] as const;

let isImportingStoredValue = false;

/** Runs `load` with the HTML import keeping images: a stored value's load. */
export const importStoredImages = <Result,>(load: () => Result): Result => {
  const previous = isImportingStoredValue;
  isImportingStoredValue = true;
  try {
    return load();
  } finally {
    isImportingStoredValue = previous;
  }
};

const readAttributes = (image: Element): CmsImageAttributes => ({
  src: image.getAttribute("src") ?? "",
  alt: image.getAttribute("alt"),
  width: image.getAttribute("width"),
  height: image.getAttribute("height"),
  title: image.getAttribute("title"),
});

const writeImage = (attributes: CmsImageAttributes) => {
  const image = document.createElement("img");
  for (const name of attributeNames) {
    const value = attributes[name];
    if (value !== null) {
      image.setAttribute(name, value);
    }
  }
  return image;
};

const isBlank = (node: Node) =>
  node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() === "";

/**
 * A figure the block node keeps whole: an `img` and at most one `figcaption`
 * after it, holding only text. Any other figure is left to the import's
 * other rules, and the read-only rule sees what that loses.
 */
const readFigure = (
  figure: Element
): { image: Element; caption: string | null } | undefined => {
  const parts = Array.from(figure.childNodes).filter(
    (child) => isBlank(child) === false
  );
  const [image, caption, ...rest] = parts;
  if (
    image instanceof Element === false ||
    image.tagName !== "IMG" ||
    rest.length > 0
  ) {
    return;
  }
  if (caption === undefined) {
    return { image, caption: null };
  }
  if (
    caption instanceof Element === false ||
    caption.tagName !== "FIGCAPTION" ||
    Array.from(caption.childNodes).some(
      (child) => child.nodeType !== Node.TEXT_NODE
    )
  ) {
    return;
  }
  return { image, caption: caption.textContent ?? "" };
};

const imageStyle = css({
  maxWidth: "100%",
  height: "auto",
  verticalAlign: "bottom",
  cursor: "default",
  borderRadius: theme.borderRadius[2],
  "&[data-selected]": {
    outline: `2px solid ${cssVar("--border-focus")}`,
    outlineOffset: 1,
  },
});

const inlineStyle = css({ display: "inline-block", maxWidth: "100%" });

const figureStyle = css({
  display: "grid",
  gap: theme.spacing[2],
  justifyItems: "start",
  margin: 0,
  marginBottom: theme.spacing[5],
});

type ImageViewProps = {
  nodeKey: NodeKey;
  attributes: CmsImageAttributes;
  /** A figure's caption; undefined for an inline image. */
  caption?: string | null;
};

const ImageView = ({ nodeKey, attributes, caption }: ImageViewProps) => {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const [isOpen, setIsOpen] = useState(false);
  const altId = useId();
  const captionId = useId();

  // the settings open on a click only: a keyboard selection of the image
  // (an arrow key, Backspace beside it) keeps the keyboard in the text
  // With the image selected, Backspace and Delete remove it.
  useEffect(
    () =>
      mergeRegister(
        ...[KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND].map((command) =>
          editor.registerCommand(
            command,
            (event: KeyboardEvent | null) => {
              const selection = $getSelection();
              if (
                isSelected === false ||
                $isNodeSelection(selection) === false ||
                selection.has(nodeKey) === false
              ) {
                return false;
              }
              event?.preventDefault();
              $getNodeByKey(nodeKey)?.remove();
              return true;
            },
            COMMAND_PRIORITY_LOW
          )
        )
      ),
    [editor, isSelected, nodeKey]
  );

  // Alt and Caption keep their text here while typed, so the caret stays
  // where it is; each change is written to the node as it is made
  const [alt, setAlt] = useState(attributes.alt ?? "");
  const [captionText, setCaptionText] = useState(caption ?? "");
  useEffect(() => {
    if (isOpen) {
      setAlt(attributes.alt ?? "");
      setCaptionText(caption ?? "");
    }
    // the node's values are read when the settings open, not on each write
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const edit = (change: (node: CmsImageNode | CmsFigureNode) => void) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isCmsImageNode(node) || $isCmsFigureNode(node)) {
        change(node);
      }
    });
  };

  return (
    <Popover open={isOpen && isEditable} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <img
          className={imageStyle()}
          src={attributes.src}
          alt={attributes.alt ?? ""}
          title={attributes.title ?? undefined}
          width={attributes.width ?? undefined}
          height={attributes.height ?? undefined}
          draggable={false}
          data-selected={(isSelected && isEditable) || undefined}
          onClick={(event) => {
            if (isEditable === false) {
              return;
            }
            event.preventDefault();
            clearSelection();
            setSelected(true);
            setIsOpen(true);
          }}
        />
      </PopoverAnchor>
      {typeof caption === "string" && caption !== "" && (
        <Text color="subtle">{caption}</Text>
      )}
      <PopoverContent
        align="start"
        css={{ width: theme.spacing[33], padding: theme.panel.padding }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.focus();
        }}
      >
        <Grid gap="2">
          <Grid
            align="center"
            gap="2"
            css={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}
          >
            <Label htmlFor={altId}>Alt</Label>
            <InputField
              id={altId}
              autoFocus
              value={alt}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setAlt(next);
                edit((node) => node.setAlt(next));
              }}
            />
            {caption !== undefined && (
              <>
                <Label htmlFor={captionId}>Caption</Label>
                <InputField
                  id={captionId}
                  value={captionText}
                  onChange={(event) => {
                    const text = event.currentTarget.value;
                    setCaptionText(text);
                    edit((node) => {
                      if ($isCmsFigureNode(node)) {
                        node.setCaption(text);
                      }
                    });
                  }}
                />
              </>
            )}
          </Grid>
          <Flex justify="end">
            <Button
              color="ghost"
              onClick={() => {
                setIsOpen(false);
                edit((node) => node.remove());
              }}
            >
              Remove
            </Button>
          </Flex>
        </Grid>
      </PopoverContent>
    </Popover>
  );
};

export type SerializedCmsImageNode = Spread<
  { attributes: CmsImageAttributes },
  SerializedLexicalNode
>;

export class CmsImageNode extends DecoratorNode<JSX.Element> {
  __attributes: CmsImageAttributes;

  static getType() {
    return "cms-image";
  }

  static clone(node: CmsImageNode) {
    return new CmsImageNode(node.__attributes, node.__key);
  }

  static importJSON(serialized: SerializedCmsImageNode) {
    return $createCmsImageNode(serialized.attributes);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () =>
        isImportingStoredValue
          ? {
              conversion: (element): DOMConversionOutput => ({
                node: $createCmsImageNode(readAttributes(element)),
              }),
              priority: 0,
            }
          : null,
    };
  }

  constructor(attributes: CmsImageAttributes, key?: NodeKey) {
    super(key);
    this.__attributes = attributes;
  }

  exportJSON(): SerializedCmsImageNode {
    return {
      type: CmsImageNode.getType(),
      version: 1,
      attributes: this.getAttributes(),
    };
  }

  exportDOM(): DOMExportOutput {
    return { element: writeImage(this.getAttributes()) };
  }

  createDOM(_config: EditorConfig) {
    const span = document.createElement("span");
    span.className = inlineStyle();
    return span;
  }

  updateDOM() {
    return false;
  }

  isInline() {
    return true;
  }

  getAttributes() {
    return this.getLatest().__attributes;
  }

  setAlt(alt: string) {
    const writable = this.getWritable();
    writable.__attributes = { ...writable.__attributes, alt };
  }

  decorate(_editor: LexicalEditor) {
    return <ImageView nodeKey={this.getKey()} attributes={this.__attributes} />;
  }
}

export const $createCmsImageNode = (attributes: CmsImageAttributes) =>
  $applyNodeReplacement(new CmsImageNode(attributes));

export const $isCmsImageNode = (
  node: LexicalNode | null | undefined
): node is CmsImageNode => node instanceof CmsImageNode;

export type SerializedCmsFigureNode = Spread<
  { attributes: CmsImageAttributes; caption: string | null },
  SerializedLexicalNode
>;

export class CmsFigureNode extends DecoratorNode<JSX.Element> {
  __attributes: CmsImageAttributes;
  __caption: string | null;

  static getType() {
    return "cms-figure";
  }

  static clone(node: CmsFigureNode) {
    return new CmsFigureNode(node.__attributes, node.__caption, node.__key);
  }

  static importJSON(serialized: SerializedCmsFigureNode) {
    return $createCmsFigureNode(serialized.attributes, serialized.caption);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      figure: (element) => {
        // only a figure at the value's top level is kept whole: a nested
        // one imports through the other rules and reads as lossy
        if (
          isImportingStoredValue === false ||
          element.parentElement?.tagName !== "BODY"
        ) {
          return null;
        }
        const figure = readFigure(element);
        return figure === undefined
          ? null
          : {
              conversion: (): DOMConversionOutput => ({
                node: $createCmsFigureNode(
                  readAttributes(figure.image),
                  figure.caption
                ),
                after: () => [],
              }),
              priority: 1,
            };
      },
    };
  }

  constructor(
    attributes: CmsImageAttributes,
    caption: string | null,
    key?: NodeKey
  ) {
    super(key);
    this.__attributes = attributes;
    this.__caption = caption;
  }

  exportJSON(): SerializedCmsFigureNode {
    return {
      type: CmsFigureNode.getType(),
      version: 1,
      attributes: this.getAttributes(),
      caption: this.getCaption(),
    };
  }

  exportDOM(): DOMExportOutput {
    const figure = document.createElement("figure");
    figure.appendChild(writeImage(this.getAttributes()));
    const caption = this.getCaption();
    if (caption !== null) {
      const figcaption = document.createElement("figcaption");
      figcaption.textContent = caption;
      figure.appendChild(figcaption);
    }
    return { element: figure };
  }

  createDOM(_config: EditorConfig) {
    const div = document.createElement("div");
    div.className = figureStyle();
    return div;
  }

  updateDOM() {
    return false;
  }

  isInline() {
    return false;
  }

  getTextContent() {
    return this.getCaption() ?? "";
  }

  getAttributes() {
    return this.getLatest().__attributes;
  }

  getCaption() {
    return this.getLatest().__caption;
  }

  setAlt(alt: string) {
    const writable = this.getWritable();
    writable.__attributes = { ...writable.__attributes, alt };
  }

  setCaption(caption: string) {
    this.getWritable().__caption = caption;
  }

  decorate(_editor: LexicalEditor) {
    return (
      <ImageView
        nodeKey={this.getKey()}
        attributes={this.__attributes}
        caption={this.__caption}
      />
    );
  }
}

export const $createCmsFigureNode = (
  attributes: CmsImageAttributes,
  caption: string | null
) => $applyNodeReplacement(new CmsFigureNode(attributes, caption));

export const $isCmsFigureNode = (
  node: LexicalNode | null | undefined
): node is CmsFigureNode => node instanceof CmsFigureNode;
