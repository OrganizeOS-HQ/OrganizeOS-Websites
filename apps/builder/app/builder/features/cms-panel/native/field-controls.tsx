import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Button,
  ColorThumb,
  Flex,
  Grid,
  InputField,
  Label,
  ResettableLabel,
  Select,
  SmallIconButton,
  Switch,
  Text,
  TextArea,
  theme,
  Tooltip,
} from "@webstudio-is/design-system";
import { ResetIcon } from "@webstudio-is/icons";
import {
  appliesMaxLength,
  isoToLocalInput,
  localInputToIso,
} from "./cms-logic";
import type { CmsField, CmsSource } from "./cms-source";
import { ImageField } from "./image-field";
import { MultiReferenceField, ReferenceField } from "./reference-field";
// types only: Lexical loads with the first rich-text field
import type { RichTextFieldProps } from "./rich-text-field";

type RichTextModule = typeof import("./rich-text-field");

/** A failed load of the editor's chunk: the field's line, and Retry. */
class RichTextLoadBoundary extends Component<
  { onRetry: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <Flex align="center" gap="2" wrap="wrap">
          <Text color="destructive">Try again in a minute</Text>
          <Button color="neutral" onClick={this.props.onRetry}>
            Retry
          </Button>
        </Flex>
      );
    }
    return this.props.children;
  }
}

/**
 * The rich-text field over `load`, loaded when it first renders. A failed
 * load shows under that field only, and Retry loads again: a rejected lazy
 * stays rejected, so each Retry builds a new one.
 */
export const createLazyRichTextField = (
  load: () => Promise<RichTextModule> = () => import("./rich-text-field")
): ComponentType<RichTextFieldProps> => {
  const toLazy = () =>
    lazy(() => load().then((module) => ({ default: module.RichTextField })));
  let current = toLazy();
  const LazyRichTextField = (props: RichTextFieldProps) => {
    const [attempt, setAttempt] = useState(0);
    const Field = current;
    return (
      <RichTextLoadBoundary
        key={attempt}
        onRetry={() => {
          current = toLazy();
          setAttempt((count) => count + 1);
        }}
      >
        <Suspense fallback={null}>
          <Field {...props} />
        </Suspense>
      </RichTextLoadBoundary>
    );
  };
  return LazyRichTextField;
};

const RichTextField = createLazyRichTextField();

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

/** The platform's caps for kinds whose `maxLength` it ignores. */
const fixedMaxLength: Partial<Record<CmsField["kind"], number>> = {
  link: 2048,
  email: 320,
};

const maxLengthOf = (field: CmsField) =>
  appliesMaxLength(field.kind) &&
  field.maxLength !== undefined &&
  field.maxLength > 0
    ? field.maxLength
    : fixedMaxLength[field.kind];

/** The ids a field's parts share: its control, label and error. */
export const fieldIds = (id: string) => ({
  label: `${id}-label`,
  error: `${id}-error`,
});

/** A label that truncates, with its name in a tooltip only while cut off. */
const TruncatedLabel = ({
  id,
  htmlFor,
  children,
}: {
  id: string;
  htmlFor: string;
  children: string;
}) => {
  const ref = useRef<HTMLLabelElement>(null);
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
      <Label ref={ref} id={id} htmlFor={htmlFor} truncate>
        {children}
      </Label>
    </Tooltip>
  );
};

/**
 * A field's label, its "Use my edit" button after a conflict, the control,
 * and its error in a few words. One `role="group"` named by the label, so
 * an image's Choose and Remove, or a list's remove buttons, say whose they
 * are.
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
  /** A switch: the control first, then its label, as page settings do. */
  inline?: boolean;
  error?: string;
  onUseMine?: () => void;
  children: ReactNode;
}) => {
  const ids = fieldIds(id);
  const text = `${label}${required ? " *" : ""}`;
  const labelElement =
    help === undefined ? (
      <TruncatedLabel id={ids.label} htmlFor={id}>
        {text}
      </TruncatedLabel>
    ) : (
      // org-authored help: the name above it, as the settings panel does,
      // and reachable from the keyboard
      <ResettableLabel
        id={ids.label}
        htmlFor={id}
        content={
          <>
            <Text variant="titles">{label}</Text>
            <Text>{help}</Text>
          </>
        }
      >
        {text}
      </ResettableLabel>
    );
  const head = (
    <Flex align="center" gap="1" css={{ minWidth: 0 }}>
      {labelElement}
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
      role="group"
      aria-labelledby={ids.label}
      data-cms-field={id}
      css={{
        gridTemplateColumns: inline ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)",
        alignItems: "center",
      }}
    >
      {inline ? (
        <>
          {children}
          {head}
        </>
      ) : (
        <>
          {head}
          {children}
        </>
      )}
      {error !== undefined && (
        <Text
          id={ids.error}
          role="alert"
          color="destructive"
          css={{ gridColumn: "1 / -1" }}
        >
          {error}
        </Text>
      )}
    </Grid>
  );
};

/**
 * A number field keeps what the person typed ("2.0" on the way to "2.05")
 * and writes the number once it parses; empty is null.
 */
const NumberInput = ({
  id,
  value,
  disabled,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  value: unknown;
  disabled: boolean;
  invalid: boolean;
  describedBy: string | undefined;
  onChange: (value: number | null) => void;
}) => {
  const [draft, setDraft] = useState(asText(value));
  useEffect(() => {
    // a value from outside (Reload, "Use my edit") replaces the draft
    setDraft((current) => {
      const parsed = current.trim() === "" ? null : Number(current);
      return parsed === value || (parsed === null && value === null)
        ? current
        : asText(value);
    });
  }, [value]);
  return (
    <InputField
      id={id}
      type="number"
      step="any"
      value={draft}
      disabled={disabled}
      color={invalid ? "error" : undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setDraft(next);
        if (next.trim() === "") {
          onChange(null);
          return;
        }
        const number = Number(next);
        if (Number.isFinite(number)) {
          onChange(number);
        }
      }}
    />
  );
};

/** Radix Select takes no empty value: "None" stands for null. */
const NONE = "__cms_none__";

/** One control per field kind (4.3.3). Each writes the platform's shape. */
export const FieldControl = ({
  id,
  field,
  value,
  source,
  disabled,
  invalid,
  remountKey,
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
  /** Rich text reads its value only when it mounts: a new key reloads it. */
  remountKey: string;
  onChange: (value: unknown) => void;
  onError: (error: string | undefined) => void;
  onOpenClassic?: () => void;
}) => {
  const color = invalid ? ("error" as const) : undefined;
  const ids = fieldIds(id);
  const describedBy = invalid ? ids.error : undefined;
  const aria = {
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    "aria-required": field.required || undefined,
  };
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
          maxLength={maxLengthOf(field)}
          disabled={disabled}
          color={color}
          {...aria}
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
          maxLength={maxLengthOf(field)}
          disabled={disabled}
          color={color}
          {...aria}
          onChange={(next) => onChange(textOrNull(next))}
        />
      );
    case "number":
      return (
        <NumberInput
          id={id}
          value={value}
          disabled={disabled}
          invalid={invalid}
          describedBy={describedBy}
          onChange={onChange}
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
          {...aria}
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
          {...aria}
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
          {...aria}
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
          {...aria}
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
      const choices = [
        ...(field.required ? [] : [NONE]),
        ...options.map((option) => option.value),
      ];
      const current =
        typeof value === "string" && value !== ""
          ? value
          : field.required
            ? undefined
            : NONE;
      return (
        <Select
          id={id}
          options={choices}
          value={current}
          placeholder="Choose"
          disabled={disabled}
          {...aria}
          getLabel={(option) =>
            option === NONE
              ? "None"
              : (options.find((entry) => entry.value === option)?.label ??
                option)
          }
          onChange={(next) => onChange(next === NONE ? null : next)}
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
          key={remountKey}
          id={id}
          labelId={ids.label}
          describedBy={describedBy}
          value={value}
          disabled={disabled}
          invalid={invalid}
          onChange={onChange}
          onOpenClassic={onOpenClassic}
        />
      );
    default: {
      // A kind this screen does not know still shows: a text input for a
      // text value, read-only for any other shape.
      const isText =
        value === null ||
        value === undefined ||
        typeof value === "string" ||
        typeof value === "number";
      return (
        <InputField
          id={id}
          value={isText ? asText(value) : JSON.stringify(value)}
          disabled={disabled || isText === false}
          color={color}
          {...aria}
          onChange={(event) => onChange(textOrNull(event.currentTarget.value))}
        />
      );
    }
  }
};
