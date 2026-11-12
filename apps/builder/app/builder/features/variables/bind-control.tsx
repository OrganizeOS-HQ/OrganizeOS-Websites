import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { useStore } from "@nanostores/react";
import {
  Box,
  Flex,
  FloatingPanel,
  SmallIconButton,
  Tooltip,
  cssVar,
  declareCssVar,
} from "@webstudio-is/design-system";
import { DotIcon, PlusIcon } from "@webstudio-is/icons";
import type { CssProperty } from "@webstudio-is/css-engine";
import { isStyleSourceLocked } from "@webstudio-is/project-build/runtime";
import { $selectedStyleSource } from "~/shared/nano-states";
import type { ComputedStyleDecl } from "~/shared/style-object-model";
import { useComputedStyles } from "~/builder/features/style-panel/shared/model";
import { useReadonly } from "~/builder/features/style-panel/shared/readonly";
import { $variableDisplayNames } from "./reader";
import { getBindableTypes } from "./property-types";
import { BindPicker } from "./bind-picker";

// Its own name, so an ancestor BindingControl's hover cannot reveal it.
const opacityVar = declareCssVar("--variable-bind-opacity");

/** The shared variable name when every property of the row uses it. */
const boundNameOf = (styles: readonly ComputedStyleDecl[]) => {
  const first = styles[0]?.cascadedValue;
  if (first?.type !== "var") {
    return;
  }
  return styles.every(
    (decl) =>
      decl.cascadedValue.type === "var" &&
      decl.cascadedValue.value === first.value
  )
    ? first.value
    : undefined;
};

/**
 * The "+", or the dot of a bound row: copies the Settings panel's binding
 * button (builder/shared/binding-popover.tsx), placed past the label's end
 * so the label never reflows.
 */
const VariableBindButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    properties: readonly CssProperty[];
    isBound: boolean;
    tooltip: string | undefined;
  }
>(({ properties, isBound, tooltip, ...props }, ref) => (
  <Tooltip content={tooltip} delayDuration={0}>
    <SmallIconButton
      ref={ref}
      data-variable-bind={properties.join(" ")}
      data-variant={isBound ? "bound" : "default"}
      aria-label="Variables"
      bleed={false}
      css={{
        opacity: cssVar(opacityVar, "0"),
        position: "absolute",
        top: "50%",
        right: 0,
        zIndex: 1,
        boxSizing: "border-box",
        padding: 2,
        transform: "translate(100%, -50%) scale(1)",
        transition: "transform 60ms, opacity 0ms 60ms",
        // https://easings.net/#easeInOutSine
        transitionTimingFunction: "cubic-bezier(0.37, 0, 0.63, 1)",
        "&[data-variant=bound]": { opacity: 1 },
        "&:hover, &:focus-visible, &[aria-expanded=true]": {
          opacity: 1,
          transform: "translate(100%, -50%) scale(1.5)",
        },
      }}
      {...props}
      icon={
        <Box
          css={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: cssVar("--background-accent"),
            color: cssVar("--foreground-on-accent"),
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {isBound ? (
            <DotIcon size={7} style={{ color: "currentColor" }} />
          ) : (
            <PlusIcon size={8} style={{ color: "currentColor" }} />
          )}
        </Box>
      }
    />
  </Tooltip>
));
VariableBindButton.displayName = "VariableBindButton";

/**
 * Wraps a Style panel label (spec 6.1): a "+" that binds a variable to the
 * row's properties, where the row takes one (6.2, 6.3), and the dot of a
 * bound row (6.6). Nothing is added when the panel is read-only or the
 * selected source is a locked token, whose writes publishUpdates drops (6.7).
 */
export const VariableBindControl = ({
  properties,
  children,
}: {
  properties: readonly CssProperty[];
  children: ReactNode;
}) => {
  const readonly = useReadonly();
  const styleSource = useStore($selectedStyleSource);
  const styles = useComputedStyles([...properties]);
  const displayNames = useStore($variableDisplayNames);
  const [open, setOpen] = useState(false);
  // cheap, and a memo keyed on the array would trip exhaustive-deps
  const types = getBindableTypes(properties);
  if (readonly || isStyleSourceLocked(styleSource) || types === undefined) {
    return <>{children}</>;
  }
  const boundName = boundNameOf(styles);
  const tooltip =
    boundName === undefined || open
      ? undefined
      : (displayNames.get(boundName) ?? `--${boundName}`);
  return (
    <Flex
      align="center"
      css={{
        position: "relative",
        width: "fit-content",
        maxWidth: "100%",
        "&:hover, &:focus-within": { [opacityVar]: 1 },
      }}
    >
      {children}
      <FloatingPanel
        title="Variables"
        placement="left-start"
        anchor="trigger"
        open={open}
        onOpenChange={setOpen}
        content={
          <BindPicker
            properties={properties}
            types={types}
            styles={styles}
            bound={boundName === undefined ? undefined : { cssName: boundName }}
            onClose={() => setOpen(false)}
          />
        }
      >
        <VariableBindButton
          properties={properties}
          isBound={boundName !== undefined}
          tooltip={tooltip}
        />
      </FloatingPanel>
    </Flex>
  );
};
