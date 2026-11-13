/**
 * The native CMS list's Filter and Sort menus (spec 5.1.2, 5.1.3): a ghost
 * button and a radio menu, each no wider than the main area, long labels
 * truncated.
 */
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  MenuCheckedIcon,
  Text,
  theme,
} from "@webstudio-is/design-system";
import {
  defaultDirection,
  filterCount,
  type CmsListState,
} from "./cms-list-logic";
import type { CmsField, CmsSortKey, CmsStatusFilter } from "./cms-source";
import { TruncatedText } from "./truncated-text";

const STATUS_ITEMS: ReadonlyArray<{ value: CmsStatusFilter; label: string }> = [
  { value: "all", label: "All items" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "staged", label: "Staged changes" },
  { value: "archived", label: "Archived" },
];

const contentCss = (maxWidth: number | undefined) => ({
  maxWidth:
    maxWidth !== undefined && maxWidth > 0
      ? maxWidth
      : "var(--radix-dropdown-menu-content-available-width)",
});

const RadioLabel = ({ children }: { children: string }) => (
  <TruncatedText css={{ maxWidth: theme.spacing[30] }}>
    {children}
  </TruncatedText>
);

export const FilterMenu = ({
  list,
  filterField,
  maxWidth,
  onChange,
}: {
  list: CmsListState;
  /** The option field the Filter offers, or null (E3's filterField). */
  filterField: CmsField | null;
  maxWidth: number | undefined;
  onChange: (next: CmsListState) => void;
}) => {
  const count = filterCount(list);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button color="ghost" data-cms-filter>
          Filter
          {count > 0 && (
            <Text
              variant="labels"
              css={{ marginInlineStart: theme.spacing[2] }}
            >
              {count}
            </Text>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        css={contentCss(maxWidth)}
      >
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={list.status}
          onValueChange={(value) =>
            onChange({ ...list, status: value as CmsStatusFilter })
          }
        >
          {STATUS_ITEMS.map((item) => (
            <DropdownMenuRadioItem
              key={item.value}
              value={item.value}
              icon={<MenuCheckedIcon />}
            >
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {filterField !== null && (
          <>
            <DropdownMenuLabel>
              <RadioLabel>{filterField.label}</RadioLabel>
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={list.option?.value ?? ""}
              onValueChange={(value) =>
                onChange({
                  ...list,
                  option: value === "" ? null : { key: filterField.key, value },
                })
              }
            >
              <DropdownMenuRadioItem value="" icon={<MenuCheckedIcon />}>
                Any {filterField.label.toLowerCase()}
              </DropdownMenuRadioItem>
              {(filterField.options ?? []).map((option) => (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                  icon={<MenuCheckedIcon />}
                >
                  <RadioLabel>{option.label}</RadioLabel>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const SortMenu = ({
  list,
  sortFields,
  maxWidth,
  onChange,
}: {
  list: CmsListState;
  /** The sortable field columns, by label (whether or not they fit). */
  sortFields: CmsField[];
  maxWidth: number | undefined;
  onChange: (next: CmsListState) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button color="ghost" data-cms-sort>
        Sort
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={4} css={contentCss(maxWidth)}>
      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={list.sort}
        onValueChange={(value) =>
          onChange({
            ...list,
            sort: value as CmsSortKey,
            direction: defaultDirection(value as CmsSortKey),
          })
        }
      >
        <DropdownMenuRadioItem value="order" icon={<MenuCheckedIcon />}>
          Manual order
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="name" icon={<MenuCheckedIcon />}>
          Name
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="status" icon={<MenuCheckedIcon />}>
          Status
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="updated" icon={<MenuCheckedIcon />}>
          Modified
        </DropdownMenuRadioItem>
        {sortFields.map((field) => (
          <DropdownMenuRadioItem
            key={field.key}
            value={`field:${field.key}`}
            icon={<MenuCheckedIcon />}
          >
            <RadioLabel>{field.label}</RadioLabel>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      {list.sort !== "order" && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={list.direction}
            onValueChange={(value) =>
              onChange({
                ...list,
                direction: value === "desc" ? "desc" : "asc",
              })
            }
          >
            <DropdownMenuRadioItem value="asc" icon={<MenuCheckedIcon />}>
              Ascending
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc" icon={<MenuCheckedIcon />}>
              Descending
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);
