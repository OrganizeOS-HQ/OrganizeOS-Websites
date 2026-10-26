import { forwardRef } from "react";
import type { IconComponent } from "@webstudio-is/icons";

/**
 * The OrganizeOS product mark (v3, the converging arrows) in brand teal on a
 * transparent canvas, used where upstream rendered the Webstudio logo (login,
 * builder topbar menu, loading screen, error page); teal reads on both the
 * light dashboard and the dark topbar. Served from /organizeos-icon.svg in
 * public/, a copy of the OrganizeOS repo's
 * client/public/brand/organizeos-favicon.svg (vector, crisp at every size).
 * Drop-in for WebstudioIcon's size prop.
 */
export const OrganizeosLogo = ({ size = 22 }: { size?: number }) => {
  return (
    <img
      src="/organizeos-icon.svg"
      alt="OrganizeOS"
      width={size}
      height={size}
      style={{ display: "block" }}
    />
  );
};

/**
 * The same mark as an icon (the paths of /organizeos-icon.svg), for chrome that
 * takes @webstudio-is/icons components, such as the left sidebar's tabs. It
 * paints in currentColor like the icons beside it. The mark's drawing fills
 * 0 to 128.25 edge to edge; the padded viewBox draws it 13px wide in the 16px
 * box, the width those line icons' ink spans (a 12px path plus a 1px stroke),
 * so its arrow stems end where the Plus icon's strokes do.
 */
export const OrganizeosIcon: IconComponent = forwardRef(
  ({ fill = "currentColor", size = 16, ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-14.8 -14.8 157.85 157.85"
        width={size}
        height={size}
        fill={fill}
        {...props}
        ref={forwardedRef}
      >
        <path d="M77.92,45.07l23.7-23.7c1.17-1.17,1.17-3.07,0-4.24l-5.44-5.44c-1.17-1.17-3.07-1.17-4.24,0l-15.52,15.52c-1.52,1.52-2.56,3.45-3,5.56l-.96,4.68c-.18.88-1.48.75-1.48-.15V3c0-1.66-1.34-3-3-3h-7.69c-1.66,0-3,1.34-3,3v34.28c0,.9-1.3,1.04-1.48.15l-.96-4.68c-.43-2.11-1.48-4.04-3-5.56l-15.52-15.52c-1.17-1.17-3.07-1.17-4.24,0l-5.44,5.44c-1.17,1.17-1.17,3.07,0,4.24l23.7,23.7c1.27,1.27,2.99,1.98,4.78,1.98h18.01c1.79,0,3.51-.71,4.78-1.98Z" />
        <path d="M50.34,83.2l-23.7,23.7c-1.17,1.17-1.17,3.07,0,4.24l5.44,5.44c1.17,1.17,3.07,1.17,4.24,0l15.52-15.52c1.52-1.52,2.56-3.45,3-5.56l.96-4.68c.18-.88,1.48-.75,1.48.15v35.27c0,1.11.9,2.01,2.01,2.01h9.67c1.11,0,2.01-.9,2.01-2.01v-35.27c0-.9,1.3-1.04,1.48-.15l.96,4.68c.43,2.11,1.48,4.04,3,5.56l15.52,15.52c1.17,1.17,3.07,1.17,4.24,0l5.44-5.44c1.17-1.17,1.17-3.07,0-4.24l-23.7-23.7c-1.27-1.27-2.99-1.98-4.78-1.98h-18.01c-1.79,0-3.51.71-4.78,1.98Z" />
        <path d="M83.19,77.92l23.7,23.7c1.17,1.17,3.07,1.17,4.24,0l5.44-5.44c1.17-1.17,1.17-3.07,0-4.24l-15.52-15.52c-1.52-1.52-3.45-2.56-5.56-3l-4.68-.96c-.88-.18-.75-1.48.15-1.48h34.28c1.66,0,3-1.34,3-3v-7.69c0-1.66-1.34-3-3-3h-34.28c-.9,0-1.04-1.3-.15-1.48l4.68-.96c2.11-.43,4.04-1.48,5.56-3l15.52-15.52c1.17-1.17,1.17-3.07,0-4.24l-5.44-5.44c-1.17-1.17-3.07-1.17-4.24,0l-23.7,23.7c-1.27,1.27-1.98,2.99-1.98,4.78v18.01c0,1.79.71,3.51,1.98,4.78Z" />
        <path d="M45.07,50.34l-23.7-23.7c-1.17-1.17-3.07-1.17-4.24,0l-5.44,5.44c-1.17,1.17-1.17,3.07,0,4.24l15.52,15.52c1.52,1.52,3.45,2.56,5.56,3l4.68.96c.88.18.75,1.48-.15,1.48H3c-1.66,0-3,1.34-3,3v7.69c0,1.66,1.34,3,3,3h34.28c.9,0,1.04,1.3.15,1.48l-4.68.96c-2.11.43-4.04,1.48-5.56,3l-15.52,15.52c-1.17,1.17-1.17,3.07,0,4.24l5.44,5.44c1.17,1.17,3.07,1.17,4.24,0l23.7-23.7c1.27-1.27,1.98-2.99,1.98-4.78v-18.01c0-1.79-.71-3.51-1.98-4.78Z" />
      </svg>
    );
  }
);
OrganizeosIcon.displayName = "OrganizeosIcon";
