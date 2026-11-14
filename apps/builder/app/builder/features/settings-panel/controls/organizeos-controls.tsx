import { type ComponentProps, useId, useRef } from "react";
import { useStore } from "@nanostores/react";
import type { Instance, Instances, Prop } from "@webstudio-is/sdk";
import { decodeDataVariableId } from "@webstudio-is/sdk";
import type { InstanceSelector } from "@webstudio-is/project-build/runtime";
import {
  Box,
  Checkbox,
  CheckboxAndLabel,
  Flex,
  Label as BaseLabel,
  Radio,
  RadioAndLabel,
  RadioGroup,
  Text,
  ToggleGroup,
  ToggleGroupButton,
  Tooltip,
  cssVar,
  theme,
  useIsTruncated,
} from "@webstudio-is/design-system";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  EmailIcon,
  ExternalLinkIcon,
  FormTextFieldIcon,
  LoadingDotsIcon,
  XCircledFilledIcon,
} from "@webstudio-is/icons";
import {
  parseFormsData,
  resolveSignupForm,
} from "@organizeos/site-components/forms-data";
import {
  $organizeosSite,
  $propValuesByInstanceSelector,
  $selectedInstanceSelector,
  getInstanceKey,
} from "~/shared/nano-states";
import {
  NEW_SITE_FORM,
  crmFormUrl,
  fieldsDifferElsewhere,
  formKindOf,
  isMarkedSiteForm,
  formStatesFor,
  matchFieldsToSiteForm,
  pointAtNewSiteForm,
  siteFormRecordOptions,
} from "~/builder/features/organizeos-panel/site-forms";
import { $dataSourceVariables } from "~/shared/nano-states/variables";
import { $dataSources, $instances, $props } from "~/shared/sync/data-stores";
import {
  type ComputedFieldName,
  addSignupField,
  changeSignupForm,
  fieldComponent,
  findSignupFormRoot,
  getFieldRows,
  getSignupWarning,
  isNestedInForm,
  isSignupDataBound,
  listRootFields,
  removeSignupField,
  restoreSignupFormData,
  signupFormComponent,
} from "~/builder/features/organizeos-panel/signup-fields";
import { $instanceTags } from "../../style-panel/shared/model";
import { type ControlProps, type PropValue, VerticalLayout } from "../shared";
import { PropertyLabel } from "../property-label";
import {
  $selectedInstanceDataProp,
  $selectedInstanceFailedLoads,
  OrganizeosRecordControl,
  linkButtonClass,
  isOrganizeosRecordProp,
} from "./organizeos-record";
import { BasePage } from "./url";
import { FieldNameControl } from "./organizeos-field-control";
import { SiteFieldsControl } from "./organizeos-site-fields";
import {
  ProductCardControl,
  ProductShowControl,
} from "./organizeos-product-control";
import {
  productCardComponent,
  productGridComponent,
} from "~/builder/features/organizeos-panel/product-blocks";

/**
 * The OrganizeOS blocks' own Settings rows (fork doc section 9, "In the
 * builder"), behind one marked branch in combined.tsx. The Signup Form's rows
 * read Form, State, Fields and After submit, each at the panel's width with
 * no help text; a Field under a Signup Form picks its form field from a list;
 * the RSVP Form keeps its record picker; a Product Grid's Show and a Product
 * Card's Product write the block's own data. Anything else falls through to
 * upstream's controls.
 */

export type OrganizeosControlKind =
  | "signup-record"
  | "signup-state"
  | "signup-fields"
  | "signup-after-submit"
  | "record"
  | "field-name"
  | "product-show"
  | "product-card"
  | "hidden";

/**
 * The OrganizeOS control a prop gets, `"hidden"` for a prop whose row is drawn
 * by another, or undefined for upstream's own control.
 */
export const getOrganizeosControl = ({
  component,
  propName,
  instanceSelector,
  instances = $instances.get(),
}: {
  component: undefined | string;
  propName: string;
  /** The selected instance's selector: renderControl is given none. */
  instanceSelector: undefined | InstanceSelector;
  instances?: Instances;
}): undefined | OrganizeosControlKind => {
  if (component === signupFormComponent) {
    switch (propName) {
      case "record":
        return "signup-record";
      case "state":
        return "signup-state";
      case "data":
        return "signup-fields";
      case "action":
        return "signup-after-submit";
      case "actionPage":
      // the site form's mark (docs/ORGANIZEOS-FORK.md section 9, "Site forms")
      case "siteForm":
        return "hidden";
    }
    return;
  }
  // A site form's Field definition: the forms panel writes it, no row draws it.
  if (
    component === fieldComponent &&
    (propName === "fieldType" ||
      propName === "options" ||
      propName === "required")
  ) {
    return "hidden";
  }
  if (component === productGridComponent && propName === "show") {
    return "product-show";
  }
  if (component === productCardComponent && propName === "product") {
    return "product-card";
  }
  if (isOrganizeosRecordProp(component, propName)) {
    return "record";
  }
  // a Field under an RSVP Form, or outside any form, keeps the text box
  if (
    component === fieldComponent &&
    propName === "field" &&
    instanceSelector !== undefined &&
    findSignupFormRoot(instanceSelector, instances) !== undefined
  ) {
    return "field-name";
  }
};

/**
 * Whether no row draws this prop of an OrganizeOS component, so the Settings
 * panel's "Properties & attributes" + leaves it out too: a prop added there
 * would sit under a hidden row, unseen and unremovable (a site form's mark and
 * its Fields' definition, docs/ORGANIZEOS-FORK.md section 9, "Site forms").
 */
export const isOrganizeosHiddenProp = (
  component: undefined | string,
  propName: string
) =>
  component !== undefined &&
  getOrganizeosControl({ component, propName, instanceSelector: undefined }) ===
    "hidden";

/** The props logic's write of another prop of the instance. */
type ChangeByPropName = (propName: string, value: PropValue) => void;

type OrganizeosControlProps = ControlProps<string> & {
  key?: string;
  onChangeByPropName?: ChangeByPropName;
};

/** Renders the control a kind names; nothing for `"hidden"`. */
export const renderOrganizeosControl = (
  kind: OrganizeosControlKind,
  { key, onChangeByPropName, ...props }: OrganizeosControlProps
) => {
  const control = renderKind(kind, props, onChangeByPropName);
  return control === undefined ? undefined : (
    <Box key={key} data-organizeos-control={kind}>
      {control}
    </Box>
  );
};

const renderKind = (
  kind: OrganizeosControlKind,
  props: ControlProps<string>,
  onChangeByPropName: undefined | ChangeByPropName
) => {
  // the metas keep upstream's controls; the kind decides what is drawn
  const textProps = props as unknown as ControlProps<"text">;
  switch (kind) {
    case "signup-record":
      return <SignupFormRecordControl {...textProps} />;
    case "signup-state":
      return <SignupStateControl {...textProps} />;
    case "signup-fields":
      return <SignupFieldsControl {...textProps} />;
    case "signup-after-submit":
      return (
        <SignupAfterSubmitControl
          {...textProps}
          onChangeByPropName={onChangeByPropName}
        />
      );
    case "record":
      return <OrganizeosRecordControl {...textProps} />;
    case "field-name":
      return <FieldNameControl {...textProps} />;
    case "product-show":
      return <ProductShowControl {...textProps} />;
    case "product-card":
      return <ProductCardControl {...textProps} />;
    case "hidden":
      return;
  }
  kind satisfies never;
};

/** A label that truncates, with the whole text in a tooltip when it does. */
const TruncatedLabel = ({
  children,
  ...rest
}: ComponentProps<typeof BaseLabel> & { children: string }) => {
  const ref = useRef<HTMLLabelElement>(null);
  const truncated = useIsTruncated(ref, children);
  const label = (
    <BaseLabel truncate {...rest} ref={ref}>
      {children}
    </BaseLabel>
  );
  return truncated ? <Tooltip content={children}>{label}</Tooltip> : label;
};

/**
 * Form: the record picker. Choosing a form also adds the new form's missing
 * required Fields, in the same transaction (changeSignupForm).
 */
/** The shipped Form change: `record`, and the new form's missing required Fields. */
const changeToForm = (instanceId: Instance["id"], record: string) => {
  const { fields } = resolveSignupForm(record, $selectedInstanceDataProp.get());
  void changeSignupForm(
    instanceId,
    record,
    fields,
    getComputedFieldName(
      instanceId,
      $selectedInstanceSelector.get(),
      $instances.get(),
      $propValuesByInstanceSelector.get()
    )
  );
};

/**
 * With the site forms switch on (fork doc section 9, "Site forms"; spec 9):
 * the block's kind's forms, site forms first, then New form; a site form
 * chosen makes the block's Fields the form's; and an icon link opens the
 * form's CRM editor in a new tab.
 */
const SiteFormRecordControl = (props: ControlProps<"text">) => {
  const data = useStore($selectedInstanceDataProp);
  useStore($props);
  const kind = formKindOf(props.instanceId, data);
  const record =
    typeof props.computedValue === "string" ? props.computedValue.trim() : "";
  const url = record === "" ? undefined : crmFormUrl(record);
  return (
    <OrganizeosRecordControl
      {...props}
      transformOptions={(options) => siteFormRecordOptions(options, data, kind)}
      after={
        url === undefined ? undefined : (
          <Tooltip content="Open in CRM">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in CRM"
              className={linkButtonClass}
            >
              <ExternalLinkIcon />
            </a>
          </Tooltip>
        )
      }
      onChangeRecord={(value) => {
        if (value === NEW_SITE_FORM.value) {
          void pointAtNewSiteForm(props.instanceId, kind);
          return;
        }
        const form = parseFormsData(data)?.find((item) => item.id === value);
        if (form?.site === true) {
          void matchFieldsToSiteForm(
            props.instanceId,
            {
              id: form.id,
              fields: form.fields.map((field) => ({
                name: field.name,
                label: field.label,
                type: field.type,
                required: field.required,
                ...(field.options === null
                  ? {}
                  : { options: [...field.options] }),
              })),
            },
            kind
          );
          return;
        }
        changeToForm(props.instanceId, value);
      }}
    />
  );
};

const SignupFormRecordControl = (props: ControlProps<"text">) => {
  const site = useStore($organizeosSite);
  if (site?.siteFormsEnabled === true) {
    return <SiteFormRecordControl {...props} />;
  }
  return (
    <OrganizeosRecordControl
      {...props}
      onChangeRecord={(record) => changeToForm(props.instanceId, record)}
    />
  );
};

const states = [
  { value: "initial", label: "Initial", icon: <FormTextFieldIcon /> },
  { value: "submitting", label: "Submitting", icon: <LoadingDotsIcon /> },
  { value: "success", label: "Success", icon: <CheckCircleIcon /> },
  { value: "confirm-email", label: "Check email", icon: <EmailIcon /> },
  { value: "error", label: "Error", icon: <AlertCircleIcon /> },
  { value: "unavailable", label: "Unavailable", icon: <XCircledFilledIcon /> },
] as const;

/**
 * The variable a `state` expression reads when it is that variable alone,
 * as the template binds it (`formState`); undefined for any other expression.
 */
export const getStateVariableId = (expression: string) => {
  const identifier = expression.trim();
  return /^[\w$]+$/.test(identifier)
    ? decodeDataVariableId(identifier)
    : undefined;
};

/**
 * State: which state the canvas shows, and nothing else. A `state` bound to
 * one variable sets that variable's value on the canvas, as the block's own
 * action does: nothing is written to the project and nothing is added to
 * undo. Anything else (an unbound `state`, any other expression) has no
 * variable to set, so the buttons are read-only and write nothing.
 */
const SignupStateControl = ({
  instanceId,
  prop,
  computedValue,
}: ControlProps<"text">) => {
  // a contact form has no Check email (spec 9), with the site forms switch on
  const site = useStore($organizeosSite);
  const data = useStore($selectedInstanceDataProp);
  useStore($props);
  const shown =
    site?.siteFormsEnabled === true
      ? formStatesFor(formKindOf(instanceId, data))
      : undefined;
  const variableId =
    prop?.type === "expression" ? getStateVariableId(prop.value) : undefined;
  const readOnly = variableId === undefined;
  const value = typeof computedValue === "string" ? computedValue : "initial";
  return (
    <VerticalLayout label={<BaseLabel>State</BaseLabel>}>
      <ToggleGroup
        type="single"
        value={value}
        disabled={readOnly}
        css={{ width: "100%" }}
        onValueChange={(state: string) => {
          if (variableId !== undefined) {
            $dataSourceVariables.set(
              new Map($dataSourceVariables.get()).set(variableId, state)
            );
          }
        }}
      >
        {states
          .filter((state) => shown === undefined || shown.includes(state.value))
          .map((state) => (
            <Tooltip key={state.value} content={state.label}>
              <ToggleGroupButton value={state.value} aria-label={state.label}>
                {state.icon}
              </ToggleGroupButton>
            </Tooltip>
          ))}
      </ToggleGroup>
    </VerticalLayout>
  );
};

/** A descendant's selector under a root's, by its parents. */
const getDescendantSelector = (
  rootSelector: InstanceSelector,
  instanceId: Instance["id"],
  instances: Instances
): undefined | InstanceSelector => {
  const path: Instance["id"][] = [];
  const visit = (id: Instance["id"]): boolean => {
    if (id === instanceId) {
      return true;
    }
    for (const child of instances.get(id)?.children ?? []) {
      if (child.type === "id" && visit(child.value)) {
        path.push(child.value);
        return true;
      }
    }
    return false;
  };
  if (visit(rootSelector[0]) === false) {
    return;
  }
  return [...path, ...rootSelector];
};

/**
 * A bound `field`'s computed value under a root, read from the canvas's prop
 * values by the Field's selector below the root's (the selection's, when the
 * root is selected).
 */
const getComputedFieldName =
  (
    rootId: Instance["id"],
    selected: undefined | InstanceSelector,
    instances: Instances,
    propValues: ReturnType<typeof $propValuesByInstanceSelector.get>
  ): ComputedFieldName =>
  (fieldId) => {
    const rootSelector =
      selected?.[0] === rootId ? selected : ([rootId] as InstanceSelector);
    const selector = getDescendantSelector(rootSelector, fieldId, instances);
    const value =
      selector === undefined
        ? undefined
        : propValues.get(getInstanceKey(selector))?.get("field");
    return typeof value === "string" ? value : undefined;
  };

/**
 * Fields, in the `data` prop's row: one checkbox per field of the form, in its
 * order, and the one warning line. The Forms data itself is never shown: its
 * row has a plain label, with no menu to reset it. With `data` unbound (isSignupDataBound), a line says so, and its Reconnect
 * binds it to the org's Forms catalog again as the insert does
 * (restoreSignupFormData).
 */
const SignupFieldsControl = ({
  instanceId: rootId,
  computedProps,
}: ControlProps<"text">) => {
  const id = useId();
  const instances = useStore($instances);
  const props = useStore($props);
  const data = useStore($selectedInstanceDataProp);
  const failedLoads = useStore($selectedInstanceFailedLoads);
  const instanceTags = useStore($instanceTags);
  const selected = useStore($selectedInstanceSelector);
  const propValues = useStore($propValuesByInstanceSelector);
  const dataSources = useStore($dataSources);
  const dataBound = isSignupDataBound(rootId, props, dataSources);
  const rootSelector =
    selected?.[0] === rootId ? selected : ([rootId] as InstanceSelector);

  const resolution = resolveSignupForm(computedProps?.get("record"), data);
  const computedName = getComputedFieldName(
    rootId,
    selected,
    instances,
    propValues
  );
  const rootFields = listRootFields(rootId, instances, props, computedName);
  const rows =
    resolution.fields === undefined
      ? []
      : getFieldRows(resolution.fields, rootFields.byName);
  // a block marked as a site form draws its own list (fork doc section 9)
  const site = useStore($organizeosSite);
  const marked = site?.siteFormsEnabled === true && isMarkedSiteForm(rootId);
  const warning = getSignupWarning({
    nested: isNestedInForm(rootSelector, instanceTags),
    dataBound,
    data,
    resolution,
    rootFields,
    failedLoads: failedLoads.length > 0,
    siteForm: marked,
    differsElsewhere: marked && fieldsDifferElsewhere(rootId),
  });
  if (marked) {
    return (
      <SiteFieldsControl
        rootId={rootId}
        warning={
          warning === undefined ? undefined : (
            <Text
              truncate
              css={{ color: cssVar("--foreground-warning") }}
              data-signup-warning
            >
              {warning}
            </Text>
          )
        }
      />
    );
  }

  return (
    <VerticalLayout label={<BaseLabel>Fields</BaseLabel>}>
      <Flex direction="column" css={{ gap: theme.spacing[3], minWidth: 0 }}>
        {rows.map((row) => {
          const field = resolution.fields?.find(
            (item) => item.name === row.name
          );
          return (
            <CheckboxAndLabel key={row.name} css={{ minWidth: 0 }}>
              <Checkbox
                id={`${id}:${row.name}`}
                checked={row.checked}
                disabled={row.locked}
                onCheckedChange={(checked) => {
                  if (checked === true && field !== undefined) {
                    void addSignupField(rootId, field, computedName);
                  } else if (checked === false) {
                    void removeSignupField(rootId, row.name);
                  }
                }}
              />
              <TruncatedLabel htmlFor={`${id}:${row.name}`}>
                {row.label}
              </TruncatedLabel>
            </CheckboxAndLabel>
          );
        })}
        {dataBound === false && (
          <Text
            truncate
            css={{ color: cssVar("--foreground-warning") }}
            data-signup-data-unbound
          >
            No forms data.{" "}
            <button
              type="button"
              className={linkButtonClass}
              onClick={() => {
                void restoreSignupFormData(rootId);
              }}
            >
              Reconnect
            </button>
          </Text>
        )}
        {warning !== undefined && (
          <Text
            truncate
            css={{ color: cssVar("--foreground-warning") }}
            data-signup-warning
          >
            {warning}
          </Text>
        )}
      </Flex>
    </VerticalLayout>
  );
};

const afterSubmitOptions = [
  { value: "state", label: "Message" },
  { value: "page", label: "Page" },
] as const;

/**
 * After submit: Message (the form's own state boxes) or Page, which draws
 * upstream's page select under the radio for `actionPage`, written through the
 * props logic as the other rows are. The stored values stay "state" and
 * "page": published sites read them. A bound `action` is read-only, its page
 * select included.
 */
const SignupAfterSubmitControl = ({
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
  const value = computedValue === "page" ? "page" : "state";
  let actionPage: undefined | Prop;
  for (const item of props.values()) {
    if (item.instanceId === instanceId && item.name === "actionPage") {
      actionPage = item;
    }
  }
  const pageProp =
    actionPage?.type === "page" ||
    actionPage?.type === "string" ||
    actionPage?.type === "expression"
      ? { type: actionPage.type, value: actionPage.value }
      : undefined;

  return (
    <VerticalLayout
      label={<PropertyLabel name={propName} readOnly={readOnly} />}
    >
      <Flex direction="column" css={{ gap: theme.spacing[3] }}>
        <RadioGroup
          disabled={readOnly}
          name={`${id}:after-submit`}
          value={value}
          onValueChange={(next) => onChange({ type: "string", value: next })}
        >
          {afterSubmitOptions.map((option) => (
            <RadioAndLabel key={option.value}>
              <Radio value={option.value} id={`${id}:${option.value}`} />
              <BaseLabel htmlFor={`${id}:${option.value}`}>
                {option.label}
              </BaseLabel>
            </RadioAndLabel>
          ))}
        </RadioGroup>
        {value === "page" && (
          <Flex direction="column" data-after-submit-page>
            <BasePage
              id={`${id}:page`}
              instanceId={instanceId}
              readOnly={readOnly}
              prop={pageProp as ComponentProps<typeof BasePage>["prop"]}
              value=""
              onChange={(page) => {
                if (readOnly === false) {
                  onChangeByPropName?.("actionPage", page);
                }
              }}
            />
          </Flex>
        )}
      </Flex>
    </VerticalLayout>
  );
};
