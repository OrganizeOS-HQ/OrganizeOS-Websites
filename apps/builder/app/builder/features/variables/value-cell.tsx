import { useEffect, useState, type ReactNode } from "react";
import {
  ColorPicker,
  ColorThumb,
  Combobox,
  Flex,
  InputErrorsTooltip,
  InputField,
  Select,
  Text,
  cssVar,
  theme,
  toast,
} from "@webstudio-is/design-system";
import { toValue, type StyleValue } from "@webstudio-is/css-engine";
import { keywordValues, parseCssValue } from "@webstudio-is/css-data";
import type { CssProperty } from "@webstudio-is/css-engine";
import type { VariableType } from "@webstudio-is/project-build";
import { useAssets } from "~/builder/shared/assets";
import { toItems } from "~/builder/shared/fonts-manager";
import { resolveRootVariable, type VariableRow } from "./reader";
import { setVariableValue } from "./operations";
import { SIZE_UNITS, validateVariableValue } from "./value-types";
import { toRgba } from "./color";
import { LinkMenu } from "./link-menu";
import { landed } from "./refusal";

const notFonts = new Set(["initial", "inherit", "unset"]);

const textOf = (value: StyleValue | undefined) =>
  value === undefined ? "" : toValue(value);

/** Writes `value`, or the refusal, for a field to show. */
const commit = (row: VariableRow, value: StyleValue) => {
  const result = setVariableValue(row.cssName, value);
  return result.ok ? undefined : result.error;
};

/**
 * A text field that commits on Enter and on a blur with a change, validated
 * by `parse`; a refusal shows in its tooltip and writes nothing.
 */
const CommitField = ({
  value,
  readOnly,
  label,
  parse,
}: {
  value: string;
  readOnly: boolean;
  label: string;
  /** the value to write, or the refusal */
  parse: (
    text: string
  ) => { ok: true; value: StyleValue } | { ok: false; error: string };
}) => {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string>();
  useEffect(() => {
    setText(value);
  }, [value]);
  const submit = (on: "enter" | "blur") => {
    if (text === value) {
      setError(undefined);
      return;
    }
    const parsed = parse(text);
    if (parsed.ok === false) {
      // On a blur the focus has gone: the field goes back and the reason
      // shows in a toast, so no tooltip stays open (and takes Escape) over a
      // field nobody is in.
      if (on === "blur") {
        toast.error(parsed.error);
        setText(value);
        setError(undefined);
        return;
      }
      setError(parsed.error);
      return;
    }
    setError(undefined);
  };
  return (
    <InputErrorsTooltip errors={error === undefined ? undefined : [error]}>
      <InputField
        aria-label={label}
        value={text}
        readOnly={readOnly}
        css={
          error === undefined
            ? undefined
            : { borderColor: cssVar("--border-negative") }
        }
        onChange={(event) => {
          setText(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit("enter");
          }
        }}
        onBlur={() => submit("blur")}
      />
    </InputErrorsTooltip>
  );
};

/** Validates `text` as `type` and writes it. */
const typedParse = (row: VariableRow, type: VariableType) => (text: string) => {
  const validated = validateVariableValue(type, text);
  if (validated.ok === false) {
    return validated;
  }
  const refusal = commit(row, validated.value);
  return refusal === undefined
    ? validated
    : ({ ok: false, error: refusal } as const);
};

const ColorValue = ({
  row,
  readOnly,
}: {
  row: VariableRow;
  readOnly: boolean;
}) => {
  const resolved = toRgba(resolveRootVariable(row.cssName));
  const value = row.value;
  return (
    <Flex align="center" gap="1" css={{ minWidth: 0, flexGrow: 1 }}>
      {resolved === undefined || value === undefined || readOnly ? (
        <ColorThumb
          data-swatch={resolved === undefined ? "empty" : undefined}
          color={
            resolved === undefined || value === undefined
              ? undefined
              : toValue(value)
          }
        />
      ) : (
        <ColorPicker
          value={value}
          onChange={() => {}}
          onChangeComplete={(next) => {
            landed(setVariableValue(row.cssName, next));
          }}
        />
      )}
      <CommitField
        label="Value"
        value={textOf(value)}
        readOnly={readOnly}
        parse={typedParse(row, "color")}
      />
    </Flex>
  );
};

const SizeValue = ({
  row,
  readOnly,
}: {
  row: VariableRow;
  readOnly: boolean;
}) => {
  const value = row.value?.type === "unit" ? row.value : undefined;
  const unit = value?.unit ?? "px";
  const amount = value === undefined ? "" : String(value.value);
  return (
    <Flex align="center" gap="1" css={{ minWidth: 0, flexGrow: 1 }}>
      <CommitField
        label="Value"
        value={amount}
        readOnly={readOnly}
        parse={(text) => typedParse(row, "size")(`${text.trim()}${unit}`)}
      />
      <Select
        aria-label="Unit"
        disabled={readOnly}
        options={SIZE_UNITS}
        value={SIZE_UNITS.find((item) => item === unit) ?? "px"}
        onChange={(next) => {
          if (value !== undefined) {
            landed(typedParse(row, "size")(`${value.value}${next}`));
          }
        }}
      />
    </Flex>
  );
};

const FontValue = ({
  row,
  readOnly,
}: {
  row: VariableRow;
  readOnly: boolean;
}) => {
  const { assetContainers } = useAssets("font");
  const items = [
    ...toItems(assetContainers).map((item) => item.label),
    ...(keywordValues["font-family"] ?? []).filter(
      (keyword) => notFonts.has(keyword) === false
    ),
  ];
  const first =
    row.value?.type === "fontFamily"
      ? (row.value.value[0] ?? "")
      : textOf(row.value);
  const [text, setText] = useState(first);
  useEffect(() => {
    setText(first);
  }, [first]);
  return (
    <Combobox<string>
      value={text}
      disabled={readOnly}
      itemToString={(item) => item ?? ""}
      getItems={() => items}
      onItemSelect={(item) => {
        if (item && item !== first) {
          setText(item);
          // Written as the Style panel writes a family, not parsed as CSS
          // text, where an unquoted name such as Source Sans 3 is invalid.
          const result = setVariableValue(row.cssName, {
            type: "fontFamily",
            value: [item],
          });
          if (landed(result) === false) {
            setText(first);
          }
        }
      }}
      // Only a picked font is written; typed text left unpicked goes back.
      onChange={(next) => setText(next ?? first)}
      onBlur={() => setText(first)}
    />
  );
};

const UntypedValue = ({
  row,
  readOnly,
}: {
  row: VariableRow;
  readOnly: boolean;
}) => (
  <CommitField
    label="Value"
    value={textOf(row.value)}
    readOnly={readOnly}
    parse={(text) => {
      const value = parseCssValue(`--${row.cssName}` as CssProperty, text);
      if (value.type === "invalid") {
        return { ok: false, error: "Invalid value" };
      }
      const refusal = commit(row, value);
      return refusal === undefined
        ? { ok: true, value }
        : { ok: false, error: refusal };
    }}
  />
);

/** An alias shows its target's name, with the swatch for a colour. */
const AliasValue = ({
  row,
  rows,
}: {
  row: VariableRow;
  rows: readonly VariableRow[];
}) => {
  const target = row.value?.type === "var" ? row.value.value : undefined;
  const name =
    rows.find((item) => item.cssName === target)?.displayName ?? target;
  const resolved =
    row.type === "color" ? toRgba(resolveRootVariable(row.cssName)) : undefined;
  return (
    <Flex align="center" gap="2" css={{ minWidth: 0, flexGrow: 1 }}>
      {row.type === "color" && (
        <ColorThumb
          data-swatch={resolved === undefined ? "empty" : undefined}
          color={
            resolved === undefined
              ? undefined
              : toValue(resolveRootVariable(row.cssName))
          }
        />
      )}
      <Text truncate>{name}</Text>
    </Flex>
  );
};

const ValueByType = ({
  row,
  rows,
  readOnly,
}: {
  row: VariableRow;
  rows: readonly VariableRow[];
  readOnly: boolean;
}): ReactNode => {
  if (row.value?.type === "var") {
    return <AliasValue row={row} rows={rows} />;
  }
  switch (row.type) {
    case "color":
      return <ColorValue row={row} readOnly={readOnly} />;
    case "size":
      return <SizeValue row={row} readOnly={readOnly} />;
    case "percentage":
    case "number":
      return (
        <CommitField
          label="Value"
          value={
            row.value?.type === "unit"
              ? String(row.value.value)
              : textOf(row.value)
          }
          readOnly={readOnly}
          parse={(text) =>
            typedParse(
              row,
              row.type!
            )(
              row.type === "percentage"
                ? `${text.trim().replace(/%$/, "")}%`
                : text
            )
          }
        />
      );
    case "fontFamily":
      return <FontValue row={row} readOnly={readOnly} />;
    default:
      return <UntypedValue row={row} readOnly={readOnly} />;
  }
};

/**
 * A row's base value (spec 5.5), edited by type; each commit is one write.
 * A missing Brand row shows empty fields; setting one restores it.
 */
export const ValueCell = ({
  row,
  rows,
  readOnly,
}: {
  row: VariableRow;
  rows: readonly VariableRow[];
  readOnly: boolean;
}) => (
  <Flex
    data-value-cell
    align="center"
    gap="1"
    css={{ minWidth: 0, paddingRight: theme.spacing[3] }}
  >
    <ValueByType row={row} rows={rows} readOnly={readOnly} />
    {readOnly === false && <LinkMenu row={row} rows={rows} />}
  </Flex>
);
