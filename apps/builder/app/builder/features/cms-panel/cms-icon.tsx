import { forwardRef } from "react";
import type { IconComponent } from "@webstudio-is/icons";

/**
 * The CMS's rail icon: a database, three stacked cylinder bands, drawn to
 * upstream's 16px icon grid with a 1px currentColor stroke. Upstream has no
 * database icon. It takes upstream's IconComponent props (`size`, `color`
 * and any SVG attribute) the way its generated icons do, so the rail renders
 * it like the others.
 */
export const CmsIcon: IconComponent = forwardRef(
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
        <ellipse
          cx="8"
          cy="3.75"
          rx="5.5"
          ry="2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.5 3.75v8.5c0 1.105 2.462 2 5.5 2s5.5-.895 5.5-2v-8.5"
        />
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.5 6.583c0 1.105 2.462 2 5.5 2s5.5-.895 5.5-2M2.5 9.417c0 1.105 2.462 2 5.5 2s5.5-.895 5.5-2"
        />
      </svg>
    );
  }
);
CmsIcon.displayName = "CmsIcon";
