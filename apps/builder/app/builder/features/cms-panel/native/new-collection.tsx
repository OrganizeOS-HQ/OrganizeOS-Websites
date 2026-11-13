/**
 * New collection (slice 3): the platform's templates and Custom as options,
 * then the name (a template's own until typed) and, for Custom, the
 * singular name. Custom past the plan's cap is offered disabled with the
 * plan chip. The same form is the first run's page, with no other text,
 * and the column's "+" dialog.
 */
import { useEffect, useState } from "react";
import {
  Button,
  Chip,
  cssVar,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
  Flex,
  Grid,
  InputField,
  Label,
  Radio,
  RadioAndLabel,
  RadioGroup,
  Text,
  theme,
  toast,
} from "@webstudio-is/design-system";
import { planBadgeLabel } from "~/shared/branding";
import { getRefusal } from "./cms-logic";
import { isCmsFailure, type CmsCollectionSummary } from "./cms-source";
import { getStructureToastText } from "./cms-structure-logic";
import {
  CUSTOM_COLLECTION_TYPE,
  type CmsStructureLimits,
  type CmsStructureSource,
  type CmsTemplate,
} from "./cms-structure-source";
import { FieldRow } from "./field-controls";
import type { CmsLineKind } from "./refusal-line";
import { StructureBody } from "./structure-header";

type Values = { type: string; name: string; singularName: string };

const emptyValues: Values = { type: "", name: "", singularName: "" };

const isCustomFull = (limits: CmsStructureLimits | undefined) =>
  limits !== undefined &&
  limits.customCollections !== null &&
  limits.customCount >= limits.customCollections;

const NewCollectionFields = ({
  idPrefix,
  templates,
  limits,
  values,
  disabled,
  onChange,
  onSubmit,
}: {
  idPrefix: string;
  templates: CmsTemplate[];
  limits: CmsStructureLimits | undefined;
  values: Values;
  disabled: boolean;
  onChange: (values: Values) => void;
  onSubmit: () => void;
}) => {
  const customFull = isCustomFull(limits);
  /** Whether the name is still the chosen template's own. */
  const nameFollows =
    values.name === "" ||
    templates.some((template) => template.label === values.name);
  const pick = (type: string) => {
    const template = templates.find((entry) => entry.type === type);
    onChange({
      ...values,
      type,
      name: nameFollows ? (template?.label ?? "") : values.name,
    });
  };
  const optionId = (type: string) => `${idPrefix}-type-${type}`;
  return (
    <>
      <RadioGroup
        value={values.type}
        onValueChange={pick}
        aria-label="Template"
        disabled={disabled}
      >
        <Grid
          gap="2"
          css={{
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            columnGap: theme.spacing[9],
          }}
        >
          {templates.map((template) => (
            <RadioAndLabel key={template.type}>
              <Radio value={template.type} id={optionId(template.type)} />
              <Label htmlFor={optionId(template.type)} truncate>
                {template.label}
              </Label>
            </RadioAndLabel>
          ))}
          <RadioAndLabel data-cms-custom-option>
            <Radio
              value={CUSTOM_COLLECTION_TYPE}
              id={optionId(CUSTOM_COLLECTION_TYPE)}
              disabled={customFull}
            />
            <Label
              htmlFor={optionId(CUSTOM_COLLECTION_TYPE)}
              disabled={customFull}
            >
              Custom
            </Label>
            {customFull && <Chip>{planBadgeLabel}</Chip>}
          </RadioAndLabel>
        </Grid>
      </RadioGroup>
      <FieldRow id={`${idPrefix}-name`} label="Name" required>
        <InputField
          id={`${idPrefix}-name`}
          value={values.name}
          disabled={disabled || values.type === ""}
          maxLength={120}
          onChange={(event) =>
            onChange({ ...values, name: event.currentTarget.value })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSubmit();
            }
          }}
        />
      </FieldRow>
      {values.type === CUSTOM_COLLECTION_TYPE && (
        <FieldRow id={`${idPrefix}-singular`} label="Singular name">
          <InputField
            id={`${idPrefix}-singular`}
            value={values.singularName}
            disabled={disabled}
            maxLength={120}
            placeholder={values.name}
            onChange={(event) =>
              onChange({ ...values, singularName: event.currentTarget.value })
            }
          />
        </FieldRow>
      )}
    </>
  );
};

const useCreate = ({
  structure,
  onCreated,
  onRefusal,
}: {
  structure: CmsStructureSource;
  onCreated: (collection: CmsCollectionSummary, type: string) => void;
  onRefusal: (line: CmsLineKind) => void;
}) => {
  const [values, setValues] = useState<Values>(emptyValues);
  const [busy, setBusy] = useState(false);
  const canCreate = values.type !== "" && values.name.trim() !== "" && !busy;
  const create = async () => {
    if (canCreate === false) {
      return false;
    }
    setBusy(true);
    const result = await structure.createCollection({
      clientId: crypto.randomUUID(),
      type: values.type,
      name: values.name.trim(),
      ...(values.type === CUSTOM_COLLECTION_TYPE &&
      values.singularName.trim() !== ""
        ? { singularName: values.singularName.trim() }
        : {}),
    });
    setBusy(false);
    if (isCmsFailure(result)) {
      const refusal = getRefusal(result.error, "write");
      if (refusal === undefined) {
        toast.error(getStructureToastText(result.error, "collection"));
      } else {
        onRefusal(refusal);
      }
      return false;
    }
    const { type } = values;
    setValues(emptyValues);
    onCreated(result.collection, type);
    return true;
  };
  return { values, setValues, busy, canCreate, create };
};

export const NewCollectionDialog = ({
  open,
  onOpenChange,
  structure,
  templates,
  limits,
  initialType,
  onCreated,
  onRefusal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  structure: CmsStructureSource;
  templates: CmsTemplate[];
  limits: CmsStructureLimits | undefined;
  /** A story's preselection. */
  initialType?: string;
  onCreated: (collection: CmsCollectionSummary, type: string) => void;
  onRefusal: (line: CmsLineKind) => void;
}) => {
  const { values, setValues, busy, canCreate, create } = useCreate({
    structure,
    onCreated,
    onRefusal,
  });
  useEffect(() => {
    if (open === false) {
      setValues(emptyValues);
    } else if (initialType !== undefined) {
      const template = templates.find((entry) => entry.type === initialType);
      setValues({
        ...emptyValues,
        type: initialType,
        name: template?.label ?? "",
      });
    }
    // templates refetch after each write; a story's preselection is once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialType, setValues]);
  const submit = async () => {
    if (await create()) {
      onOpenChange(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        width={420}
        aria-describedby={undefined}
        // the name, not the first option, takes the focus
        onOpenAutoFocus={(event) => {
          const name =
            event.currentTarget instanceof HTMLElement
              ? event.currentTarget.querySelector<HTMLInputElement>(
                  "#cms-new-collection-name"
                )
              : null;
          if (name !== null && name.disabled === false) {
            event.preventDefault();
            name.focus();
          }
        }}
      >
        <Grid
          gap="3"
          css={{
            padding: theme.panel.padding,
            gridTemplateColumns: "minmax(0, 1fr)",
          }}
        >
          <NewCollectionFields
            idPrefix="cms-new-collection"
            templates={templates}
            limits={limits}
            values={values}
            disabled={busy}
            onChange={setValues}
            onSubmit={() => void submit()}
          />
        </Grid>
        <DialogActions>
          <Button
            color="primary"
            disabled={canCreate === false}
            state={busy ? "pending" : undefined}
            onClick={() => void submit()}
          >
            Create
          </Button>
          <DialogClose>
            <Button color="ghost">Cancel</Button>
          </DialogClose>
        </DialogActions>
        <DialogTitle>New collection</DialogTitle>
      </DialogContent>
    </Dialog>
  );
};

/** The first run: the same options as a page, with no other text. */
export const NewCollectionPage = ({
  structure,
  templates,
  limits,
  onCreated,
  onRefusal,
}: {
  structure: CmsStructureSource;
  templates: CmsTemplate[];
  limits: CmsStructureLimits | undefined;
  onCreated: (collection: CmsCollectionSummary, type: string) => void;
  onRefusal: (line: CmsLineKind) => void;
}) => {
  const { values, setValues, busy, canCreate, create } = useCreate({
    structure,
    onCreated,
    onRefusal,
  });
  return (
    <Flex
      direction="column"
      css={{ height: "100%", minWidth: 0 }}
      data-cms-first-run
    >
      <Flex
        align="center"
        justify="between"
        gap="2"
        css={{
          height: theme.spacing[15],
          flexShrink: 0,
          paddingInline: theme.panel.paddingInline,
          borderBottom: `1px solid ${cssVar("--border-default")}`,
        }}
      >
        <Text variant="titles">New collection</Text>
        <Button
          color="primary"
          disabled={canCreate === false}
          state={busy ? "pending" : undefined}
          onClick={() => void create()}
        >
          Create
        </Button>
      </Flex>
      <StructureBody>
        <NewCollectionFields
          idPrefix="cms-first-run"
          templates={templates}
          limits={limits}
          values={values}
          disabled={busy}
          onChange={setValues}
          onSubmit={() => void create()}
        />
      </StructureBody>
    </Flex>
  );
};
