import type { ReactNode } from "react";
import { Button, css, cssVar, Text, theme } from "@webstudio-is/design-system";
import type { CmsRefusal } from "./cms-logic";

/**
 * The one row every warning line sits in, under the header or the top of
 * the main area: a refusal, the conflict, a load that failed.
 */
const lineRowStyle = css({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  columnGap: theme.spacing[5],
  minHeight: theme.spacing[15],
  flexShrink: 0,
  paddingInline: theme.panel.paddingInline,
  borderBottom: `1px solid ${cssVar("--border-default")}`,
});

export const LineRow = ({
  children,
  ...props
}: {
  children: ReactNode;
  [data: `data-${string}`]: string | boolean | undefined;
}) => (
  <div className={lineRowStyle()} {...props}>
    {children}
  </div>
);

export type CmsLineKind = CmsRefusal | "unavailable" | "not_found";

/** 4.3.4: one line and its buttons, no cards, no paragraphs. */
const lines: Record<CmsLineKind, string> = {
  unauthorized: "Signed out of OrganizeOS",
  mfa_required: "Two-step sign-in required",
  forbidden: "No access to the CMS",
  plan: "Not in your plan",
  unavailable: "Try again in a minute",
  not_found: "Item not found",
};

/**
 * The buttons are per code (4.3.4):
 * - `unauthorized`: "Open OrganizeOS", which sends this tab home after the
 *   unsaved guard. No Retry: signing in again makes a new session id.
 * - `mfa_required`: "Open OrganizeOS" in a new tab, then Retry.
 * - `forbidden` and `unavailable`: Retry.
 * - `plan` and `not_found`: none.
 */
export const RefusalLine = ({
  kind,
  homeUrl,
  onOpenHome,
  onRetry,
}: {
  kind: CmsLineKind;
  /** The builder menu's "Back to OrganizeOS" address. */
  homeUrl?: string;
  /** `unauthorized`: the guard, then this tab to `homeUrl`. */
  onOpenHome?: () => void;
  onRetry?: () => void;
}) => (
  <LineRow data-cms-refusal={kind}>
    <Text color="destructive">{lines[kind]}</Text>
    {kind === "unauthorized" && onOpenHome !== undefined && (
      <Button color="neutral" onClick={onOpenHome}>
        Open OrganizeOS
      </Button>
    )}
    {kind === "mfa_required" && homeUrl !== undefined && (
      <Button
        color="neutral"
        onClick={() => {
          window.open(homeUrl, "_blank", "noopener,noreferrer");
        }}
      >
        Open OrganizeOS
      </Button>
    )}
    {(kind === "mfa_required" ||
      kind === "forbidden" ||
      kind === "unavailable") &&
      onRetry !== undefined && (
        <Button color="neutral" onClick={onRetry}>
          Retry
        </Button>
      )}
  </LineRow>
);
