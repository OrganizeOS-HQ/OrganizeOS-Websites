import type { ReactNode } from "react";
import type { CSS } from "../stitches.config";
import { Chip } from "./chip";

// OrganizeOS fork: plans are org entitlements with no checkout in the
// builder, so the chip is a label, not a link to a pricing page
// (docs/ORGANIZEOS-FORK.md section 7).
export const ProChip = ({
  css,
  children,
}: {
  children: ReactNode;
  css?: CSS;
}) => {
  return <Chip css={css}>{children}</Chip>;
};
