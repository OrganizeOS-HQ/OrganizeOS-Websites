import { RepeatGridIcon } from "@webstudio-is/icons/svg";
import {
  ws,
  css,
  PlaceholderValue,
  type TemplateMeta,
} from "@webstudio-is/template";
import { organizeos } from "./shared/proxy";

/**
 * Convergence Field (spec 3, 4.4, 10.9): the root on the brand's night
 * background, a Band 3:1 field box by default, holding a centred content Box
 * (a heading and a line of text) in the clear zone, whose default (60% by 50%
 * of the box) fits that content. The field's props are left at the runtime's
 * defaults, so the template draws the shared fixture's `default-band` case.
 */
export const meta: TemplateMeta = {
  category: "hidden",
  label: "Convergence Field",
  description: "A section over the brand's field of arms",
  icon: RepeatGridIcon,
  template: (
    <organizeos.ConvergenceField
      ws:style={css`
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 560px;
        padding: 80px 24px;
        background-color: #0b1a1f;
        color: #f4efe6;
      `}
    >
      <ws.element
        ws:tag="div"
        ws:label="Content"
        ws:style={css`
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 22px;
          max-width: 640px;
          text-align: center;
        `}
      >
        <ws.element
          ws:tag="h2"
          ws:style={css`
            margin: 0;
            font-size: 40px;
            line-height: 48px;
            font-weight: 600;
          `}
        >
          {new PlaceholderValue("Everything your people do, together")}
        </ws.element>
        <ws.element
          ws:tag="p"
          ws:style={css`
            margin: 0;
            font-size: 18px;
            line-height: 28px;
          `}
        >
          {
            new PlaceholderValue(
              "A line about what brings them here, centred in the clear zone."
            )
          }
        </ws.element>
      </ws.element>
    </organizeos.ConvergenceField>
  ),
};
