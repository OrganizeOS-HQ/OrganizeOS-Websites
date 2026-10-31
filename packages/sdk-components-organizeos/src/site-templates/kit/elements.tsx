import { cloneElement } from "react";
import { ws, type TemplateStyleDecl } from "@webstudio-is/template";
import { sample } from "./sample";

// Two small pieces every template builds its pages with: a list of
// children built conditionally, and an element of sample text.

/**
 * A list of children, keyed for React's list check, for an element whose
 * children are built conditionally: the renderer takes one flat list, not a
 * nested one.
 */
export const keyed = (elements: JSX.Element[]): JSX.Element[] =>
  elements.map((element, index) => cloneElement(element, { key: index }));

/** Sample text in a tag, unstyled beyond the given styles. */
export const text = (
  tag: string,
  styles: TemplateStyleDecl[],
  value: string,
  label?: string
): JSX.Element => (
  <ws.element
    ws:tag={tag}
    {...(label === undefined ? {} : { "ws:label": label })}
    ws:style={styles}
  >
    {sample(value)}
  </ws.element>
);
