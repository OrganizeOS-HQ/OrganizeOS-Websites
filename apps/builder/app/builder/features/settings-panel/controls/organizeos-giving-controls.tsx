import {
  type ComponentProps,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";
import { useStore } from "@nanostores/react";
import type { Prop } from "@webstudio-is/sdk";
import {
  Flex,
  Label,
  Label as BaseLabel,
  Radio,
  RadioAndLabel,
  RadioGroup,
  Select,
  Text,
  Tooltip,
  cssVar,
  theme,
} from "@webstudio-is/design-system";
import { ExternalLinkIcon } from "@webstudio-is/icons";
import type { Fundraiser } from "@organizeos/site-components/fundraisers-data";
import { $organizeosSite } from "~/shared/nano-states";
import { $project, $props, $resources } from "~/shared/sync/data-stores";
import { computeResourceRequest, invalidateResource } from "~/shared/resources";
import {
  type GivingOption,
  donationFormComponent,
  fundraiserOptions,
  fundraisingHref,
  givingWarning,
  loadFundraisers,
} from "~/builder/features/organizeos-panel/giving-blocks";
import { getOrganizeosPresetIds } from "~/builder/features/organizeos-panel/insert-organizeos-block";
import { type ControlProps, type PropValue, VerticalLayout } from "../shared";
import { PropertyLabel } from "../property-label";
import { OrganizeosRecordControl, linkButtonClass } from "./organizeos-record";
import { BasePage } from "./url";

/**
 * The Giving blocks' Settings rows (OrganizeOS builder donations spec
 * 2026-11-13, 7.4; plan F1, F-D15 and F-D16), behind the kinds in
 * organizeos-controls.tsx: on a Donation Form, Give to, State and After the
 * gift; on Goal Progress, Give to. Options only, at the panel's width; one
 * warning line only when something is wrong.
 */

type ChangeByPropName = (propName: string, value: PropValue) => void;

const OpenInFundraising = ({ href }: { href: undefined | string }) =>
  href === undefined ? null : (
    <Tooltip content="Open in Fundraising">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open in Fundraising"
        className={linkButtonClass}
      >
        <ExternalLinkIcon />
      </a>
    </Tooltip>
  );

const Warning = ({ text }: { text: undefined | string }) =>
  text === undefined ? null : (
    <Text
      truncate
      css={{ color: cssVar("--foreground-warning") }}
      data-giving-warning
    >
      {text}
    </Text>
  );

const stringPropOf = (
  props: Map<Prop["id"], Prop>,
  instanceId: string,
  name: string
) => {
  for (const prop of props.values()) {
    if (
      prop.instanceId === instanceId &&
      prop.name === name &&
      prop.type === "string"
    ) {
      return prop.value;
    }
  }
};

type Load =
  | { status: "loading" }
  | { status: "loaded"; list: Fundraiser[] }
  | { status: "failed" };

const getOptionKey = (option: GivingOption) => `giving:${option.value}`;
const getOptionLabel = (option: GivingOption) => option.label;

/**
 * Give to on a Donation Form: General giving, then the org's fundraisers,
 * read live when the row mounts (the block binds no data). Choosing writes
 * `target` in one transaction.
 */
export const DonationTargetControl = ({
  instanceId,
  prop,
  computedValue,
  onChange,
}: ControlProps<"text">) => {
  const id = useId();
  const site = useStore($organizeosSite);
  const props = useStore($props);
  const [load, setLoad] = useState<Load>({ status: "loading" });

  const read = useCallback(() => {
    setLoad({ status: "loading" });
    let cancelled = false;
    void loadFundraisers().then((list) => {
      if (cancelled === false) {
        setLoad(
          list === undefined ? { status: "failed" } : { status: "loaded", list }
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => read(), [read]);

  const readOnly = prop !== undefined && prop.type !== "string";
  const { options, selected, missing } = fundraiserOptions(
    load.status === "loaded" ? load.list : undefined,
    computedValue,
    { general: true }
  );
  const warning = givingWarning({
    component: donationFormComponent,
    organizationId: stringPropOf(props, instanceId, "organizationId"),
    platformOrigin: stringPropOf(props, instanceId, "platformOrigin"),
    missing,
    site,
  });

  return (
    <VerticalLayout label={<PropertyLabel name="target" readOnly={readOnly} />}>
      <Flex direction="column" css={{ gap: theme.spacing[3] }}>
        <Flex align="center" css={{ gap: theme.spacing[3] }}>
          <Select<GivingOption>
            fullWidth
            id={id}
            disabled={readOnly}
            value={selected}
            placeholder="Pick what it gives to"
            options={options}
            getLabel={getOptionLabel}
            getValue={getOptionKey}
            getItemProps={(option) => ({ textValue: option.label })}
            onChange={(option) =>
              onChange({ type: "string", value: option.value })
            }
          />
          <OpenInFundraising href={fundraisingHref(site, computedValue)} />
        </Flex>
        {load.status === "failed" && (
          <Text color="subtle" data-giving-load>
            Fundraisers didn't load.{" "}
            <button type="button" className={linkButtonClass} onClick={read}>
              Reload
            </button>
          </Text>
        )}
        <Warning text={warning} />
      </Flex>
    </VerticalLayout>
  );
};

type StateOption = { value: "ready" | "unavailable"; label: string };

const stateOptions: StateOption[] = [
  { value: "ready", label: "Ready" },
  { value: "unavailable", label: "Not taking gifts" },
];

/** State on a Donation Form: what the canvas shows. */
export const DonationStateControl = ({
  prop,
  computedValue,
  onChange,
}: ControlProps<"text">) => {
  const id = useId();
  const readOnly = prop !== undefined && prop.type !== "string";
  const value =
    stateOptions.find((option) => option.value === computedValue) ??
    stateOptions[0];
  return (
    <VerticalLayout label={<Label htmlFor={id}>State</Label>}>
      <Select<StateOption>
        fullWidth
        id={id}
        disabled={readOnly}
        value={value}
        options={stateOptions}
        getLabel={(option) => option.label}
        getValue={(option) => option.value}
        onChange={(option) => onChange({ type: "string", value: option.value })}
      />
    </VerticalLayout>
  );
};

const afterGiftOptions = [
  { value: "message", label: "Message" },
  { value: "page", label: "Page" },
] as const;

/**
 * After the gift on a Donation Form: Message (the thank-you stays in the
 * frame) or Page, which draws upstream's page select for `afterGiftPage`.
 * The Signup Form's After submit, for these props.
 */
export const DonationAfterGiftControl = ({
  instanceId,
  prop,
  propName,
  computedValue,
  onChange,
  onChangeByPropName,
}: ControlProps<"text"> & { onChangeByPropName?: ChangeByPropName }) => {
  const id = useId();
  const props = useStore($props);
  const readOnly = prop !== undefined && prop.type !== "string";
  const value = computedValue === "page" ? "page" : "message";
  let afterGiftPage: undefined | Prop;
  for (const item of props.values()) {
    if (item.instanceId === instanceId && item.name === "afterGiftPage") {
      afterGiftPage = item;
    }
  }
  const pageProp =
    afterGiftPage?.type === "page" ||
    afterGiftPage?.type === "string" ||
    afterGiftPage?.type === "expression"
      ? { type: afterGiftPage.type, value: afterGiftPage.value }
      : undefined;

  return (
    <VerticalLayout
      label={<PropertyLabel name={propName} readOnly={readOnly} />}
    >
      <Flex direction="column" css={{ gap: theme.spacing[3] }}>
        <RadioGroup
          disabled={readOnly}
          name={`${id}:after-gift`}
          value={value}
          onValueChange={(next) => onChange({ type: "string", value: next })}
        >
          {afterGiftOptions.map((option) => (
            <RadioAndLabel key={option.value}>
              <Radio value={option.value} id={`${id}:${option.value}`} />
              <BaseLabel htmlFor={`${id}:${option.value}`}>
                {option.label}
              </BaseLabel>
            </RadioAndLabel>
          ))}
        </RadioGroup>
        {value === "page" && (
          <Flex direction="column" data-after-gift-page>
            <BasePage
              id={`${id}:page`}
              instanceId={instanceId}
              readOnly={readOnly}
              prop={pageProp as ComponentProps<typeof BasePage>["prop"]}
              value=""
              onChange={(page) => {
                if (readOnly === false) {
                  onChangeByPropName?.("afterGiftPage", page);
                }
              }}
            />
          </Flex>
        )}
      </Flex>
    </VerticalLayout>
  );
};

/**
 * Reload the project's Fundraisers catalog request, so the canvas shows the
 * fundraiser a Goal Progress just picked with its current figures.
 */
const reloadFundraisersResource = async () => {
  const project = $project.get();
  if (project === undefined) {
    return;
  }
  const { fundraisers } = await getOrganizeosPresetIds(project.id);
  const resource = $resources.get().get(fundraisers.resourceId);
  if (resource !== undefined) {
    invalidateResource(await computeResourceRequest(resource, new Map()));
  }
};

/**
 * Give to on Goal Progress: the shared record control over the root's bound
 * Fundraisers body (fundraisersPicker), with Open in Fundraising under it.
 */
export const GivingRecordControl = (props: ControlProps<"text">) => {
  const site = useStore($organizeosSite);
  return (
    <OrganizeosRecordControl
      {...props}
      after={
        <OpenInFundraising href={fundraisingHref(site, props.computedValue)} />
      }
      onChangeRecord={(value) => {
        props.onChange({ type: "string", value });
        void reloadFundraisersResource();
      }}
    />
  );
};
