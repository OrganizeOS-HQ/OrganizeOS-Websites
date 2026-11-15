import { SliderIcon } from "@webstudio-is/icons/svg";
import { ws, css, type TemplateMeta } from "@webstudio-is/template";
import { organizeos } from "../shared/proxy";
import {
  progressFillToken,
  progressLabelToken,
  progressTrackToken,
} from "./progress-tokens";

// Goal Progress (OrganizeOS builder donations spec 2026-11-13, 7.3): a bar
// whose fill is the root's --os-progress, then the raised, goal and donors
// figures. The insert binds `data` to the Fundraisers Resource at the root
// (apps/builder insert-organizeos-block.ts); `record` starts empty and the
// Give to row picks it.
export const goalProgressTemplate = () => (
  <organizeos.GoalProgress
    ws:label="Goal Progress"
    record=""
    showDonors={false}
    ws:style={css`
      display: flex;
      flex-direction: column;
      gap: 8px;
    `}
  >
    <ws.element
      ws:tag="div"
      ws:label="Track"
      aria-hidden="true"
      ws:tokens={[progressTrackToken]}
    >
      <ws.element
        ws:tag="div"
        ws:label="Fill"
        ws:tokens={[progressFillToken]}
      />
    </ws.element>
    <organizeos.GoalProgressFigure
      ws:label="Raised"
      figure="raised"
      ws:tokens={[progressLabelToken]}
    />
    <organizeos.GoalProgressFigure
      ws:label="Goal"
      figure="goal"
      ws:tokens={[progressLabelToken]}
    />
    <organizeos.GoalProgressFigure
      ws:label="Donors"
      figure="donors"
      ws:tokens={[progressLabelToken]}
    />
  </organizeos.GoalProgress>
);

export const meta: TemplateMeta = {
  category: "hidden",
  label: "Goal Progress",
  description: "Shows a fundraiser's progress to its goal",
  icon: SliderIcon,
  template: goalProgressTemplate(),
};
