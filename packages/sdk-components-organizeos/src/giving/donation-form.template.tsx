import { EmbedIcon } from "@webstudio-is/icons/svg";
import {
  ws,
  css,
  PlaceholderValue,
  type TemplateMeta,
} from "@webstudio-is/template";
import {
  formCardToken,
  formHeadingToken,
  formIntroToken,
} from "../shared/form-tokens";
import { organizeos } from "../shared/proxy";

// The Donation Form (OrganizeOS builder donations spec 2026-11-13, 7.2): look
// A's card, a heading and an intro the designer edits on the canvas, and the
// frame. The insert writes organizationId and platformOrigin
// (apps/builder giving-insert.ts); the heading names no org, since the
// builder's site record holds none (plan F1, F-D6).
export const donationFormTemplate = () => (
  <organizeos.DonationForm
    ws:label="Donation Form"
    target="general"
    afterGift="message"
    state="ready"
    ws:tokens={[formCardToken]}
    ws:style={css`
      display: flex;
      flex-direction: column;
      gap: 16px;
    `}
  >
    <ws.element ws:tag="h2" ws:tokens={[formHeadingToken]}>
      {new PlaceholderValue("Support our work")}
    </ws.element>
    <ws.element ws:tag="p" ws:label="Intro" ws:tokens={[formIntroToken]}>
      {new PlaceholderValue("Every gift powers our work.")}
    </ws.element>
    <organizeos.DonationFrame ws:label="Frame" />
  </organizeos.DonationForm>
);

export const meta: TemplateMeta = {
  category: "hidden",
  label: "Donation Form",
  description: "Takes a gift on the page",
  icon: EmbedIcon,
  template: donationFormTemplate(),
};
