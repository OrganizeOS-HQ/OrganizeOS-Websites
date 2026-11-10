import { Button, Flex, Text, theme } from "@webstudio-is/design-system";
import type { CmsRefusal } from "./cms-logic";

/** 4.3.4: one line and its buttons, no cards, no paragraphs. */
const refusalLines: Record<CmsRefusal | "unavailable", string> = {
  unauthorized: "Signed out of OrganizeOS",
  mfa_required: "Two-step sign-in required",
  forbidden: "No access to the CMS",
  plan: "Not in your plan",
  unavailable: "Try again in a minute",
};

export type CmsLineKind = CmsRefusal | "unavailable";

export const RefusalLine = ({
  kind,
  homeUrl,
  onRetry,
}: {
  kind: CmsLineKind;
  /** The builder menu's "Back to OrganizeOS" address. */
  homeUrl?: string;
  onRetry?: () => void;
}) => {
  const canSignIn = kind === "unauthorized" || kind === "mfa_required";
  const canRetry = canSignIn || kind === "unavailable";
  return (
    <Flex
      align="center"
      gap="2"
      data-cms-refusal={kind}
      css={{ minHeight: theme.spacing[13], flexWrap: "wrap" }}
    >
      <Text color="destructive">{refusalLines[kind]}</Text>
      {canSignIn && homeUrl !== undefined && (
        <Button
          color="neutral"
          onClick={() => {
            window.open(homeUrl, "_blank", "noopener,noreferrer");
          }}
        >
          Open OrganizeOS
        </Button>
      )}
      {canRetry && onRetry !== undefined && (
        <Button color="neutral" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Flex>
  );
};
