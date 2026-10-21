import { useContext, type CSSProperties } from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";

// Builder chrome, not designer content: fixed inline styles, so no style or
// token on the site changes how a warning reads.
const boxStyle: CSSProperties = {
  boxSizing: "border-box",
  margin: "0 0 8px",
  padding: "8px 12px",
  border: "1px solid #f59e0b",
  borderRadius: "4px",
  background: "#fffbeb",
  color: "#78350f",
  font: "12px/1.4 system-ui, sans-serif",
  textAlign: "left",
};

// A note is information, not a fault: a quieter box than the warning's.
const noteBoxStyle: CSSProperties = {
  ...boxStyle,
  border: "1px solid #93c5fd",
  background: "#eff6ff",
  color: "#1e3a8a",
};

const titleStyle: CSSProperties = { fontWeight: 600 };

const listStyle: CSSProperties = { margin: "4px 0 0", paddingLeft: "16px" };

/**
 * The canvas check: a warning a root draws on itself while it lacks a part
 * it needs, or sits where it cannot work. Renders only on the builder's
 * canvas, so nothing of it reaches the preview or a published site.
 *
 * `notes` are for what the designer may want to know and need not fix, such as
 * what a visitor sees on the live site. They get their own, quieter box, and
 * never make the block "need attention".
 */
export const CanvasCheck = ({
  title,
  problems,
  notes = [],
}: {
  title: string;
  problems: readonly string[];
  notes?: readonly string[];
}) => {
  const { renderer } = useContext(ReactSdkContext);
  if (renderer !== "canvas" || (problems.length === 0 && notes.length === 0)) {
    return null;
  }
  return (
    <>
      {problems.length > 0 && (
        <div data-organizeos-canvas-check="" style={boxStyle}>
          <div style={titleStyle}>{title} needs attention</div>
          <ul style={listStyle}>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      {notes.length > 0 && (
        <div data-organizeos-canvas-note="" style={noteBoxStyle}>
          <div style={titleStyle}>{title} notes</div>
          <ul style={listStyle}>
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};
