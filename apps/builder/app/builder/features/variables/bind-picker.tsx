import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@nanostores/react";
import {
  Button,
  ColorThumb,
  Flex,
  List,
  ListItem,
  SearchField,
  Text,
  cssVar,
  selectedItemBackground,
  theme,
} from "@webstudio-is/design-system";
import {
  toValue,
  type CssProperty,
  type StyleValue,
} from "@webstudio-is/css-engine";
import type { VariableType } from "@webstudio-is/project-build";
import type { ComputedStyleDecl } from "~/shared/style-object-model";
import {
  createBatchUpdate,
  resetEphemeralStyles,
} from "~/builder/features/style-panel/shared/use-style-data";
import {
  $variableCollections,
  resolveRootVariable,
  type VariableRow,
} from "./reader";
import { INTEGER_PROPERTIES } from "./property-types";
import { matchesVariableSearch } from "./search";
import { NameCell } from "./name-cell";
import { ValueCell } from "./value-cell";
import { NewVariableForm } from "./new-variable-form";
import { segmentsOf } from "./segments";

const isWholeNumber = (value: StyleValue) =>
  value.type === "unit" &&
  value.unit === "number" &&
  Number.isInteger(value.value);

/** One batch to every property of the row: the Style panel's own path. */
const writeAll = (
  properties: readonly CssProperty[],
  valueOf: (property: CssProperty) => StyleValue | undefined,
  isEphemeral = false
) => {
  const batch = createBatchUpdate();
  for (const property of properties) {
    const value = valueOf(property);
    if (value !== undefined) {
      batch.setProperty(property)(value);
    }
  }
  batch.publish(isEphemeral ? { isEphemeral: true } : undefined);
};

const Heading = ({ children }: { children: ReactNode }) => (
  <Text
    role="presentation"
    variant="labels"
    color="subtle"
    css={{ px: theme.spacing[3], pt: theme.spacing[3] }}
  >
    {children}
  </Text>
);

const Swatch = ({ row }: { row: VariableRow }) => {
  const resolved = resolveRootVariable(row.cssName);
  if (row.type === "color") {
    return <ColorThumb color={toValue(resolved)} />;
  }
  return (
    <Text
      color="subtle"
      truncate
      css={{ flexShrink: 0, maxWidth: theme.spacing[20] }}
    >
      {toValue(resolved)}
    </Text>
  );
};

/**
 * The "+"'s panel (spec 6.4, 6.6): search, New variable from this value, the
 * variables the row takes, and for a bound row Edit variable and Detach.
 * Mounted only while open. Keydown stops here, so Backspace on an option never
 * reaches the builder's hotkeys; the panel's own Escape still closes it.
 */
export const BindPicker = ({
  properties,
  types,
  styles,
  bound,
  onClose,
}: {
  properties: readonly CssProperty[];
  types: ReadonlySet<VariableType>;
  styles: readonly ComputedStyleDecl[];
  bound: { cssName: string } | undefined;
  onClose: () => void;
}) => {
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [query, setQuery] = useState("");
  const collections = useStore($variableCollections);
  useEffect(() => resetEphemeralStyles, []);

  const allRows = collections.flatMap((collection) => collection.rows);
  const boundRow =
    bound === undefined
      ? undefined
      : allRows.find((row) => row.cssName === bound.cssName);
  const integerOnly = properties.every((property) =>
    INTEGER_PROPERTIES.has(property)
  );
  const isSearching = query.trim() !== "";
  const offered = (row: VariableRow) =>
    row.type !== undefined &&
    types.has(row.type) &&
    row.value !== undefined &&
    (integerOnly === false ||
      isWholeNumber(resolveRootVariable(row.cssName))) &&
    (isSearching === false ||
      matchesVariableSearch(
        row,
        row.value.type === "var" ? resolveRootVariable(row.cssName) : undefined,
        query
      ));
  // An unresolved binding computes to the inherited or initial value, which
  // Detach writes; an invalid one would be dropped, leaving the row bound.
  const canDetach = styles.every(
    (decl) =>
      decl.computedValue.type !== "invalid" &&
      decl.computedValue.type !== "guaranteedInvalid"
  );

  const bind = (cssName: string, isEphemeral = false) =>
    writeAll(properties, () => ({ type: "var", value: cssName }), isEphemeral);

  const detach = () => {
    writeAll(
      properties,
      (property) =>
        styles.find((decl) => decl.property === property)?.computedValue
    );
    onClose();
  };

  let content: ReactNode;
  if (view === "new") {
    content = (
      <NewVariableForm
        properties={properties}
        types={types}
        styles={styles}
        onDone={onClose}
      />
    );
  } else if (view === "edit" && boundRow !== undefined) {
    content = (
      <Flex direction="column" gap="2" css={{ padding: theme.spacing[5] }}>
        {boundRow.locked === false && (
          <NameCell row={boundRow} readOnly={false} showLeaf={false} />
        )}
        <ValueCell row={boundRow} rows={allRows} readOnly={false} />
      </Flex>
    );
  } else {
    let index = 0;
    const items: ReactNode[] = [];
    for (const collection of collections) {
      const rows = collection.rows.filter(offered);
      if (rows.length === 0) {
        continue;
      }
      items.push(
        <Heading key={`collection-${collection.id}`}>{collection.name}</Heading>
      );
      // The manager's grouping: each group once, where it first appears;
      // an ungrouped run has no heading.
      segmentsOf(rows).forEach((segment, segmentIndex) => {
        if (segment.group !== undefined) {
          items.push(
            <Heading key={`group-${collection.id}-${segmentIndex}`}>
              {segment.group}
            </Heading>
          );
        }
        for (const row of segment.rows) {
          items.push(
            <ListItem
              key={row.cssName}
              asChild
              index={index}
              state={row.cssName === bound?.cssName ? "selected" : undefined}
              onSelect={() => {
                bind(row.cssName);
                onClose();
              }}
            >
              <Flex
                data-variable-option={row.cssName}
                data-variable-group={segment.group}
                align="center"
                gap="2"
                onPointerEnter={() => bind(row.cssName, true)}
                onPointerLeave={resetEphemeralStyles}
                onFocus={() => bind(row.cssName, true)}
                onBlur={resetEphemeralStyles}
                css={{
                  minWidth: 0,
                  px: theme.spacing[3],
                  // a group's variables sit under its heading
                  "&[data-variable-group]": { pl: theme.spacing[7] },
                  py: theme.spacing[2],
                  borderRadius: theme.borderRadius[3],
                  cursor: "default",
                  outline: "none",
                  "&:hover, &:focus-visible": {
                    background: cssVar("--overlay-interaction-hover"),
                  },
                  "&[data-state=selected]": {
                    background: selectedItemBackground,
                  },
                }}
              >
                <Swatch row={row} />
                <Text truncate>
                  {/* under its group's heading, the leaf, as the manager shows it */}
                  {segment.group === undefined
                    ? row.displayName
                    : row.displayName.slice(row.displayName.indexOf("/") + 1)}
                </Text>
              </Flex>
            </ListItem>
          );
          index += 1;
        }
      });
    }
    content = (
      <Flex direction="column" gap="1" css={{ padding: theme.spacing[5] }}>
        <SearchField
          autoFocus
          placeholder="Search variables"
          value={query}
          onChange={(event) => {
            // a preview never outlives the option that set it
            resetEphemeralStyles();
            setQuery(event.target.value);
          }}
          onAbort={() => {
            resetEphemeralStyles();
            setQuery("");
          }}
        />
        <Button
          color="ghost"
          onClick={() => {
            resetEphemeralStyles();
            setView("new");
          }}
        >
          New variable from this value
        </Button>
        {boundRow !== undefined && (
          <Button
            color="ghost"
            onClick={() => {
              resetEphemeralStyles();
              setView("edit");
            }}
          >
            Edit variable
          </Button>
        )}
        {bound !== undefined && canDetach && (
          <Button color="ghost" onClick={detach}>
            Detach
          </Button>
        )}
        <List asChild>
          <Flex direction="column">{items}</Flex>
        </List>
      </Flex>
    );
  }

  return (
    <Flex
      data-variable-picker
      direction="column"
      onKeyDown={(event) => event.stopPropagation()}
      css={{ minWidth: 0 }}
    >
      {content}
    </Flex>
  );
};
