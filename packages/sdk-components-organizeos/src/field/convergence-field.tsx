import {
  forwardRef,
  useContext,
  useId,
  useRef,
  type ComponentProps,
  type CSSProperties,
  type ElementRef,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { canPlayOnCanvasProperty } from "../animate/flag";
import { CanvasCheck } from "../form/canvas-check";
import { useMergedRef } from "../form/merge-ref";
import {
  ARM_CENTRE_TRANSFORM,
  ARM_PATH,
  armTransform,
  convergenceField,
  LEVELS,
  levelStyle,
  type FieldArm,
} from "./generate";
import { clampField, type FieldProps } from "./shape";
import { useSettle } from "./use-settle";

type Props = Omit<ComponentProps<"div">, keyof FieldProps> &
  FieldProps & {
    /** the canvas play flag, set by the builder while the instance is selected */
    [canPlayOnCanvasProperty]?: boolean;
  };

// Decorative, behind the root's children: the root's preset makes it the
// containing block and a stacking context (position relative, isolation).
const svgStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  zIndex: -1,
  pointerEvents: "none",
};

const levels = Array.from({ length: LEVELS }, (_, index) => index + 1);

/**
 * The settle turn lives on the two arm groups, not on each arm (spec 10.2,
 * plan amendment 1): the CSS `rotate` composes after the path's centring
 * transform, so the arm turns about its centre, and `--os-field-settle`
 * (registered and animated by the settle, inherited through each `use`) is 0
 * at rest. Unset, the `calc` is invalid and the rotation is none, so the field
 * is exactly the homepage's.
 */
const settleStyle = (sign: 1 | -1): CSSProperties => ({
  rotate: `calc(var(--os-field-settle) * ${sign * 45}deg)`,
});

/** The arm's grid parity, from its offset to the focus in grid steps. */
const isEven = (arm: FieldArm, focusX: number, focusY: number, step: number) =>
  Math.abs(
    Math.round((arm.x - focusX) / step) + Math.round((arm.y - focusY) / step)
  ) %
    2 ===
  0;

/**
 * Convergence Field: draws the brand's field of the mark's arms behind its
 * children (spec 4.1, 10.1, 10.2). The SVG is generated in the render from
 * the props and a fixed box, identically on the server and the client, so the
 * field is complete without JavaScript and hydrates without measuring.
 */
export const ConvergenceField = forwardRef<ElementRef<"div">, Props>(
  (
    {
      shape,
      density,
      focusX,
      focusY,
      zoneWidth,
      zoneHeight,
      innerColor,
      outerColor,
      motion,
      // the settle reads it (part A's play flag); never an attribute
      [canPlayOnCanvasProperty]: canPlayOnCanvas,
      children,
      ...props
    },
    ref
  ) => {
    // For the `id`s of the arm groups and the `href`s that reference them
    // only, never in a CSS `url()`: React's ids hold colons, which a
    // `url(#…)` would need escaped.
    const id = useId();
    const plusId = `${id}-arm-plus`;
    const minusId = `${id}-arm-minus`;
    const field = clampField({
      shape,
      density,
      focusX,
      focusY,
      zoneWidth,
      zoneHeight,
      innerColor,
      outerColor,
      motion,
    });
    const { renderer } = useContext(ReactSdkContext);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const mergedRef = useMergedRef(ref, rootRef);
    const svgRef = useRef<SVGSVGElement | null>(null);
    // part A's rule; the field has no action, so nothing pins it
    const canPlay = renderer !== "canvas" || canPlayOnCanvas === true;
    const notes = useSettle({
      svgRef,
      rootRef,
      motion: field.motion,
      canPlay,
    });
    const arms = convergenceField(
      field.width,
      field.height,
      field.spacing,
      field.focus,
      field.zone
    );
    return (
      <div {...props} ref={mergedRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${field.width} ${field.height}`}
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          focusable="false"
          style={svgStyle}
        >
          <defs>
            <g id={plusId} style={settleStyle(1)}>
              <path d={ARM_PATH} transform={ARM_CENTRE_TRANSFORM} />
            </g>
            <g id={minusId} style={settleStyle(-1)}>
              <path d={ARM_PATH} transform={ARM_CENTRE_TRANSFORM} />
            </g>
          </defs>
          {levels.map((level) => {
            const style = levelStyle(level, field.outerColor, field.innerColor);
            return (
              <g
                key={level}
                style={{ fill: style.fill }}
                opacity={style.opacity}
              >
                {arms
                  .filter((arm) => arm.level === level)
                  .map((arm) => (
                    <use
                      key={`${arm.x},${arm.y}`}
                      href={`#${
                        isEven(arm, field.focus.x, field.focus.y, field.spacing)
                          ? plusId
                          : minusId
                      }`}
                      transform={armTransform(arm)}
                    />
                  ))}
              </g>
            );
          })}
        </svg>
        {children}
        <CanvasCheck title="Convergence Field" problems={[]} notes={notes} />
      </div>
    );
  }
);

ConvergenceField.displayName = "ConvergenceField";
