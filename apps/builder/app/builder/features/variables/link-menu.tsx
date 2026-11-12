import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Flex,
  Popover,
  PopoverAnchor,
  PopoverContent,
  SearchField,
  SmallIconButton,
  Text,
  cssVar,
  theme,
} from "@webstudio-is/design-system";
import { EllipsesIcon } from "@webstudio-is/icons";
import { toValue } from "@webstudio-is/css-engine";
import { variableTypes } from "@webstudio-is/project-build";
import { resolveRootVariable, type VariableRow } from "./reader";
import { setVariableType, setVariableValue } from "./operations";
import { VARIABLE_TYPE_LABELS, validateVariableValue } from "./value-types";
import { matchesVariableSearch } from "./search";
import { landed } from "./refusal";

/** Whether `row`'s alias chain reaches `cssName`. */
const reaches = (
  row: VariableRow,
  cssName: string,
  byName: ReadonlyMap<string, VariableRow>
) => {
  const seen = new Set<string>();
  let current: VariableRow | undefined = row;
  while (current !== undefined && seen.has(current.cssName) === false) {
    if (current.cssName === cssName) {
      return true;
    }
    seen.add(current.cssName);
    current =
      current.value?.type === "var"
        ? byName.get(current.value.value)
        : undefined;
  }
  return false;
};

/**
 * What `row` may link to (spec 4.6): a variable of its type with a value,
 * not itself, and not one whose alias chain comes back to it.
 */
export const aliasTargets = (
  row: VariableRow,
  rows: readonly VariableRow[]
): VariableRow[] => {
  const byName = new Map(rows.map((item) => [item.cssName, item]));
  return rows.filter(
    (target) =>
      target.cssName !== row.cssName &&
      target.type !== undefined &&
      target.type === row.type &&
      target.value !== undefined &&
      reaches(target, row.cssName, byName) === false
  );
};

/** The types an untyped row's text validates as. */
const typesOf = (row: VariableRow) => {
  if (row.value === undefined) {
    return [];
  }
  const text = toValue(row.value);
  return variableTypes.filter((type) => validateVariableValue(type, text).ok);
};

/**
 * The value cell's menu (spec 5.5): link to another variable, unlink, or,
 * for an untyped row, the types its value takes.
 */
export const LinkMenu = ({
  row,
  rows,
}: {
  row: VariableRow;
  rows: readonly VariableRow[];
}) => {
  const [isLinking, setIsLinking] = useState(false);
  const [search, setSearch] = useState("");
  const isAlias = row.value?.type === "var";
  const types = row.type === undefined ? typesOf(row) : [];
  const targets = isLinking
    ? aliasTargets(row, rows).filter((target) =>
        matchesVariableSearch(target, undefined, search)
      )
    : [];
  return (
    <Popover
      open={isLinking}
      onOpenChange={(open) => {
        setIsLinking(open);
        setSearch("");
      }}
    >
      <PopoverAnchor asChild>
        <span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SmallIconButton
                aria-label="Value actions"
                icon={<EllipsesIcon />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              // the link search takes the focus, not the trigger
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              {row.type !== undefined && (
                <DropdownMenuItem onSelect={() => setIsLinking(true)}>
                  Link to variable
                </DropdownMenuItem>
              )}
              {isAlias && (
                <DropdownMenuItem
                  onSelect={() => {
                    landed(
                      setVariableValue(
                        row.cssName,
                        resolveRootVariable(row.cssName)
                      )
                    );
                  }}
                >
                  Unlink
                </DropdownMenuItem>
              )}
              {types.map((type) => (
                <DropdownMenuItem
                  key={type}
                  onSelect={() => {
                    landed(setVariableType(row.cssName, type));
                  }}
                >
                  {VARIABLE_TYPE_LABELS[type]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </PopoverAnchor>
      <PopoverContent align="end">
        <Flex
          direction="column"
          gap="1"
          css={{ width: theme.spacing[30], padding: theme.spacing[3] }}
        >
          <SearchField
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onAbort={() => setSearch("")}
          />
          <Flex
            direction="column"
            gap="1"
            css={{ maxHeight: theme.spacing[34], overflowY: "auto" }}
          >
            {targets.map((target) => (
              <Text
                key={target.cssName}
                as="button"
                data-link-target
                truncate
                onClick={() => {
                  if (
                    landed(
                      setVariableValue(row.cssName, {
                        type: "var",
                        value: target.cssName,
                      })
                    )
                  ) {
                    setIsLinking(false);
                  }
                }}
                css={{
                  textAlign: "left",
                  border: "none",
                  background: "none",
                  padding: theme.spacing[3],
                  borderRadius: theme.borderRadius[3],
                  "&:hover, &:focus-visible": {
                    background: cssVar("--overlay-interaction-hover"),
                  },
                }}
              >
                {target.displayName}
              </Text>
            ))}
          </Flex>
        </Flex>
      </PopoverContent>
    </Popover>
  );
};
