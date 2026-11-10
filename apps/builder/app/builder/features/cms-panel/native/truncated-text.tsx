import { useRef, useState, type ComponentProps } from "react";
import { Text, Tooltip } from "@webstudio-is/design-system";

/**
 * One line of text that truncates, with the whole of it in a tooltip only
 * while it is cut off (4.4). Measured when the tooltip would open, so a
 * resize never leaves it stale.
 */
export const TruncatedText = ({
  children,
  css,
  ...props
}: Omit<ComponentProps<typeof Text>, "children" | "truncate"> & {
  children: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <Tooltip
      content={children}
      delayDuration={600}
      open={open}
      onOpenChange={(next) => {
        const element = ref.current;
        setOpen(
          next && element !== null && element.scrollWidth > element.clientWidth
        );
      }}
    >
      <Text ref={ref} truncate css={css} {...props}>
        {children}
      </Text>
    </Tooltip>
  );
};
