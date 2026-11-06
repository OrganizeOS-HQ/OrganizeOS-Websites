import type { ReactNode } from "react";
import { computed } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  ROOT_INSTANCE_ID,
  type Instance,
  type Instances,
  type Page,
} from "@webstudio-is/sdk";
import {
  BuilderRuntimeError,
  isRichTextContent,
  isTreeSatisfyingContentModel,
  type InstanceSelector,
} from "@webstudio-is/project-build/runtime";
import {
  theme,
  cssVar,
  styled,
  toast,
  Button,
  Flex,
  Grid,
  InputField,
  Text,
} from "@webstudio-is/design-system";
import {
  $registeredComponentMetas,
  $selectedInstancePath,
  $selectedInstanceSelector,
  $selectedPage,
  selectInstance,
} from "~/shared/nano-states";
import { $instances, $props } from "~/shared/sync/data-stores";
import {
  executeRuntimeMutation,
  executeStagedRuntimeMutation,
} from "~/shared/instance-utils/data";
import { getInstanceLabel } from "~/builder/shared/instance-label";
import { useDraftValue } from "~/builder/shared/use-draft-value";
import { FieldLabel } from "~/builder/features/settings-panel/property-label";
import { organizeosNamespace } from "./insert-organizeos-block";
import { motionPresets, type MotionPreset } from "./motion/presets";

/**
 * The content of the Inspector's Motion tab (motion-tab.tsx; spec 3, 4.4, 4.6,
 * panel overhaul spec 5.4): a preset wraps the selected element in an Animate
 * Children whose `action` is the preset, or replaces the action of the Animate
 * Children the selection is, or sits directly in. `action` is upstream's data,
 * edited afterwards in upstream's Animation section, which the tab embeds
 * below the presets for a selected Animate Children (`editor`); `stagger` is
 * edited only here, because that section replaces the props panel.
 */

export const animateChildrenComponent = `${organizeosNamespace}:AnimateChildren`;

export const maxStagger = 20;

export const motionRefusal = "Select a section";

export type MotionTarget =
  | { kind: "refused" }
  /** wrap the selection in a new Animate Children */
  | { kind: "wrap"; instanceId: Instance["id"] }
  /** an existing Animate Children: the selection or its parent */
  | { kind: "wrapper"; instanceId: Instance["id"] };

/**
 * What a preset acts on: the selected Animate Children, else its parent if
 * that is one, else the selection to wrap. Nothing, Global Root, the page
 * root and the Body are refused.
 */
export const getMotionTarget = (
  selector: undefined | InstanceSelector,
  instances: Instances,
  page: undefined | Pick<Page, "rootInstanceId">
): MotionTarget => {
  if (selector === undefined || selector.length === 0) {
    return { kind: "refused" };
  }
  const [instanceId, parentId] = selector;
  const instance = instances.get(instanceId);
  if (instance === undefined) {
    return { kind: "refused" };
  }
  if (instance.component === animateChildrenComponent) {
    return { kind: "wrapper", instanceId };
  }
  if (
    parentId !== undefined &&
    instances.get(parentId)?.component === animateChildrenComponent
  ) {
    return { kind: "wrapper", instanceId: parentId };
  }
  if (
    instanceId === ROOT_INSTANCE_ID ||
    instanceId === page?.rootInstanceId ||
    instance.component === "Body" ||
    // nothing to wrap it in: the runtime's instances.wrap refuses a selector
    // of one entry too
    selector.length === 1
  ) {
    return { kind: "refused" };
  }
  return { kind: "wrap", instanceId };
};

/**
 * The props a preset writes, as instances.updateProps updates: it keeps an
 * existing prop's id, so a preset replaces the action and stagger before it.
 */
const getMotionPresetUpdates = (
  instanceId: Instance["id"],
  preset: Pick<MotionPreset, "action" | "stagger">
) => [
  {
    instanceId,
    name: "action",
    type: "animationAction" as const,
    // a copy: the store freezes what it holds
    value: structuredClone(preset.action),
  },
  {
    instanceId,
    name: "stagger",
    type: "number" as const,
    value: preset.stagger,
  },
];

/** A stagger the field accepts: a finite number, clamped to 0..20. */
export const clampMotionStagger = (value: number) =>
  Number.isFinite(value) ? Math.min(maxStagger, Math.max(0, value)) : 0;

/**
 * Applies a preset to the selection, in one undo step either way, each staged
 * and committed once (executeStagedRuntimeMutation): an existing wrapper takes
 * both props, and a wrap is staged with both props. What the content model or
 * rich text does not allow (for example a list item, whose parent takes only
 * list items) is refused with a toast, and nothing is written.
 *
 * The runtime's wrap checks content models against the static registry, which
 * has no OrganizeOS metas, so there an Animate Children is tagless and fits
 * anywhere. The check here uses the builder's registered metas, as the
 * builder's own wrap did before 0.309.0 (ruling panels OQ1). Without build
 * access either is refused with the runtime's message.
 *
 * Every refusal is toasted once. The commit toasts its own (a write inside
 * MDX content that its Templates do not hold) before it throws it, so a
 * BuilderRuntimeError thrown once everything is staged is not toasted again
 * (ruling data OQ7); one thrown while staging is. Both paths stage, so that
 * line is known on each.
 */
export const applyMotionPreset = async (preset: MotionPreset) => {
  const target = getMotionTarget(
    $selectedInstanceSelector.get(),
    $instances.get(),
    $selectedPage.get()
  );
  let staged = false;
  try {
    if (target.kind === "wrapper") {
      const { instanceId } = target;
      await executeStagedRuntimeMutation((accumulator) => {
        accumulator.execute({
          id: "instances.updateProps",
          input: { updates: getMotionPresetUpdates(instanceId, preset) },
        });
        staged = true;
      });
      return;
    }
    // the selection's selector as upstream's wrapInstance reads it
    const selected = $selectedInstancePath.get()?.[0];
    if (target.kind !== "wrap" || selected === undefined) {
      return;
    }
    const metas = $registeredComponentMetas.get();
    // synchronous: an asynchronous stage would commit against the state
    // taken at the call
    const instanceSelector = await executeStagedRuntimeMutation(
      (accumulator) => {
        const instances = () => accumulator.state.instances ?? new Map();
        const props = () => accumulator.state.props ?? new Map();
        if (
          isRichTextContent({
            instances: instances(),
            props: props(),
            metas,
            instanceSelector: selected.instanceSelector,
          })
        ) {
          throw Error("Cannot wrap textual content");
        }
        const { instanceSelector } = accumulator.execute({
          id: "instances.wrap",
          input: {
            instanceSelector: selected.instanceSelector,
            component: animateChildrenComponent,
          },
        });
        if (
          isTreeSatisfyingContentModel({
            instances: instances(),
            props: props(),
            metas,
            instanceSelector,
          }) === false
        ) {
          throw Error(
            `Cannot wrap in ${getInstanceLabel({
              component: animateChildrenComponent,
            })}`
          );
        }
        accumulator.execute({
          id: "instances.updateProps",
          input: {
            updates: getMotionPresetUpdates(instanceSelector[0], preset),
          },
        });
        staged = true;
        return instanceSelector;
      }
    );
    selectInstance(instanceSelector);
  } catch (error) {
    // the commit's own refusal, already toasted (see above)
    if (staged && error instanceof BuilderRuntimeError) {
      return;
    }
    toast.error(
      error instanceof Error ? error.message : "Cannot wrap instance"
    );
  }
};

/** Sets an Animate Children's stagger, clamped to 0..20, keeping the prop's id. */
export const setMotionStagger = (instanceId: Instance["id"], value: number) => {
  executeRuntimeMutation({
    id: "instances.updateProps",
    input: {
      updates: [
        {
          instanceId,
          name: "stagger",
          type: "number",
          value: clampMotionStagger(value),
        },
      ],
    },
  });
};

const $motionTarget = computed(
  [$selectedInstanceSelector, $instances, $selectedPage],
  getMotionTarget
);

const $wrapperStagger = computed(
  [$motionTarget, $props],
  (target, props): undefined | number => {
    if (target.kind !== "wrapper") {
      return;
    }
    for (const prop of props.values()) {
      if (
        prop.instanceId === target.instanceId &&
        prop.name === "stagger" &&
        prop.type === "number"
      ) {
        return prop.value;
      }
    }
    return 0;
  }
);

const PresetButton = styled("button", {
  all: "unset",
  boxSizing: "border-box",
  padding: theme.spacing[3],
  borderRadius: theme.borderRadius[2],
  border: `1px solid ${cssVar("--border-default")}`,
  textAlign: "center",
  cursor: "pointer",
  "&:hover": { background: cssVar("--overlay-interaction-hover") },
  "&:focus-visible": { borderColor: cssVar("--border-focus") },
});

const StaggerField = ({
  instanceId,
  stagger,
}: {
  instanceId: Instance["id"];
  stagger: number;
}) => {
  const draft = useDraftValue<number | string>(stagger, (value) => {
    if (typeof value === "number") {
      setMotionStagger(instanceId, value);
    }
  });
  return (
    <Grid columns="2" gap="2" align="center" data-motion-stagger>
      <FieldLabel description={`0–${maxStagger} %`}>Stagger</FieldLabel>
      <InputField
        aria-label="Stagger"
        type="number"
        min={0}
        max={maxStagger}
        value={draft.value}
        onChange={({ target: { valueAsNumber, value } }) =>
          draft.set(Number.isNaN(valueAsNumber) ? value : valueAsNumber)
        }
        onBlur={draft.save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            draft.save();
          }
        }}
      />
    </Grid>
  );
};

/**
 * `editor` is upstream's Animation editor for a selected Animate Children,
 * shown full width below the Stagger field; the Motion tab passes it only
 * where upstream renders the editor alone (motion-tab.tsx).
 */
export const Motion = ({ editor }: { editor?: ReactNode }) => {
  const selector = useStore($selectedInstanceSelector);
  const target = useStore($motionTarget);
  const stagger = useStore($wrapperStagger);

  if (target.kind === "refused") {
    return (
      <Text
        color="subtle"
        css={{ paddingInline: theme.panel.paddingInline }}
        data-motion-refusal
      >
        {motionRefusal}
      </Text>
    );
  }

  // a wrapper target is the selection itself, or the parent of a child of it
  const isWrapperSelected =
    target.kind === "wrapper" && selector?.[0] === target.instanceId;
  const isWrapperChild = target.kind === "wrapper" && !isWrapperSelected;

  return (
    <Flex direction="column" gap="3">
      <Flex
        direction="column"
        gap="3"
        css={{ paddingInline: theme.panel.paddingInline }}
      >
        <Grid
          columns="3"
          gap="2"
          data-motion-presets
          data-motion-target={target.kind}
        >
          {motionPresets.map((preset) => (
            <PresetButton
              key={preset.id}
              type="button"
              data-motion-preset={preset.id}
              onClick={() => void applyMotionPreset(preset)}
            >
              <Text variant="small">{preset.label}</Text>
            </PresetButton>
          ))}
        </Grid>
        {isWrapperChild && selector !== undefined && (
          <Button
            color="neutral"
            data-motion-select-wrapper
            onClick={() => selectInstance(selector.slice(1))}
          >
            Select Animate Children
          </Button>
        )}
        {isWrapperSelected && stagger !== undefined && (
          <StaggerField
            // a fresh draft for each wrapper
            key={target.instanceId}
            instanceId={target.instanceId}
            stagger={stagger}
          />
        )}
      </Flex>
      {isWrapperSelected && editor}
    </Flex>
  );
};
