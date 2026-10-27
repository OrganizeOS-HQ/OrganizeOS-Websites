import { ArrowRightLeftIcon } from "@webstudio-is/icons/svg";
import {
  ws,
  css,
  PlaceholderValue,
  type TemplateMeta,
} from "@webstudio-is/template";
import { organizeos } from "./shared/proxy";

/**
 * Marquee (spec 4.1, 4.3, 12.11): the root clips the x axis only, so focus
 * rings and shadows are not cut off vertically; its Pause button comes first;
 * the track holds five static items in a row as wide as they are, which the
 * runtime drifts in a loop on the published page.
 *
 * Radii are the closed scale's: 10px for the button and the items.
 */
const itemStyle = css`
  flex: none;
  padding: 12px 20px;
  border: 1px solid #d4d4d8;
  border-radius: 10px;
  background-color: #ffffff;
  color: #18181b;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
`;

// One function per item: `renderTemplate` reads no nested arrays.
const item = (label: string) => (
  <ws.element ws:tag="div" ws:style={itemStyle}>
    {new PlaceholderValue(label)}
  </ws.element>
);

export const meta: TemplateMeta = {
  category: "hidden",
  label: "Marquee",
  description: "A row of items drifting in a loop",
  icon: ArrowRightLeftIcon,
  template: (
    <organizeos.Marquee
      ws:style={css`
        overflow-x: clip;
        overflow-y: visible;
      `}
    >
      <organizeos.MarqueePauseButton
        ws:style={css`
          margin: 0 0 12px;
          padding: 4px 12px;
          border: 1px solid #d4d4d8;
          border-radius: 10px;
          background-color: #ffffff;
          color: #18181b;
          font-size: 14px;
          line-height: 20px;
          cursor: pointer;
          &:focus-visible {
            outline: 2px solid #18181b;
            outline-offset: 2px;
          }
        `}
      />
      <organizeos.MarqueeTrack
        ws:style={css`
          display: flex;
          gap: 16px;
          width: max-content;
        `}
      >
        {item("Item 1")}
        {item("Item 2")}
        {item("Item 3")}
        {item("Item 4")}
        {item("Item 5")}
      </organizeos.MarqueeTrack>
    </organizeos.Marquee>
  ),
};
