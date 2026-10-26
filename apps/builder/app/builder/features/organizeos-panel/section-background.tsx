import { useState, type CSSProperties } from "react";
import { computed } from "nanostores";
import { useStore } from "@nanostores/react";
import { toValue } from "@webstudio-is/css-engine";
import { ROOT_INSTANCE_ID } from "@webstudio-is/sdk";
import {
  theme,
  styled,
  Box,
  Button,
  Flex,
  FloatingPanel,
  Grid,
  Label,
  Select,
  Text,
} from "@webstudio-is/design-system";
import {
  $registeredComponentMetas,
  $selectedBreakpoint,
  $selectedInstanceSelector,
  $selectedPage,
  selectInstance,
} from "~/shared/nano-states";
import {
  $assets,
  $breakpoints,
  $instances,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import type { InstanceSelector } from "~/shared/instance-utils/tree";
import { getInstanceLabel } from "~/builder/shared/instance-label";
import { AssetManager } from "~/builder/shared/asset-manager";
import { AssetUpload } from "~/builder/shared/assets";
import { formatAssetName } from "~/builder/shared/assets/asset-utils";
import { $matchingBreakpoints } from "~/builder/features/style-panel/shared/model";
import { luminance, type Rgba } from "./backgrounds/color";
import {
  builtInPalette,
  getReferenceTextColor,
  presets,
  type Palette,
  type PaletteColor,
  type Preset,
  type PresetStyles,
} from "./backgrounds/presets";
import {
  applyPreset,
  describeBackgroundOrigin,
  type BackgroundOrigin,
} from "./backgrounds/apply-preset";
import type { ContrastGroup, ContrastReport } from "./backgrounds/contrast";
import {
  buildSectionStyleModel,
  listRootColorVariables,
} from "./backgrounds/style-model";
import { useDeferredContrastReport } from "./contrast-schedule";

/**
 * The content of the Style panel's Background presets section
 * (background-presets-section.tsx; spec 3.1, panel overhaul spec 5.2):
 * applies a background preset to the selected element, colored from Global
 * Root's color variables, and reports the contrast of the text inside it,
 * after a scheduled run (contrast-schedule.ts). Everything it writes goes
 * through `applyPreset`, as local styles.
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

/** Where the selected element's background comes from now. */
const $backgroundOrigin = computed(
  [
    $sectionSelector,
    $styles,
    $styleSources,
    $styleSourceSelections,
    $breakpoints,
    $selectedBreakpoint,
    $matchingBreakpoints,
    $registeredComponentMetas,
  ],
  (selector): BackgroundOrigin | undefined =>
    selector === undefined ? undefined : describeBackgroundOrigin(selector)
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

const roles: Array<{ role: Role; label: string }> = [
  { role: "base", label: "Base" },
  { role: "accent1", label: "Accent 1" },
  { role: "accent2", label: "Accent 2" },
  { role: "text", label: "Text" },
];

/**
 * The variable each role starts with: the lightest for the base, the
 * darkest for the text, and the others in the order they are defined.
 */
export const getDefaultRoles = (
  variables: PaletteColor[]
): Partial<Record<Role, string>> => {
  if (variables.length === 0) {
    return {};
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

const toHex = ({ r, g, b }: Rgba) =>
  `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")
    .toUpperCase()}`;

const formatRatio = (ratio: number) =>
  `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;

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

const PresetButton = styled("button", {
  all: "unset",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing[2],
  padding: theme.spacing[2],
  borderRadius: theme.borderRadius[2],
  border: `1px solid ${theme.colors.borderMain}`,
  cursor: "pointer",
  "&:hover": { background: theme.colors.backgroundHover },
  "&:focus-visible": { borderColor: theme.colors.borderFocus },
  "&:disabled": { cursor: "default", opacity: 0.5 },
});

const Thumbnail = styled("div", {
  height: 36,
  borderRadius: theme.borderRadius[1],
  border: `1px solid ${theme.colors.borderMain}`,
});

const Swatch = styled("span", {
  display: "inline-block",
  flexShrink: 0,
  width: theme.spacing[7],
  height: theme.spacing[7],
  borderRadius: theme.borderRadius[1],
  border: `1px solid ${theme.colors.borderMain}`,
});

const GroupButton = styled("button", {
  all: "unset",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing[3],
  padding: theme.spacing[2],
  borderRadius: theme.borderRadius[2],
  cursor: "pointer",
  "&:hover": { background: theme.colors.backgroundHover },
  "&:focus-visible": { outline: `1px solid ${theme.colors.borderFocus}` },
});

const getOriginNotice = (origin: BackgroundOrigin | undefined) => {
  if (origin?.kind === "token") {
    return `This element's background comes from the token ${origin.label ?? ""}. The preset is applied as a local style and overrides it here.`;
  }
  if (origin?.kind === "breakpoint") {
    return `This element's background comes from the ${origin.label ?? "another"} breakpoint. The preset is applied as a local style at this breakpoint and overrides it here.`;
  }
  if (origin?.kind === "local") {
    return "Applying a preset replaces this element's background.";
  }
};

const getSummary = (report: ContrastReport) => {
  const failing = report.groups.filter(
    (group) => group.result === "fail"
  ).length;
  switch (report.summary) {
    case "pass":
      return "All text passes AA";
    case "fail":
      return `${failing} text ${failing === 1 ? "style fails" : "styles fail"} AA`;
    case "partial":
      return "Some text could not be checked";
    case "none":
      return "No text to check in this section.";
  }
};

const describeText = (group: ContrastGroup) => {
  const parts: string[] = [];
  if (group.color !== undefined) {
    parts.push(toHex(group.color));
  }
  if (group.fontSize !== undefined) {
    parts.push(`${Math.round(group.fontSize * 100) / 100}px`);
  }
  if (group.fontWeight !== undefined) {
    parts.push(String(group.fontWeight));
  }
  return parts.join(", ");
};

const describeResult = (group: ContrastGroup) => {
  if (group.result === "cant-check") {
    return `Can't check: ${group.reason ?? "unknown value"}`;
  }
  const ratio = group.ratio === undefined ? "" : ` ${formatRatio(group.ratio)}`;
  const outcome = group.result === "pass" ? "Pass" : "Fail";
  return `${outcome}${ratio}, needs ${group.threshold}:1`;
};

const GroupRow = ({ group }: { group: ContrastGroup }) => {
  const label = getInstanceLabel(group.sampleInstanceId);
  return (
    <GroupButton
      type="button"
      data-group={group.sampleInstanceId}
      onClick={() => selectInstance(group.sampleInstanceSelector)}
    >
      <Swatch
        aria-hidden
        css={{
          background:
            group.color === undefined
              ? theme.colors.backgroundPanel
              : toHex(group.color),
        }}
      />
      <Flex direction="column" gap="1" css={{ minWidth: 0 }}>
        <Text truncate>
          {label}
          {group.large ? ", large text" : ""}
        </Text>
        <Text color="subtle">{describeText(group)}</Text>
        <Text color={group.result === "fail" ? "destructive" : "subtle"}>
          {describeResult(group)}
        </Text>
        {group.result === "fail" && group.gradient === true && (
          <Text color="subtle">Lowest point of the background</Text>
        )}
      </Flex>
    </GroupButton>
  );
};

const ContrastSection = ({ report }: { report: ContrastReport }) => (
  <Flex direction="column" gap="1" data-contrast-report>
    <Label>Contrast</Label>
    <Text data-contrast-summary>{getSummary(report)}</Text>
    {report.groups.map((group) => (
      <GroupRow
        key={`${group.sampleInstanceId}:${group.result}:${group.ratio ?? ""}`}
        group={group}
      />
    ))}
    <Text color="subtle">
      The check reads this element's styles at the current breakpoint, not the
      rendered page. It does not see text positioned outside this element, text
      away from the background's lowest point, or text inside an embed.
    </Text>
  </Flex>
);

const ImagePicker = ({
  assetId,
  onChange,
}: {
  assetId: string | undefined;
  onChange: (assetId: string) => void;
}) => {
  const assets = useStore($assets);
  const asset = assetId === undefined ? undefined : assets.get(assetId);
  return (
    <Grid columns="2" gap="2" align="center">
      <Label>Image</Label>
      <FloatingPanel
        title="Images"
        titleSuffix={<AssetUpload type="image" />}
        content={<AssetManager accept="image/*" onChange={onChange} />}
      >
        <Button color="neutral" css={{ maxWidth: "100%" }}>
          {asset ? formatAssetName(asset) : "Choose image..."}
        </Button>
      </FloatingPanel>
    </Grid>
  );
};

export const SectionBackground = () => {
  const selector = useStore($sectionSelector);
  const report = useDeferredContrastReport(selector);
  const origin = useStore($backgroundOrigin);
  const variables = useStore($rootColorVariables);
  const [chosen, setChosen] = useState<Partial<Record<Role, string>>>({});
  const [imageAssetId, setImageAssetId] = useState<string>();

  if (selector === undefined) {
    return;
  }

  const byName = new Map(
    variables.flatMap((color) =>
      color.variable === undefined ? [] : [[color.variable, color] as const]
    )
  );
  const defaults = getDefaultRoles(variables);
  const pick = (role: Role): PaletteColor | undefined => {
    const name = chosen[role];
    return (
      (name === undefined ? undefined : byName.get(name)) ??
      (defaults[role] === undefined ? undefined : byName.get(defaults[role]))
    );
  };
  const palette: Palette =
    variables.length === 0
      ? builtInPalette
      : {
          base: pick("base")!,
          accent1: pick("accent1")!,
          accent2: pick("accent2")!,
          text: pick("text"),
        };
  const names = Array.from(byName.keys());
  const notice = getOriginNotice(origin);
  const scrimPresets = presets.filter(
    (preset) => preset.family === "image-scrim"
  );

  return (
    <Flex
      direction="column"
      gap="3"
      css={{ paddingInline: theme.panel.paddingInline }}
    >
      {variables.length === 0 ? (
        <Text color="subtle" data-palette-hint>
          Define color variables in Global Root to use your own palette.
        </Text>
      ) : (
        <Grid columns="2" gap="2" align="center" data-color-row>
          {roles.map(({ role, label }) => (
            <Box key={role} css={{ display: "contents" }}>
              <Label>{label}</Label>
              <Select
                name={role}
                options={names}
                value={pick(role)?.variable}
                getLabel={(name) => `--${name}`}
                onChange={(name) =>
                  setChosen((previous) => ({ ...previous, [role]: name }))
                }
              />
            </Box>
          ))}
        </Grid>
      )}
      <Text color="subtle">
        Changing a variable later updates the base color. Re-apply the preset to
        update its tints.
      </Text>

      {notice && <Text data-origin-notice>{notice}</Text>}

      <Grid columns="3" gap="2" data-preset-grid>
        {presets.map((preset) => {
          const needsImage =
            preset.family === "image-scrim" && imageAssetId === undefined;
          return (
            <PresetButton
              key={preset.id}
              type="button"
              data-preset={preset.id}
              disabled={needsImage}
              title={needsImage ? "Choose an image first" : preset.label}
              onClick={() =>
                applyPreset(preset.build(palette, { imageAssetId }))
              }
            >
              <Thumbnail style={getThumbnailStyle(preset, palette)} />
              <Text variant="small" truncate>
                {preset.label}
              </Text>
            </PresetButton>
          );
        })}
      </Grid>

      <Flex direction="column" gap="1">
        <ImagePicker assetId={imageAssetId} onChange={setImageAssetId} />
        {imageAssetId === undefined && (
          <Text color="subtle">
            Choose an image to use the image with scrim presets.
          </Text>
        )}
        {scrimPresets.map((preset) => {
          const reference = getReferenceTextColor(preset, palette);
          return (
            <Flex
              key={preset.id}
              align="center"
              gap="2"
              data-scrim-reference={preset.id}
            >
              <Swatch aria-hidden css={{ background: toHex(reference) }} />
              <Text color="subtle">
                {preset.label}: tuned for text {toHex(reference)}
              </Text>
            </Flex>
          );
        })}
      </Flex>

      {report === undefined ? (
        <Text color="subtle" data-contrast-pending>
          Checking contrast
        </Text>
      ) : (
        <ContrastSection report={report} />
      )}
    </Flex>
  );
};
