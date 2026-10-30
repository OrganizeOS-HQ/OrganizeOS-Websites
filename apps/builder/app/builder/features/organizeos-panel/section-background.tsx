import {
  forwardRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
} from "react";
import { computed } from "nanostores";
import { useStore } from "@nanostores/react";
import { toValue } from "@webstudio-is/css-engine";
import { ROOT_INSTANCE_ID } from "@webstudio-is/sdk";
// The names file only: the site-templates index carries the catalog and its
// images, which must stay out of the Style panel.
import { CANONICAL_COLOR_NAMES } from "@organizeos/site-components/site-templates/canonical-variables";
import {
  theme,
  styled,
  Flex,
  FloatingPanel,
  Text,
  Tooltip,
} from "@webstudio-is/design-system";
import {
  $registeredComponentMetas,
  $selectedInstanceSelector,
  $selectedPage,
} from "~/shared/nano-states";
import {
  $instances,
  $styleSourceSelections,
  $styles,
} from "~/shared/sync/data-stores";
import type { InstanceSelector } from "~/shared/instance-utils/tree";
import { AssetManager } from "~/builder/shared/asset-manager";
import { AssetUpload } from "~/builder/shared/assets";
import { $matchingBreakpoints } from "~/builder/features/style-panel/shared/model";
import { luminance } from "./backgrounds/color";
import {
  builtInPalette,
  presets,
  type Palette,
  type PaletteColor,
  type Preset,
  type PresetId,
  type PresetStyles,
} from "./backgrounds/presets";
import { applyPreset } from "./backgrounds/apply-preset";
import {
  buildSectionStyleModel,
  listRootColorVariables,
} from "./backgrounds/style-model";
import { useDeferredContrastReport } from "./contrast-schedule";

/**
 * The content of the Style panel's Background presets section
 * (background-presets-section.tsx; spec 3.1, panel overhaul spec 5.2): a row
 * of preset thumbnails, each named in a tooltip, colored from Global Root's
 * color variables or the built-in palette. A click applies one through
 * `applyPreset`, as local styles; an Image with scrim preset opens the image
 * picker first. Under the row, one line of text when text inside fails AA
 * after a scheduled run (contrast-schedule.ts). Nothing else: the canvas shows
 * the result (CLAUDE.md, "Builder UI: options, not explanations").
 */

/**
 * The selected element when it can take a section background: not nothing,
 * not Global Root, not the page root (the Body), and still in the tree.
 */
export const $sectionSelector = computed(
  [$selectedInstanceSelector, $instances, $selectedPage],
  (selector, instances, page): InstanceSelector | undefined => {
    if (selector === undefined || selector.length === 0) {
      return;
    }
    const [instanceId] = selector;
    if (instanceId === ROOT_INSTANCE_ID) {
      return;
    }
    if (page !== undefined && instanceId === page.rootInstanceId) {
      return;
    }
    const instance = instances.get(instanceId);
    if (instance === undefined || instance.component === "Body") {
      return;
    }
    return selector;
  }
);

/** Global Root's color variables, the same on every page. */
const $rootColorVariables = computed(
  [
    $styles,
    $styleSourceSelections,
    $matchingBreakpoints,
    $registeredComponentMetas,
  ],
  () => listRootColorVariables(buildSectionStyleModel([ROOT_INSTANCE_ID]))
);

type Role = "base" | "accent1" | "accent2" | "text";

/**
 * The variable each role takes. When the four canonical site variables are
 * all there (site templates, spec 6.3) each role takes its own by name, so a
 * dark theme keeps its dark base. Otherwise the lightest takes the base, the
 * darkest the text, and the others in the order they are defined.
 */
export const getDefaultRoles = (
  variables: PaletteColor[]
): Partial<Record<Role, string>> => {
  if (variables.length === 0) {
    return {};
  }
  const names = new Set(variables.map((color) => color.variable));
  if (CANONICAL_COLOR_NAMES.every((name) => names.has(name))) {
    return {
      base: "base",
      accent1: "accent-1",
      accent2: "accent-2",
      text: "text",
    };
  }
  const byLuminance = [...variables].sort(
    (a, b) => luminance(a.rgba) - luminance(b.rgba)
  );
  const text = byLuminance[0].variable;
  const base = byLuminance.at(-1)!.variable;
  const rest = variables.filter(
    (color) => color.variable !== base && color.variable !== text
  );
  const accent1 = (rest[0] ?? variables[0]).variable;
  const accent2 = (rest[1] ?? rest[0] ?? variables[0]).variable;
  return { base, accent1, accent2, text };
};

/** The presets' palette: the root variables in their default roles. */
const $palette = computed($rootColorVariables, (variables): Palette => {
  if (variables.length === 0) {
    return builtInPalette;
  }
  const roles = getDefaultRoles(variables);
  const pick = (role: Role) =>
    variables.find((color) => color.variable === roles[role])!;
  return {
    base: pick("base"),
    accent1: pick("accent1"),
    accent2: pick("accent2"),
    text: pick("text"),
  };
});

/** The palette with its variables dropped, for thumbnails in the builder UI. */
const toLiteralPalette = (palette: Palette): Palette => ({
  base: { rgba: palette.base.rgba },
  accent1: { rgba: palette.accent1.rgba },
  accent2: { rgba: palette.accent2.rgba },
  text: palette.text && { rgba: palette.text.rgba },
});

// Stands in for the image under a scrim preset's thumbnail.
const imagePlaceholder = "linear-gradient(135deg, #3a3a3a 0%, #d8d8d8 100%)";

/** A preset's own CSS as an inline style, for its thumbnail. */
export const getThumbnailStyle = (
  preset: Preset,
  palette: Palette
): CSSProperties => {
  const style: Record<string, string> = {};
  const styles: PresetStyles = preset.build(toLiteralPalette(palette));
  for (const { property, value } of styles) {
    const key = property.replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase()
    );
    style[key] = toValue(value);
  }
  if (preset.family === "image-scrim") {
    const append = (key: string, value: string) => {
      style[key] = style[key] ? `${style[key]}, ${value}` : value;
    };
    append("backgroundImage", imagePlaceholder);
    append("backgroundPositionX", "0%");
    append("backgroundPositionY", "0%");
    append("backgroundSize", "auto");
    append("backgroundRepeat", "no-repeat");
    append("backgroundAttachment", "scroll");
    append("backgroundClip", "border-box");
    append("backgroundOrigin", "padding-box");
    append("backgroundBlendMode", "normal");
  }
  return style;
};

// As many columns of at least 28px as fit, so the row wraps in any width.
const PresetGrid = styled("div", {
  display: "grid",
  gridTemplateColumns: `repeat(auto-fill, minmax(${theme.spacing[12]}, 1fr))`,
  gap: theme.spacing[4],
});

const PresetButton = styled("button", {
  all: "unset",
  boxSizing: "border-box",
  display: "block",
  width: "100%",
  aspectRatio: "1",
  borderRadius: theme.borderRadius[2],
  border: `1px solid ${theme.colors.borderMain}`,
  cursor: "pointer",
  "&:hover": { borderColor: theme.colors.borderFocus },
  "&:focus-visible": {
    outline: `1px solid ${theme.colors.borderFocus}`,
    outlineOffset: 1,
  },
});

/**
 * A preset's thumbnail as a button, its label in a tooltip that opens on hover
 * and on keyboard focus. The design system's Tooltip, and so EnhancedTooltip,
 * drops its trigger's focus, so the focus is handled here. It forwards its ref
 * and props so the image picker's trigger can wrap it.
 */
const PresetThumbnail = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button"> & { preset: Preset; palette: Palette }
>(({ preset, palette, onFocus, ...props }, ref) => {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip content={preset.label} open={open} onOpenChange={setOpen}>
      <PresetButton
        {...props}
        ref={ref}
        type="button"
        aria-label={preset.label}
        data-preset={preset.id}
        style={getThumbnailStyle(preset, palette)}
        onFocus={(event) => {
          onFocus?.(event);
          setOpen(event.currentTarget.matches(":focus-visible"));
        }}
      />
    </Tooltip>
  );
});
PresetThumbnail.displayName = "PresetThumbnail";

export const SectionBackground = () => {
  const selector = useStore($sectionSelector);
  const report = useDeferredContrastReport(selector);
  const palette = useStore($palette);
  const [picking, setPicking] = useState<PresetId>();

  if (selector === undefined) {
    return;
  }

  return (
    <Flex
      direction="column"
      gap="2"
      css={{ paddingInline: theme.panel.paddingInline }}
    >
      <PresetGrid data-preset-grid>
        {presets.map((preset) =>
          preset.family === "image-scrim" ? (
            <FloatingPanel
              key={preset.id}
              title="Images"
              titleSuffix={<AssetUpload type="image" />}
              content={
                <AssetManager
                  accept="image/*"
                  onChange={(imageAssetId) => {
                    applyPreset(preset.build(palette, { imageAssetId }));
                    setPicking(undefined);
                  }}
                />
              }
              open={picking === preset.id}
              // The dialog reports a change a frame late, and on touch one
              // picker's dismiss can land after the next one opened: a close
              // clears only its own picker.
              onOpenChange={(open) =>
                setPicking((current) =>
                  open ? preset.id : current === preset.id ? undefined : current
                )
              }
            >
              <PresetThumbnail preset={preset} palette={palette} />
            </FloatingPanel>
          ) : (
            <PresetThumbnail
              key={preset.id}
              preset={preset}
              palette={palette}
              onClick={() => applyPreset(preset.build(palette))}
            />
          )
        )}
      </PresetGrid>

      {report?.groups.some((group) => group.result === "fail") && (
        <Text color="destructive" data-contrast-line>
          Text below AA contrast
        </Text>
      )}
    </Flex>
  );
};
