import type { ReactNode } from "react";
import {
  ColorThumb,
  Flex,
  Grid,
  InputField,
  Label,
  Select,
  SmallIconButton,
  Switch,
  Text,
  TextArea,
  theme,
  Tooltip,
} from "@webstudio-is/design-system";
import { ResetIcon } from "@webstudio-is/icons";
import { isoToLocalInput, localInputToIso } from "./cms-logic";
import type { CmsField, CmsSource } from "./cms-source";
import { ImageField } from "./image-field";
import { MultiReferenceField, ReferenceField } from "./reference-field";
import { RichTextField } from "./rich-text-field";

const asText = (value: unknown) =>
  typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : "";

/** "" is unset: text kinds store null, as the platform's `trimOrNull`. */
const textOrNull = (value: string) => (value === "" ? null : value);

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const inputTypes = {
  text: "text",
  link: "url",
  email: "email",
  phone: "tel",
} as const;

/**
 * A field's label, its "Use my edit" button after a conflict, the control,
 * and its error in a few words.
 */
export const FieldRow = ({
  id,
  label,
  help,
  required,
  inline = false,
  error,
  onUseMine,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  required?: boolean;
  /** The label and a small control on one row (switch). */
  inline?: boolean;
  error?: string;
  onUseMine?: () => void;
  children: ReactNode;
}) => {
  const labelElement = (
    // truncates, but keeps to its text so "Use my edit" sits beside it
    <Label htmlFor={id} truncate css={{ flexGrow: 0, flexBasis: "auto" }}>
      {label}
      {required ? " *" : ""}
    </Label>
  );
  const head = (
    <Flex align="center" gap="1" css={{ minWidth: 0 }}>
      {help === undefined ? (
        labelElement
      ) : (
        // org-authored help lives in the label's tooltip, never under it
        <Tooltip content={help} delayDuration={300}>
          {labelElement}
        </Tooltip>
      )}
      {onUseMine !== undefined && (
        <Tooltip content={`Use my edit: ${label}`}>
          <SmallIconButton
            aria-label={`Use my edit: ${label}`}
            data-cms-use-mine={id}
            icon={<ResetIcon fill="currentColor" />}
            onClick={onUseMine}
          />
        </Tooltip>
      )}
    </Flex>
  );
  return (
    <Grid
      gap="1"
      data-cms-field={id}
      css={{
        gridTemplateColumns: inline ? "minmax(0, 1fr) auto" : undefined,
        alignItems: "center",
      }}
    >
      {head}
      {children}
      {error !== undefined && (
        <Text role="alert" color="destructive" css={{ gridColumn: "1 / -1" }}>
          {error}
        </Text>
      )}
    </Grid>
  );
};

/** One control per field kind (4.3.3). Each writes the platform's shape. */
export const FieldControl = ({
  id,
  field,
  value,
  source,
  disabled,
  invalid,
  onChange,
  onError,
  onOpenClassic,
}: {
  id: string;
  field: CmsField;
  value: unknown;
  source: CmsSource;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: unknown) => void;
  onError: (error: string | undefined) => void;
  onOpenClassic?: () => void;
}) => {
  const color = invalid ? ("error" as const) : undefined;
  switch (field.kind) {
    case "text":
    case "link":
    case "email":
    case "phone":
      return (
        <InputField
          id={id}
          type={inputTypes[field.kind]}
          value={asText(value)}
          maxLength={field.maxLength}
          disabled={disabled}
          color={color}
          aria-required={field.required}
          onChange={(event) => onChange(textOrNull(event.currentTarget.value))}
        />
      );
    case "textarea":
      return (
        <TextArea
          id={id}
          autoGrow
          rows={3}
          maxRows={12}
          value={asText(value)}
          maxLength={field.maxLength}
          disabled={disabled}
          color={color}
          onChange={(next) => onChange(textOrNull(next))}
        />
      );
    case "number":
      return (
        <InputField
          id={id}
          type="number"
          step="any"
          value={asText(value)}
          disabled={disabled}
          color={color}
          css={{ width: theme.spacing[30] }}
          onChange={(event) => {
            const next = event.currentTarget.value;
            const number = Number(next);
            // empty is null
            onChange(next === "" || Number.isNaN(number) ? null : number);
          }}
        />
      );
    case "date":
      return (
        <InputField
          id={id}
          type="date"
          value={asText(value)}
          disabled={disabled}
          color={color}
          css={{ width: theme.spacing[30] }}
          onChange={(event) => onChange(textOrNull(event.currentTarget.value))}
        />
      );
    case "datetime":
      return (
        <InputField
          id={id}
          type="datetime-local"
          value={isoToLocalInput(value)}
          disabled={disabled}
          color={color}
          css={{ width: theme.spacing[30] }}
          onChange={(event) =>
            onChange(localInputToIso(event.currentTarget.value))
          }
        />
      );
    case "switch":
      return (
        <Switch
          id={id}
          checked={value === true}
          disabled={disabled}
          // never null
          onCheckedChange={(checked) => onChange(checked)}
        />
      );
    case "color": {
      // Owner item (spec 13.2): the design-system ColorPicker emits a CSS
      // StyleValue with alpha, so the value stays an InputField of #RRGGBB.
      const hex = asText(value);
      return (
        <InputField
          id={id}
          value={hex}
          disabled={disabled}
          color={color}
          text="mono"
          placeholder="#RRGGBB"
          maxLength={7}
          css={{ width: theme.spacing[30] }}
          prefix={
            <Flex align="center" css={{ paddingLeft: theme.spacing[2] }}>
              <ColorThumb color={COLOR_RE.test(hex) ? hex : "transparent"} />
            </Flex>
          }
          onChange={(event) =>
            onChange(textOrNull(event.currentTarget.value.trim()))
          }
        />
      );
    }
    case "option": {
      const options = field.options ?? [];
      const values = options.map((option) => option.value);
      const current = typeof value === "string" ? value : undefined;
      return (
        <Select
          id={id}
          options={values}
          value={current}
          placeholder="Choose"
          disabled={disabled}
          getLabel={(option) =>
            options.find((entry) => entry.value === option)?.label ?? option
          }
          css={{ width: theme.spacing[30] }}
          onChange={(next) => onChange(next)}
        />
      );
    }
    case "reference":
      return (
        <ReferenceField
          id={id}
          source={source}
          collectionId={field.reference?.collectionId ?? ""}
          value={value}
          disabled={disabled}
          invalid={invalid}
          onChange={onChange}
        />
      );
    case "multireference":
      return (
        <MultiReferenceField
          id={id}
          source={source}
          collectionId={field.reference?.collectionId ?? ""}
          value={value}
          disabled={disabled}
          invalid={invalid}
          onChange={onChange}
        />
      );
    case "image":
      return (
        <ImageField
          id={id}
          source={source}
          value={value}
          disabled={disabled}
          onChange={onChange}
          onError={onError}
        />
      );
    case "richtext":
      return (
        <RichTextField
          id={id}
          value={value}
          disabled={disabled}
          invalid={invalid}
          onChange={onChange}
          onOpenClassic={onOpenClassic}
        />
      );
  }
};
