import { forwardRef } from "react";
import type { IconComponent } from "@webstudio-is/icons";

/**
 * The Variables rail icon: two swatches beside two lines of a list, drawn to
 * upstream's 16px icon grid with a 1px currentColor stroke. It takes
 * upstream's IconComponent props (`size`, `color` and any SVG attribute) the
 * way its generated icons do, so the rail renders it like the others.
 */
export const VariablesIcon: IconComponent = forwardRef(
  ({ fill = "none", size = 16, ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill={fill}
        {...props}
        ref={forwardedRef}
      >
        <rect
          x="2.5"
          y="2.5"
          width="4"
          height="4"
          rx="1"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="2.5"
          y="9.5"
          width="4"
          height="4"
          rx="1"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 4.5h4.5M9 11.5h4.5"
        />
      </svg>
    );
  }
);
VariablesIcon.displayName = "VariablesIcon";
