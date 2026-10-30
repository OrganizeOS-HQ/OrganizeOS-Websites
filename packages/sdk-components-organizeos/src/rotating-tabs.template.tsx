import { RefreshCcwIcon } from "@webstudio-is/icons/svg";
import {
  ws,
  ActionValue,
  css,
  expression,
  PlaceholderValue,
  Variable,
  type TemplateMeta,
} from "@webstudio-is/template";
import { organizeos, radix } from "./shared/proxy";

const triggerStyle = css`
  padding: 8px 16px;
  border: 1px solid #d4d4d8;
  border-radius: 10px;
  background-color: #ffffff;
  color: #18181b;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid #18181b;
    outline-offset: 2px;
  }
  &[data-state="active"] {
    border-color: #18181b;
    background-color: #18181b;
    color: #ffffff;
  }
`;

const contentStyle = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px;
  border-radius: 16px;
  background-color: #f4f4f5;
  color: #18181b;
  &:focus-visible {
    outline: 2px solid #18181b;
    outline-offset: 2px;
  }
  &[data-state="inactive"] {
    display: none;
  }
`;

const headingStyle = css`
  margin: 0;
  font-size: 24px;
  line-height: 32px;
`;

const textStyle = css`
  margin: 0;
`;

// One function per part, each called per tab: the template's children are
// listed one by one, since `renderTemplate` reads no nested arrays.
const trigger = (label: string) => (
  <radix.TabsTrigger ws:style={triggerStyle}>
    {new PlaceholderValue(label)}
  </radix.TabsTrigger>
);

const panelText = "Say what this audience gets from you, in a sentence or two.";

const content = (heading: string) => (
  <radix.TabsContent forceMount={true} ws:style={contentStyle}>
    <ws.element ws:tag="h3" ws:style={headingStyle}>
      {new PlaceholderValue(heading)}
    </ws.element>
    <ws.element ws:tag="p" ws:style={textStyle}>
      {new PlaceholderValue(panelText)}
    </ws.element>
  </radix.TabsContent>
);

/**
 * Rotating Tabs (spec 4.2): upstream's Tabs with a Rotation Control as its
 * first child. The control drives the Tabs through their one public seam, the
 * `value` prop: both read the variable activeTab, and the control's
 * onValueChange sets it. Triggers and Contents keep upstream's index values
 * ("0", "1", "2"), since rotation advances by index.
 *
 * Every Content is force-mounted, so every `aria-controls` target exists and
 * every panel's text is in the server markup; Radix leaves force-mounted
 * panels visible, so each Content's Inactive state is `display: none`.
 *
 * Radii are the closed scale's: 16px for the panels, 10px for what sits in
 * them (the tab pills and the button).
 *
 * A function, not a constant: a site template places the block once per
 * placement, and `renderTemplate` keys a data source by its Variable, so each
 * call needs a Variable of its own to scope activeTab to its own root.
 */
export const rotatingTabsTemplate = () => {
  const activeTab = new Variable("activeTab", "0");
  return (
    <radix.Tabs
      value={expression`${activeTab}`}
      ws:style={css`
        display: flex;
        flex-direction: column;
        gap: 16px;
      `}
    >
      <organizeos.RotationControl
        value={expression`${activeTab}`}
        onValueChange={
          new ActionValue(["value"], expression`${activeTab} = value`)
        }
        ws:style={css`
          align-self: flex-start;
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
      <radix.TabsList
        aria-label="Audiences"
        ws:style={css`
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        `}
      >
        {trigger("Organizers")}
        {trigger("Volunteers")}
        {trigger("Supporters")}
      </radix.TabsList>
      {content("For organizers")}
      {content("For volunteers")}
      {content("For supporters")}
    </radix.Tabs>
  );
};

export const meta: TemplateMeta = {
  category: "hidden",
  label: "Rotating Tabs",
  description: "Tabs that rotate on their own",
  icon: RefreshCcwIcon,
  template: rotatingTabsTemplate(),
};
